import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import { MeetingStatus, MeetingType, Prisma } from "../../../types/types.js";
import { meetingFollowUpService } from "../../../module/auto-followup/services/meeting-followup.service.js";
import type { MeetingToolContext } from "./schedule-meeting.tool.js";

/**
 * Zod schema for updating an existing meeting.
 */
export const updateMeetingSchema = z.object({
  meetingId: z
    .string()
    .optional()
    .describe(
      "The UUID of the meeting record to update. If omitted, the upcoming or future meeting for this lead/customer is automatically updated.",
    ),
  meetingDate: z.string().describe("New meeting date in YYYY-MM-DD format or recognizable date string."),
  startTime: z.string().optional().describe("New start time (e.g., '11:00 AM', '15:30', ISO timestamp)."),
  durationMinutes: z.number().optional().default(30).describe("Duration in minutes; defaults to 30 if omitted."),
  agenda: z.string().optional().describe("Updated agenda or focus items."),
  locationName: z.string().optional().describe("Updated location name for offline/onsite meetings."),
  locationAddress: z.string().optional().describe("Updated address for offline/onsite meetings."),
});

export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;

/**
 * Helper to parse date & time into Date objects.
 * Strictly enforces current year and rolls over to next year if booking across year boundary.
 * Never allows past years (e.g. 2023, 2024).
 */
function parseMeetingTimings(
  meetingDateStr: string,
  startTimeStr?: string,
  durationMinutes: number = 30,
): { meetingDate: Date; startTime: Date; endTime: Date } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let baseDate = new Date(meetingDateStr);

  if (isNaN(baseDate.getTime())) {
    baseDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  let targetYear = baseDate.getFullYear();
  const targetMonth = baseDate.getMonth();

  if (targetYear < currentYear) {
    targetYear = currentYear;
  }

  if (targetYear === currentYear && targetMonth < currentMonth) {
    targetYear = currentYear + 1;
  }

  baseDate.setFullYear(targetYear);

  const meetingDate = new Date(targetYear, baseDate.getMonth(), baseDate.getDate());
  let startTime = new Date(targetYear, baseDate.getMonth(), baseDate.getDate(), 11, 0, 0);

  if (startTimeStr) {
    const timeMatch = startTimeStr.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
    if (timeMatch && timeMatch[1] && timeMatch[2]) {
      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const meridiem = timeMatch[3]?.toUpperCase();
      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
      startTime = new Date(
        targetYear,
        baseDate.getMonth(),
        baseDate.getDate(),
        hours,
        minutes,
        0,
      );
    } else {
      const parsed = new Date(startTimeStr);
      if (!isNaN(parsed.getTime())) {
        startTime = new Date(
          targetYear,
          baseDate.getMonth(),
          baseDate.getDate(),
          parsed.getHours(),
          parsed.getMinutes(),
          0,
        );
      }
    }
  }
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  return { meetingDate, startTime, endTime };
}

/**
 * Creates a tool that allows the AI to update an existing meeting's date/time/etc.
 */
export function createUpdateMeetingTool(context: MeetingToolContext) {
  const { organizationId, leadId, customerId, conversationId } = context;

  return tool(
    async (input: UpdateMeetingInput) => {
      console.log(`[Tool:update_meeting] Org ${organizationId} input:`, input);

      let targetLeadId = leadId;
      let targetCustomerId = customerId;

      if ((!targetLeadId || !targetCustomerId) && conversationId) {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { leadId: true, lead: { select: { customerId: true } } },
        });
        if (!targetLeadId) targetLeadId = conv?.leadId;
        if (!targetCustomerId) targetCustomerId = conv?.lead?.customerId;
      }

      // Fetch lead to get customer linkage
      let leadRecord: any = null;
      if (targetLeadId) {
        leadRecord = await prisma.lead.findFirst({
          where: { id: targetLeadId, organizationId, isDeleted: false },
          include: { customer: true },
        });
        if (leadRecord && !targetCustomerId) {
          targetCustomerId = leadRecord.customerId;
        }
      }

      let meeting = null;

      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      if (input.meetingId) {
        try {
          if (isUuid(input.meetingId)) {
            meeting = await prisma.meeting.findFirst({
              where: { id: input.meetingId, organizationId, isDeleted: false },
            });
          } else {
            meeting = await prisma.meeting.findFirst({
              where: { meetingCode: input.meetingId, organizationId, isDeleted: false },
            });
          }
        } catch (err: any) {
          console.warn("[Tool:update_meeting] Lookup by meetingId note:", err?.message);
        }
      }

      if (!meeting) {
        const orFilters: Prisma.MeetingWhereInput[] = [];
        if (targetLeadId) orFilters.push({ leadId: targetLeadId });
        if (targetCustomerId) orFilters.push({ customerId: targetCustomerId });
        if (leadRecord?.customer?.phone) {
          orFilters.push({ customer: { phone: leadRecord.customer.phone } });
          orFilters.push({ attendees: { some: { phone: leadRecord.customer.phone } } });
        }

        if (orFilters.length > 0) {
          // Priority 1: Active / Scheduled / Confirmed / Rescheduled / In-Progress meeting
          meeting = await prisma.meeting.findFirst({
            where: {
              organizationId,
              isDeleted: false,
              OR: orFilters,
              status: {
                in: [
                  MeetingStatus.SCHEDULED,
                  MeetingStatus.CONFIRMED,
                  MeetingStatus.RESCHEDULED,
                  MeetingStatus.IN_PROGRESS,
                ],
              },
            },
            orderBy: { createdAt: "desc" },
          });

          // Priority 2: Any CANCELLED meeting
          if (!meeting) {
            meeting = await prisma.meeting.findFirst({
              where: {
                organizationId,
                isDeleted: false,
                OR: orFilters,
                status: MeetingStatus.CANCELLED,
              },
              orderBy: { createdAt: "desc" },
            });
          }

          // Priority 3: Any non-completed meeting
          if (!meeting) {
            meeting = await prisma.meeting.findFirst({
              where: {
                organizationId,
                isDeleted: false,
                OR: orFilters,
                status: { not: MeetingStatus.COMPLETED },
              },
              orderBy: { createdAt: "desc" },
            });
          }
        }
      }

      if (!meeting) {
        return {
          success: false,
          message: "No existing scheduled or cancelled meeting was found to update.",
        };
      }

      const { meetingDate, startTime, endTime } = parseMeetingTimings(
        input.meetingDate,
        input.startTime,
        input.durationMinutes ?? 30,
      );

      const prevStatus = meeting.status;
      const nextStatus = MeetingStatus.SCHEDULED;

      const data: any = {
        meetingDate,
        startTime,
        endTime,
        durationMinutes: input.durationMinutes ?? 30,
        status: nextStatus,
        cancellationReason: null,
        customFields: {
          ...(typeof meeting.customFields === "object" && meeting.customFields ? meeting.customFields : {}),
          updatedVia: "AI_WHATSAPP_ASSISTANT",
          updatedAt: new Date().toISOString(),
          previousStatus: prevStatus,
        },
      };

      if (input.agenda) data.agenda = input.agenda;
      if (input.locationName) data.locationName = input.locationName;
      if (input.locationAddress) data.locationAddress = input.locationAddress;

      const updated = await prisma.meeting.update({
        where: { id: meeting.id },
        data,
      });

      // Recalculate pre-meeting reminder sequence
      meetingFollowUpService
        .onMeetingRescheduled(organizationId, updated.id)
        .catch((err) =>
          console.error(`[AI Update Meeting Tool] Error recalculating reminders for meeting ${updated.id}:`, err?.message || err),
        );

      const formattedDate = startTime.toLocaleDateString("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Kolkata",
      });
      const formattedTime = startTime.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      });

      if (targetLeadId || meeting.leadId) {
        try {
          await prisma.leadActivity.create({
            data: {
              organizationId,
              leadId: targetLeadId || meeting.leadId!,
              type: "MEETING",
              title: `Meeting Rescheduled: ${updated.title}`,
              description: `Meeting rescheduled for ${formattedDate} at ${formattedTime}. Code: ${updated.meetingCode}`,
              metadata: {
                meetingId: updated.id,
                meetingCode: updated.meetingCode,
                startTime: startTime.toISOString(),
                isRescheduled: true,
                previousStatus: prevStatus,
                bookedVia: "AI_WHATSAPP_ASSISTANT",
              } as any,
            },
          });
        } catch (actErr: any) {
          console.warn("[Tool:update_meeting] Lead activity log note:", actErr?.message);
        }
      }

      return {
        success: true,
        message: `Meeting ${updated.meetingCode} updated/rescheduled successfully in CRM to ${formattedDate} at ${formattedTime}.`,
        meetingId: updated.id,
        meetingCode: updated.meetingCode,
        title: updated.title,
        scheduledDate: formattedDate,
        scheduledTime: formattedTime,
        status: updated.status,
        note: "Inform the customer politely that their meeting has been updated/rescheduled to this new date and time.",
      };
    },
    {
      name: "update_meeting",
      description:
        "Updates or reschedules the date, time, agenda or location of an existing upcoming or future meeting. If a meeting was cancelled for a future date, this reactivates and reschedules it to the new date and time.",
      schema: updateMeetingSchema,
    },
  );
}

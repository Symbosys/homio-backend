import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  LeadStatus,
  MeetingStatus,
  MeetingType,
  Prisma,
} from "../../../types/types.js";
import { leadFollowUpService } from "../../../module/auto-followup/services/lead-followup.service.js";
import { meetingFollowUpService } from "../../../module/auto-followup/services/meeting-followup.service.js";

/**
 * Contextual metadata injected when creating the tool instance for a specific tenant conversation.
 */
export interface MeetingToolContext {
  organizationId: string;
  leadId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
}

/**
 * Helper to generate a unique meeting tracking code (e.g., MTG-2026-104928).
 */
function generateMeetingCode(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `MTG-${year}-${randomSuffix}`;
}

/**
 * Helper to safely parse date and time strings into valid Date objects.
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
    // Fallback if relative or parse issue
    baseDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  let targetYear = baseDate.getFullYear();
  const targetMonth = baseDate.getMonth();

  // If year is in the past (e.g. 2023, 2024), reset to currentYear
  if (targetYear < currentYear) {
    targetYear = currentYear;
  }

  // If target year is current year, but requested month has already passed in the current year
  // (e.g. today is Dec/Oct and requested is Jan/Feb), roll over to next year
  if (targetYear === currentYear && targetMonth < currentMonth) {
    targetYear = currentYear + 1;
  }

  baseDate.setFullYear(targetYear);

  // Set meetingDate to 00:00:00 UTC/Local
  const meetingDate = new Date(targetYear, baseDate.getMonth(), baseDate.getDate());

  let startTime = new Date(targetYear, baseDate.getMonth(), baseDate.getDate(), 11, 0, 0);

  if (startTimeStr) {
    // Check if ISO or contains time portion (e.g. 14:30 or 2:30 PM)
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
      const parsedTime = new Date(startTimeStr);
      if (!isNaN(parsedTime.getTime())) {
        startTime = new Date(
          targetYear,
          baseDate.getMonth(),
          baseDate.getDate(),
          parsedTime.getHours(),
          parsedTime.getMinutes(),
          0,
        );
      }
    }
  }

  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  return { meetingDate, startTime, endTime };
}

/**
 * Zod validation schema for scheduling a meeting with a lead/customer.
 */
export const scheduleMeetingSchema = z.object({
  title: z
    .string()
    .optional()
    .describe(
      "A suitable title for the meeting (e.g. 'Concept Design Consultation', 'Interior Requirement Discussion & Estimation', '3BHK Interior Consultation').",
    ),
  meetingId: z.string().optional().describe("Existing meeting ID to update; if provided, the tool will update the meeting instead of creating a new one."),
  meetingType: z
    .enum(["ONLINE", "OFFLINE", "SITE_VISIT"])
    .default("ONLINE")
    .describe(
      "Mode of meeting: 'ONLINE' for Online video meeting, 'OFFLINE' for In-person office meeting, 'SITE_VISIT' for on-site property visit.",
    ),
  meetingDate: z
    .string()
    .describe(
      "The date for the meeting in YYYY-MM-DD format or recognizable date (e.g. '2026-10-08', '2026-10-12').",
    ),
  startTime: z
    .string()
    .optional()
    .describe(
      "The time for the meeting (e.g. '11:00 AM', '15:30', '4:00 PM', or ISO timestamp).",
    ),
  durationMinutes: z
    .number()
    .default(30)
    .describe("Duration of the meeting in minutes (default is 30)."),
  agenda: z
    .string()
    .optional()
    .describe("Brief agenda or focus items to discuss during the consultation."),
  locationName: z
    .string()
    .optional()
    .describe("Office name or site name for in-person/offline meetings (e.g. 'Homio Design Studio / Office')."),
  locationAddress: z
    .string()
    .optional()
    .describe("Physical address for in-person office or site meetings."),
});

export type ScheduleMeetingInput = z.infer<typeof scheduleMeetingSchema>;

/**
 * Creates a LangChain Dynamic Structured Tool for autonomously scheduling and booking meetings.
 *
 * @param context - Scoped tenant execution context
 */
export function createScheduleMeetingTool(context: MeetingToolContext) {
  const { organizationId, leadId, customerId, conversationId } = context;

  return tool(
    async (input: ScheduleMeetingInput) => {
      console.log(
        `[Tool:schedule_meeting] Invoked for Org "${organizationId}", Lead "${leadId}", Customer "${customerId}" with input:`,
        input,
      );

      let targetLeadId = leadId;
      let targetCustomerId = customerId;

      // Resolve leadId and customerId from conversation if missing
      if ((!targetLeadId || !targetCustomerId) && conversationId) {
        const conv = await prisma.conversation.findUnique({
          where: { id: conversationId },
          select: { leadId: true, lead: { select: { customerId: true } } },
        });
        if (!targetLeadId) targetLeadId = conv?.leadId;
        if (!targetCustomerId) targetCustomerId = conv?.lead?.customerId;
      }

      // Fetch lead to get customer linkage and title if needed
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

      const { meetingDate, startTime, endTime } = parseMeetingTimings(
        input.meetingDate,
        input.startTime,
        input.durationMinutes || 30,
      );

      const meetingCode = generateMeetingCode();
      const clientName = leadRecord?.customer?.displayName || leadRecord?.customer?.firstName || "Customer";
      const meetingTitle =
        input.title?.trim() ||
        `${clientName} - ${input.meetingType === "ONLINE" ? "Online Consultation" : "Office Meeting"}`;

      const meetingTypeEnum =
        input.meetingType === "OFFLINE"
          ? MeetingType.OFFLINE
          : input.meetingType === "SITE_VISIT"
          ? MeetingType.SITE_VISIT
          : MeetingType.ONLINE;

      // Check if there is an existing scheduled meeting OR a cancelled meeting for this lead/customer
      let existingMeeting = null;

      const isUuid = (val?: string | null) =>
        Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

      // 1. If explicit meetingId passed
      if (input.meetingId) {
        try {
          if (isUuid(input.meetingId)) {
            existingMeeting = await prisma.meeting.findFirst({
              where: { id: input.meetingId, organizationId, isDeleted: false },
            });
          } else {
            existingMeeting = await prisma.meeting.findFirst({
              where: { meetingCode: input.meetingId, organizationId, isDeleted: false },
            });
          }
        } catch (err: any) {
          console.warn("[Tool:schedule_meeting] Lookup by meetingId note:", err?.message);
        }
      }

      // 2. Search for any existing meeting for this lead / customer / phone
      if (!existingMeeting) {
        const orFilters: Prisma.MeetingWhereInput[] = [];
        if (targetLeadId) orFilters.push({ leadId: targetLeadId });
        if (targetCustomerId) orFilters.push({ customerId: targetCustomerId });
        if (leadRecord?.customer?.phone) {
          orFilters.push({ customer: { phone: leadRecord.customer.phone } });
          orFilters.push({ attendees: { some: { phone: leadRecord.customer.phone } } });
        }

        if (orFilters.length > 0) {
          // Priority 1: Active / Scheduled / Confirmed / Rescheduled / In-Progress meeting
          existingMeeting = await prisma.meeting.findFirst({
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
          if (!existingMeeting) {
            existingMeeting = await prisma.meeting.findFirst({
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
          if (!existingMeeting) {
            existingMeeting = await prisma.meeting.findFirst({
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

      let meeting;
      let isUpdated = false;

      if (existingMeeting) {
        // Update / Reschedule Existing Upcoming or Future Cancelled Meeting
        isUpdated = true;
        const prevStatus = existingMeeting.status;
        const nextStatus =
          prevStatus === MeetingStatus.CANCELLED
            ? MeetingStatus.SCHEDULED
            : MeetingStatus.SCHEDULED;

        meeting = await prisma.meeting.update({
          where: { id: existingMeeting.id },
          data: {
            title: meetingTitle,
            description:
              input.agenda ||
              `Consultation meeting rescheduled/updated autonomously by AI assistant for ${clientName}.`,
            agenda: input.agenda || existingMeeting.agenda || "Initial concept design & requirement discussion",
            type: meetingTypeEnum,
            status: nextStatus,
            meetingDate,
            startTime,
            endTime,
            durationMinutes: input.durationMinutes || existingMeeting.durationMinutes || 30,
            timezone: "Asia/Kolkata",
            leadId: targetLeadId || undefined,
            customerId: targetCustomerId || undefined,
            meetingProvider: meetingTypeEnum === MeetingType.ONLINE ? "ONLINE" : null,
            locationName:
              meetingTypeEnum === MeetingType.OFFLINE
                ? input.locationName || existingMeeting.locationName || "Homio Design Studio / Office"
                : meetingTypeEnum === MeetingType.SITE_VISIT
                ? input.locationName || existingMeeting.locationName || leadRecord?.propertyName || "Client Site"
                : null,
            locationAddress:
              input.locationAddress || existingMeeting.locationAddress || leadRecord?.propertyAddress || null,
            locationCity: leadRecord?.propertyCity || existingMeeting.locationCity || null,
            cancellationReason: null,
            customFields: {
              ...(typeof existingMeeting.customFields === "object" && existingMeeting.customFields ? existingMeeting.customFields : {}),
              updatedVia: "AI_WHATSAPP_ASSISTANT",
              updatedAt: new Date().toISOString(),
              previousStatus: prevStatus,
            } as Prisma.InputJsonValue,
          },
        });

        // Log Reschedule / Update Activity
        if (targetLeadId) {
          try {
            await prisma.leadActivity.create({
              data: {
                organizationId,
                leadId: targetLeadId,
                type: "MEETING",
                title: `Meeting Rescheduled: ${meetingTitle}`,
                description: `${input.meetingType} meeting rescheduled to ${startTime.toLocaleString(
                  "en-IN",
                  { timeZone: "Asia/Kolkata" },
                )}. Meeting Code: ${existingMeeting.meetingCode}`,
                metadata: {
                  meetingId: existingMeeting.id,
                  meetingCode: existingMeeting.meetingCode,
                  meetingType: input.meetingType,
                  startTime: startTime.toISOString(),
                  isRescheduled: true,
                  previousStatus: prevStatus,
                  bookedVia: "AI_WHATSAPP_ASSISTANT",
                } as any,
              },
            });
          } catch (actErr: any) {
            console.warn("[Tool:schedule_meeting] Lead activity log note:", actErr?.message);
          }
        }
      } else {
        // 1. Create the Meeting Record in Database
        meeting = await prisma.meeting.create({
          data: {
            organizationId,
            meetingCode,
            title: meetingTitle,
            description:
              input.agenda ||
              `Consultation meeting booked autonomously by AI assistant for ${clientName}.`,
            agenda: input.agenda || "Initial concept design & requirement discussion",
            type: meetingTypeEnum,
            status: MeetingStatus.SCHEDULED,
            meetingDate,
            startTime,
            endTime,
            durationMinutes: input.durationMinutes || 30,
            timezone: "Asia/Kolkata",
            leadId: targetLeadId || null,
            customerId: targetCustomerId || null,
            meetingProvider: meetingTypeEnum === MeetingType.ONLINE ? "ONLINE" : null,
            locationName:
              meetingTypeEnum === MeetingType.OFFLINE
                ? input.locationName || "Homio Design Studio / Office"
                : meetingTypeEnum === MeetingType.SITE_VISIT
                ? input.locationName || leadRecord?.propertyName || "Client Site"
                : null,
            locationAddress: input.locationAddress || leadRecord?.propertyAddress || null,
            locationCity: leadRecord?.propertyCity || null,
            customFields: {
              bookedVia: "AI_WHATSAPP_ASSISTANT",
              bookedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });

        // 2. Advance Lead status if applicable
        if (targetLeadId && leadRecord) {
          try {
            const nextLeadStatus =
              meetingTypeEnum === MeetingType.SITE_VISIT
                ? LeadStatus.SITE_VISIT_SCHEDULED
                : leadRecord.status === LeadStatus.NEW || leadRecord.status === LeadStatus.CONTACTED
                ? LeadStatus.QUALIFIED
                : leadRecord.status;

            await prisma.lead.update({
              where: { id: targetLeadId },
              data: { status: nextLeadStatus },
            });

            // 3. Log Lead Activity
            await prisma.leadActivity.create({
              data: {
                organizationId,
                leadId: targetLeadId,
                type: "MEETING",
                title: `Meeting Scheduled: ${meetingTitle}`,
                description: `${input.meetingType} meeting scheduled for ${startTime.toLocaleString(
                  "en-IN",
                  { timeZone: "Asia/Kolkata" },
                )}. Meeting Code: ${meetingCode}`,
                metadata: {
                  meetingId: meeting.id,
                  meetingCode,
                  meetingType: input.meetingType,
                  startTime: startTime.toISOString(),
                  bookedVia: "AI_WHATSAPP_ASSISTANT",
                } as any,
              },
            });
          } catch (leadUpdateErr: any) {
            console.warn("[Tool:schedule_meeting] Lead status/activity note:", leadUpdateErr?.message);
          }
        }
      }

      // 4. Trigger Auto Follow-Up Lifecycle Integrations
      if (isUpdated) {
        meetingFollowUpService
          .onMeetingRescheduled(organizationId, meeting.id)
          .catch((err) =>
            console.error(`[AI Meeting Tool] Error recalculating reminders for meeting ${meeting.id}:`, err?.message || err),
          );
      } else {
        if (targetLeadId) {
          leadFollowUpService
            .stopLeadFollowUp(organizationId, targetLeadId, "Meeting scheduled via AI assistant")
            .catch((err) =>
              console.error(`[AI Meeting Tool] Error stopping lead follow-up for lead ${targetLeadId}:`, err?.message || err),
            );
        }
        meetingFollowUpService
          .enrollMeeting(organizationId, meeting.id)
          .catch((err) =>
            console.error(`[AI Meeting Tool] Error enrolling meeting ${meeting.id}:`, err?.message || err),
          );
      }

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

      return {
        success: true,
        message: isUpdated
          ? `Meeting ${meeting.meetingCode} updated/rescheduled successfully in CRM!`
          : `Meeting booked successfully in CRM! Code: ${meeting.meetingCode}`,
        meetingId: meeting.id,
        meetingCode: meeting.meetingCode,
        title: meeting.title,
        meetingType: input.meetingType,
        scheduledDate: formattedDate,
        scheduledTime: formattedTime,
        status: meeting.status,
        isUpdated,
        note: isUpdated
          ? "Inform the customer politely that their meeting has been updated/rescheduled to this new date and time."
          : "Inform the customer politely that their meeting is scheduled for this date and time, and our team will contact them shortly.",
      };
    },
    {
      name: "schedule_meeting",
      description:
        "Schedules and books an in-person office meeting or online consultation meeting with our expert design team for the client. Call this tool when the customer confirms their preferred date and time for a meeting.",
      schema: scheduleMeetingSchema,
    },
  );
}

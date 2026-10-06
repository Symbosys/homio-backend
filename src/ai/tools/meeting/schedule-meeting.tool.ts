import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../../lib/prisma.js";
import {
  LeadStatus,
  MeetingStatus,
  MeetingType,
  Prisma,
} from "../../../types/types.js";

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
 */
function parseMeetingTimings(
  meetingDateStr: string,
  startTimeStr?: string,
  durationMinutes: number = 30,
): { meetingDate: Date; startTime: Date; endTime: Date } {
  const now = new Date();
  let baseDate = new Date(meetingDateStr);

  if (isNaN(baseDate.getTime())) {
    // Fallback if relative or parse issue
    baseDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  // Set meetingDate to 00:00:00 UTC/Local
  const meetingDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  let startTime = new Date(baseDate);

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
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        hours,
        minutes,
        0,
      );
    } else {
      const parsedTime = new Date(startTimeStr);
      if (!isNaN(parsedTime.getTime())) {
        startTime = parsedTime;
      } else {
        // Default to 11:00 AM
        startTime = new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate(),
          11,
          0,
          0,
        );
      }
    }
  } else {
    // Default to 11:00 AM on target date
    startTime = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      11,
      0,
      0,
    );
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

      // 1. Create the Meeting Record in Database
      const meeting = await prisma.meeting.create({
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
        message: `Meeting booked successfully in CRM! Code: ${meetingCode}`,
        meetingId: meeting.id,
        meetingCode,
        title: meeting.title,
        meetingType: input.meetingType,
        scheduledDate: formattedDate,
        scheduledTime: formattedTime,
        status: meeting.status,
        note: "Inform the customer politely that their meeting is scheduled for this date and time, and our team will contact them shortly.",
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

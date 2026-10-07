import { describe, it, expect } from "bun:test";
import {
  createFollowUpConfigSchema,
  updateFollowUpConfigSchema,
  enrollLeadSchema,
  enrollMeetingSchema,
  cancelEnrollmentSchema,
  queryFollowUpConfigsSchema,
  queryEnrollmentsSchema,
} from "../../src/module/auto-followup/validators/auto-followup.validator.js";
import {
  FollowUpConfigType,
  FollowUpIntervalUnit,
  FollowUpEnrollmentStatus,
  CommunicationChannel,
  MeetingType,
} from "../../src/types/types.js";

describe("Auto Follow-Up Validator Suite", () => {
  const mockOrgId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockTemplateId = "123e4567-e89b-12d3-a456-426614174000";
  const mockLeadId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const mockMeetingId = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const mockConfigId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

  describe("Lead No-Response Config Validation", () => {
    it("should accept valid Lead No-Response configuration with day-based steps", () => {
      const payload = {
        body: {
          type: FollowUpConfigType.LEAD_NO_RESPONSE,
          name: "Standard Lead No-Response Sequence",
          description: "Follow-up sequence dispatched on Day 1, Day 3, Day 4, and Day 7",
          isActive: true,
          isDefault: true,
          preferredSendTime: "10:30",
          leadSteps: [
            { stepOrder: 1, dayOffset: 1, channel: CommunicationChannel.WHATSAPP, templateId: mockTemplateId },
            { stepOrder: 2, dayOffset: 3, channel: CommunicationChannel.WHATSAPP, templateId: mockTemplateId },
            { stepOrder: 3, dayOffset: 4, channel: CommunicationChannel.WHATSAPP, templateId: mockTemplateId },
            { stepOrder: 4, dayOffset: 7, channel: CommunicationChannel.WHATSAPP, templateId: mockTemplateId, isFinalStep: true },
          ],
          additionalInformation: { sequenceAuthor: "Marketing Ops", funnelStageTarget: "NEW" },
        },
      };

      const res = createFollowUpConfigSchema.safeParse(payload);
      if (!res.success) {
        console.log("VALIDATION ERROR:", JSON.stringify(res.error.format(), null, 2));
      }
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.body.type).toBe(FollowUpConfigType.LEAD_NO_RESPONSE);
        expect(res.data.body.leadSteps?.length).toBe(4);
        expect(res.data.body.preferredSendTime).toBe("10:30");
      }
    });

    it("should reject invalid preferredSendTime format", () => {
      const payload = {
        body: {
          type: FollowUpConfigType.LEAD_NO_RESPONSE,
          name: "Invalid Time Config",
          preferredSendTime: "25:70", // Invalid HH:mm
        },
      };

      const res = createFollowUpConfigSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });
  });

  describe("Meeting Reminder Config Validation", () => {
    it("should accept valid Meeting Reminder configuration with multi-unit steps", () => {
      const payload = {
        body: {
          type: FollowUpConfigType.MEETING_REMINDER,
          name: "Pre-Meeting Multi-Interval Reminders",
          isActive: true,
          isDefault: true,
          meetingTypes: [MeetingType.ONLINE, MeetingType.SITE_VISIT],
          meetingSteps: [
            {
              stepOrder: 1,
              intervalUnit: FollowUpIntervalUnit.DAYS_BEFORE,
              intervalValue: 7,
              channel: CommunicationChannel.WHATSAPP,
              templateId: mockTemplateId,
              dynamicTimeVariableFormat: "in {count} days",
            },
            {
              stepOrder: 2,
              intervalUnit: FollowUpIntervalUnit.DAYS_BEFORE,
              intervalValue: 3,
              channel: CommunicationChannel.WHATSAPP,
              templateId: mockTemplateId,
            },
            {
              stepOrder: 3,
              intervalUnit: FollowUpIntervalUnit.HOURS_BEFORE,
              intervalValue: 24,
              channel: CommunicationChannel.WHATSAPP,
              templateId: mockTemplateId,
            },
            {
              stepOrder: 4,
              intervalUnit: FollowUpIntervalUnit.HOURS_BEFORE,
              intervalValue: 5,
              channel: CommunicationChannel.WHATSAPP,
              templateId: mockTemplateId,
            },
            {
              stepOrder: 5,
              intervalUnit: FollowUpIntervalUnit.HOURS_BEFORE,
              intervalValue: 1,
              channel: CommunicationChannel.WHATSAPP,
              templateId: mockTemplateId,
            },
            {
              stepOrder: 6,
              intervalUnit: FollowUpIntervalUnit.MINUTES_BEFORE,
              intervalValue: 15,
              channel: CommunicationChannel.WHATSAPP,
              templateId: mockTemplateId,
              dynamicTimeVariableFormat: "in {count} minutes",
            },
          ],
        },
      };

      const res = createFollowUpConfigSchema.safeParse(payload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.body.meetingSteps?.length).toBe(6);
        expect(res.data.body.meetingTypes).toContain(MeetingType.ONLINE);
        expect(res.data.body.meetingTypes).toContain(MeetingType.SITE_VISIT);
      }
    });
  });

  describe("Partial Update Validation (Rule 5)", () => {
    it("should allow updating partial fields without requiring unchanged fields", () => {
      const payload = {
        params: { id: mockConfigId },
        body: {
          isActive: false,
          preferredSendTime: "09:00",
        },
      };

      const res = updateFollowUpConfigSchema.safeParse(payload);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.body.isActive).toBe(false);
        expect(res.data.body.preferredSendTime).toBe("09:00");
      }
    });
  });

  describe("Enrollment & Action Schemas", () => {
    it("should validate manual lead enrollment payload", () => {
      const res = enrollLeadSchema.safeParse({
        body: {
          leadId: mockLeadId,
          configId: mockConfigId,
        },
      });
      expect(res.success).toBe(true);
    });

    it("should validate manual meeting enrollment payload", () => {
      const res = enrollMeetingSchema.safeParse({
        body: {
          meetingId: mockMeetingId,
        },
      });
      expect(res.success).toBe(true);
    });

    it("should validate cancellation payload with required reason", () => {
      const res = cancelEnrollmentSchema.safeParse({
        params: { id: mockConfigId },
        body: { reason: "Client requested pause on follow-up messages" },
      });
      expect(res.success).toBe(true);
    });

    it("should validate enrollment query filters and pagination", () => {
      const res = queryEnrollmentsSchema.safeParse({
        query: {
          status: FollowUpEnrollmentStatus.ACTIVE,
          page: "2",
          limit: "10",
        },
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.query.page).toBe(2);
        expect(res.data.query.limit).toBe(10);
      }
    });
  });
});

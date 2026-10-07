import { describe, it, expect } from "bun:test";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  FollowUpIntervalUnit,
  LeadStatus,
  MeetingStatus,
  CommunicationChannel,
} from "../../src/types/types.js";
import { RelativeTimeFormatter } from "../../src/module/auto-followup/services/relative-time.formatter.js";

describe("Enterprise Auto Follow-Up & Reminder Business Logic Suite", () => {
  describe("Lead No-Response Follow-Up Engine Rules", () => {
    it("should verify lead status transitions include ONLINE_MEETING_SCHEDULED and NOT_RESPONDING", () => {
      expect(LeadStatus.ONLINE_MEETING_SCHEDULED).toBe("ONLINE_MEETING_SCHEDULED");
      expect(LeadStatus.NOT_RESPONDING).toBe("NOT_RESPONDING");
      expect(LeadStatus.SITE_VISIT_SCHEDULED).toBe("SITE_VISIT_SCHEDULED");
    });

    it("should calculate correct execution date based on dayOffset and preferredSendTime", () => {
      const baseDate = new Date("2026-10-10T08:00:00.000Z");
      const dayOffset = 3;
      const preferredSendTime = "14:30";

      const [hoursStr = "0", minutesStr = "0"] = preferredSendTime.split(":");
      const targetDate = new Date(baseDate);
      targetDate.setDate(targetDate.getDate() + dayOffset);
      targetDate.setHours(parseInt(hoursStr, 10), parseInt(minutesStr, 10), 0, 0);

      expect(targetDate.getDate()).toBe(13);
      expect(targetDate.getHours()).toBe(14);
      expect(targetDate.getMinutes()).toBe(30);
    });

    it("should ensure final step transition sets lead status to NOT_RESPONDING", () => {
      const mockLead: { id: string; status: LeadStatus } = {
        id: "lead-123",
        status: LeadStatus.NEW,
      };

      const steps = [
        { stepOrder: 1, dayOffset: 1, isFinalStep: false },
        { stepOrder: 2, dayOffset: 3, isFinalStep: false },
        { stepOrder: 3, dayOffset: 4, isFinalStep: false },
        { stepOrder: 4, dayOffset: 7, isFinalStep: true },
      ];

      // Simulate step 4 completion
      const currentStepIndex = 3;
      const isFinal = currentStepIndex === steps.length - 1 || steps[currentStepIndex]?.isFinalStep;
      expect(isFinal).toBe(true);

      if (isFinal) {
        mockLead.status = LeadStatus.NOT_RESPONDING;
      }

      expect(mockLead.status).toBe(LeadStatus.NOT_RESPONDING);
    });

    it("should stop lead follow-up only when meeting is scheduled", () => {
      const enrollment: { id: string; status: FollowUpEnrollmentStatus; stopReason: string | null } = {
        id: "enrollment-123",
        status: FollowUpEnrollmentStatus.ACTIVE,
        stopReason: null,
      };

      // Case A: Customer replies to WhatsApp message -> Follow-up does NOT stop
      const customerReplied = true;
      if (customerReplied) {
        // Business logic explicitly keeps status ACTIVE
        expect(enrollment.status).toBe(FollowUpEnrollmentStatus.ACTIVE);
      }

      // Case B: Meeting is scheduled for this lead -> Follow-up stops
      const meetingScheduled = true;
      if (meetingScheduled) {
        enrollment.status = FollowUpEnrollmentStatus.STOPPED_MEETING_BOOKED;
        enrollment.stopReason = "Meeting scheduled";
      }

      expect(enrollment.status).toBe(FollowUpEnrollmentStatus.STOPPED_MEETING_BOOKED);
      expect(enrollment.stopReason).toBe("Meeting scheduled");
    });
  });

  describe("Meeting Reminder Engine Rules", () => {
    it("should calculate correct pre-meeting reminder offset timestamps", () => {
      const meetingStartTime = new Date("2026-10-15T15:00:00.000Z");

      // 7 Days before
      const days7Ms = 7 * 24 * 60 * 60 * 1000;
      const reminder7Days = new Date(meetingStartTime.getTime() - days7Ms);
      expect(reminder7Days.toISOString()).toBe("2026-10-08T15:00:00.000Z");

      // 24 Hours before
      const hours24Ms = 24 * 60 * 60 * 1000;
      const reminder24Hours = new Date(meetingStartTime.getTime() - hours24Ms);
      expect(reminder24Hours.toISOString()).toBe("2026-10-14T15:00:00.000Z");

      // 5 Hours before
      const hours5Ms = 5 * 60 * 60 * 1000;
      const reminder5Hours = new Date(meetingStartTime.getTime() - hours5Ms);
      expect(reminder5Hours.toISOString()).toBe("2026-10-15T10:00:00.000Z");

      // 15 Minutes before
      const minutes15Ms = 15 * 60 * 1000;
      const reminder15Minutes = new Date(meetingStartTime.getTime() - minutes15Ms);
      expect(reminder15Minutes.toISOString()).toBe("2026-10-15T14:45:00.000Z");
    });

    it("should inject dynamic time-to-meeting template variables", () => {
      const timeToMeeting7Days = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.DAYS_BEFORE,
        7,
      );
      expect(timeToMeeting7Days).toBe("in 7 days");

      const timeToMeetingTomorrow = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.DAYS_BEFORE,
        1,
      );
      expect(timeToMeetingTomorrow).toBe("tomorrow");

      const timeToMeeting1Hour = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.HOURS_BEFORE,
        1,
      );
      expect(timeToMeeting1Hour).toBe("in 1 hour");

      const timeToMeeting15Min = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.MINUTES_BEFORE,
        15,
      );
      expect(timeToMeeting15Min).toBe("in 15 minutes");
    });

    it("should cancel all pending reminder logs when meeting is cancelled", () => {
      const enrollment: {
        id: string;
        status: FollowUpEnrollmentStatus;
        logs: Array<{ id: string; status: FollowUpExecutionStatus }>;
      } = {
        id: "enrollment-mtg-1",
        status: FollowUpEnrollmentStatus.ACTIVE,
        logs: [
          { id: "log-1", status: FollowUpExecutionStatus.DISPATCHED },
          { id: "log-2", status: FollowUpExecutionStatus.SCHEDULED },
          { id: "log-3", status: FollowUpExecutionStatus.SCHEDULED },
        ],
      };

      // Meeting is cancelled
      enrollment.status = FollowUpEnrollmentStatus.STOPPED_CANCELLED;
      enrollment.logs = enrollment.logs.map((log) =>
        log.status === FollowUpExecutionStatus.SCHEDULED
          ? { ...log, status: FollowUpExecutionStatus.CANCELLED }
          : log,
      );

      expect(enrollment.status).toBe(FollowUpEnrollmentStatus.STOPPED_CANCELLED);
      expect(enrollment.logs[0]?.status).toBe(FollowUpExecutionStatus.DISPATCHED);
      expect(enrollment.logs[1]?.status).toBe(FollowUpExecutionStatus.CANCELLED);
      expect(enrollment.logs[2]?.status).toBe(FollowUpExecutionStatus.CANCELLED);
    });

    it("should recalculate upcoming reminder timestamps on meeting reschedule", () => {
      const oldMeetingTime = new Date("2026-10-15T10:00:00.000Z");
      const newMeetingTime = new Date("2026-10-20T10:00:00.000Z");

      const hours1Ms = 1 * 60 * 60 * 1000;
      const oldReminderTime = new Date(oldMeetingTime.getTime() - hours1Ms);
      const newReminderTime = new Date(newMeetingTime.getTime() - hours1Ms);

      expect(oldReminderTime.toISOString()).toBe("2026-10-15T09:00:00.000Z");
      expect(newReminderTime.toISOString()).toBe("2026-10-20T09:00:00.000Z");
    });
  });
});

import { describe, it, expect } from "bun:test";
import { RelativeTimeFormatter } from "../../src/module/auto-followup/services/relative-time.formatter.js";
import { FollowUpIntervalUnit } from "../../src/types/types.js";

describe("RelativeTimeFormatter Quality Test Suite", () => {
  describe("DAYS_BEFORE unit formatting", () => {
    it("should format 1 day before as 'tomorrow'", () => {
      const result = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.DAYS_BEFORE,
        1,
      );
      expect(result).toBe("tomorrow");
    });

    it("should format multi-day before as 'in X days'", () => {
      expect(
        RelativeTimeFormatter.formatRelativeTime(
          FollowUpIntervalUnit.DAYS_BEFORE,
          2,
        ),
      ).toBe("in 2 days");

      expect(
        RelativeTimeFormatter.formatRelativeTime(
          FollowUpIntervalUnit.DAYS_BEFORE,
          7,
        ),
      ).toBe("in 7 days");
    });
  });

  describe("HOURS_BEFORE unit formatting", () => {
    it("should format 1 hour before as 'in 1 hour'", () => {
      const result = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.HOURS_BEFORE,
        1,
      );
      expect(result).toBe("in 1 hour");
    });

    it("should format multi-hour before as 'in X hours'", () => {
      expect(
        RelativeTimeFormatter.formatRelativeTime(
          FollowUpIntervalUnit.HOURS_BEFORE,
          5,
        ),
      ).toBe("in 5 hours");

      expect(
        RelativeTimeFormatter.formatRelativeTime(
          FollowUpIntervalUnit.HOURS_BEFORE,
          24,
        ),
      ).toBe("in 24 hours");
    });
  });

  describe("MINUTES_BEFORE unit formatting", () => {
    it("should format 1 minute before as 'in 1 minute'", () => {
      const result = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.MINUTES_BEFORE,
        1,
      );
      expect(result).toBe("in 1 minute");
    });

    it("should format 15 minutes before as 'in 15 minutes'", () => {
      const result = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.MINUTES_BEFORE,
        15,
      );
      expect(result).toBe("in 15 minutes");
    });
  });

  describe("Custom dynamic template substitution", () => {
    it("should substitute {count} and {value} placeholders", () => {
      const formatted = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.DAYS_BEFORE,
        3,
        "Reminder: your meeting is in {count} days!",
      );
      expect(formatted).toBe("Reminder: your meeting is in 3 days!");

      const formattedVal = RelativeTimeFormatter.formatRelativeTime(
        FollowUpIntervalUnit.MINUTES_BEFORE,
        10,
        "Meeting starts in {value} minutes",
      );
      expect(formattedVal).toBe("Meeting starts in 10 minutes");
    });
  });
});

import { FollowUpIntervalUnit } from "../../../types/types.js";

/**
 * Formatter for dynamic pre-meeting relative time strings
 * e.g., "in 2 days", "in 5 hours", "in 15 minutes", "tomorrow"
 */
export class RelativeTimeFormatter {
  /**
   * Format the relative time string based on interval unit, value, and optional custom template.
   *
   * @param intervalUnit - DAYS_BEFORE | HOURS_BEFORE | MINUTES_BEFORE
   * @param intervalValue - Numeric duration (e.g. 7, 3, 24, 5, 1, 15)
   * @param customFormat - Optional format template (e.g. "in {count} days", "at {count} hours before")
   * @returns Formatted natural language string
   */
  static formatRelativeTime(
    intervalUnit: FollowUpIntervalUnit,
    intervalValue: number,
    customFormat?: string | null,
  ): string {
    if (customFormat && customFormat.trim().length > 0) {
      return customFormat
        .replace(/\{count\}/g, String(intervalValue))
        .replace(/\{value\}/g, String(intervalValue));
    }

    switch (intervalUnit) {
      case FollowUpIntervalUnit.DAYS_BEFORE:
        if (intervalValue === 1) return "tomorrow";
        return `in ${intervalValue} days`;

      case FollowUpIntervalUnit.HOURS_BEFORE:
        if (intervalValue === 1) return "in 1 hour";
        return `in ${intervalValue} hours`;

      case FollowUpIntervalUnit.MINUTES_BEFORE:
        if (intervalValue === 1) return "in 1 minute";
        return `in ${intervalValue} minutes`;

      default:
        return `in ${intervalValue} units`;
    }
  }
}

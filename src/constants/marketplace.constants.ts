/**
 * Homio CRM - Marketplace & Commission Configuration Constants
 * Centralized governance for direct B2C labour service bookings,
 * platform commission remittances, and disciplinary thresholds.
 */
export const MARKETPLACE_CONFIG = {
  /**
   * Platform Commission Percentage on final agreed Deal Value
   * Default: 10% (applicable ONLY to direct client marketplace bookings;
   * B2B organization project site bookings have 0% platform commission).
   */
  DEFAULT_COMMISSION_PERCENTAGE: 10.0,

  /**
   * Maximum tolerated payment defaults by a client before account blacklisting.
   * Flowchart: "MULTIPLE DUES - BLACKLIST"
   */
  MAX_CLIENT_PAYMENT_DUES_BEFORE_BLACKLIST: 2,

  /**
   * Maximum tolerated formal warnings for labour work abandonment before blacklisting.
   * Flowchart: "COMPANY ACTION - WARNING, BLACKLISTING"
   */
  MAX_LABOUR_WARNINGS_BEFORE_BLACKLIST: 3,

  /**
   * Score reduction applied to client's rating upon verified payment default.
   * Flowchart: "CLIENT RATING - DOWN"
   */
  CLIENT_PAYMENT_DEFAULT_RATING_PENALTY: 1.5,
  RATING_PENALTY_PAYMENT_DUE: 1.5,

  /**
   * Score reduction applied upon verified off-platform cash bypass attempt.
   */
  BYPASS_ATTEMPT_RATING_PENALTY: 2.0,
  RATING_PENALTY_BYPASS_ATTEMPT: 2.0,

  /**
   * Minimum hours after booking request/acceptance before a client can report
   * that the labour worker failed to reach the site.
   */
  DELAY_REPORT_MIN_HOURS: 24,
} as const;

export type MarketplaceConfig = typeof MARKETPLACE_CONFIG;

import { prisma } from "../../../lib/prisma.js";
import {
  GoogleCalendarIntegrationStatus,
  Prisma,
} from "../../../types/types.js";

/**
 * Public fields returned to API clients. Sensitive OAuth tokens are omitted.
 */
const publicGoogleCalendarSelect = {
  id: true,
  organizationId: true,
  status: true,
  googleEmail: true,
  googleAccountId: true,
  calendarId: true,
  calendarName: true,
  calendarTimezone: true,
  scope: true,
  accessTokenExpiresAt: true,
  tokenType: true,
  lastSyncedAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  createdById: true,
  updatedById: true,
  additionalInformation: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workEmail: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workEmail: true,
    },
  },
} satisfies Prisma.GoogleCalendarIntegrationSelect;

/**
 * Partial write payload for updating Google Calendar settings.
 */
export type GoogleCalendarSettingPatch = {
  calendarId?: string;
  calendarName?: string | null;
  calendarTimezone?: string | null;
  additionalInformation?: Prisma.InputJsonValue | null;
  updatedById?: string | null;
};

/**
 * Repository for Organization Google Calendar OAuth 2.0 Integration.
 * All database operations are strictly scoped by `organizationId`.
 */
export class GoogleCalendarIntegrationRepository {
  /**
   * Retrieves the organization's Google Calendar integration record (safe public projection).
   *
   * @param organizationId - Tenant organization ID
   */
  async findByOrganizationId(organizationId: string) {
    return prisma.googleCalendarIntegration.findUnique({
      where: { organizationId },
      select: publicGoogleCalendarSelect,
    });
  }

  /**
   * Retrieves the full integration record including raw OAuth credentials.
   * Internal use only (by the Google Calendar Service for API calls & token refresh).
   *
   * @param organizationId - Tenant organization ID
   */
  async findWithCredentials(organizationId: string) {
    return prisma.googleCalendarIntegration.findUnique({
      where: { organizationId },
    });
  }

  /**
   * Upserts the Google Calendar integration on successful OAuth code exchange.
   *
   * @param organizationId - Tenant organization ID
   * @param data - Authenticated Google account details and initial tokens
   */
  async upsertIntegration(
    organizationId: string,
    data: {
      googleEmail: string;
      googleAccountId?: string | null;
      calendarId?: string;
      calendarName?: string | null;
      calendarTimezone?: string | null;
      scope?: string | null;
      accessToken: string;
      refreshToken?: string | null;
      accessTokenExpiresAt?: Date | null;
      tokenType?: string;
      createdById?: string | null;
      additionalInformation?: Prisma.InputJsonValue | null;
    },
  ) {
    const additionalInformation =
      data.additionalInformation === undefined
        ? undefined
        : data.additionalInformation === null
          ? Prisma.JsonNull
          : data.additionalInformation;

    // Validate that createdById / updatedById exist in Employee table before writing to avoid foreign key errors
    let validCreatedById: string | null = null;
    if (data.createdById) {
      const emp = await prisma.employee.findFirst({
        where: { id: data.createdById, organizationId, isDeleted: false },
        select: { id: true },
      });
      validCreatedById = emp?.id ?? null;
    }

    return prisma.googleCalendarIntegration.upsert({
      where: { organizationId },
      create: {
        organizationId,
        status: GoogleCalendarIntegrationStatus.CONNECTED,
        googleEmail: data.googleEmail,
        googleAccountId: data.googleAccountId ?? null,
        calendarId: data.calendarId || "primary",
        calendarName: data.calendarName ?? null,
        calendarTimezone: data.calendarTimezone ?? null,
        scope: data.scope ?? null,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
        tokenType: data.tokenType || "Bearer",
        lastSyncedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        createdById: validCreatedById,
        updatedById: validCreatedById,
        additionalInformation: additionalInformation ?? Prisma.JsonNull,
      },
      update: {
        status: GoogleCalendarIntegrationStatus.CONNECTED,
        googleEmail: data.googleEmail,
        googleAccountId: data.googleAccountId ?? null,
        calendarId: data.calendarId || "primary",
        calendarName: data.calendarName ?? null,
        calendarTimezone: data.calendarTimezone ?? null,
        scope: data.scope ?? null,
        accessToken: data.accessToken,
        ...(data.refreshToken ? { refreshToken: data.refreshToken } : {}),
        accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
        tokenType: data.tokenType || "Bearer",
        lastSyncedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedById: validCreatedById,
        ...(additionalInformation !== undefined ? { additionalInformation } : {}),
      },
      select: publicGoogleCalendarSelect,
    });
  }

  /**
   * Updates refreshed access tokens and expiration timestamp.
   *
   * @param organizationId - Tenant organization ID
   * @param tokens - Refreshed credentials
   */
  async updateTokens(
    organizationId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string | null;
      accessTokenExpiresAt?: Date | null;
    },
  ) {
    return prisma.googleCalendarIntegration.update({
      where: { organizationId },
      data: {
        status: GoogleCalendarIntegrationStatus.CONNECTED,
        accessToken: tokens.accessToken,
        ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt ?? null,
        lastSyncedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      select: publicGoogleCalendarSelect,
    });
  }

  /**
   * Updates integration status and records error diagnostic metadata.
   *
   * @param organizationId - Tenant organization ID
   * @param status - Target status enum
   * @param errorCode - Error classification code
   * @param errorMessage - Error description
   */
  async updateStatus(
    organizationId: string,
    status: GoogleCalendarIntegrationStatus,
    errorCode?: string | null,
    errorMessage?: string | null,
  ) {
    return prisma.googleCalendarIntegration.update({
      where: { organizationId },
      data: {
        status,
        lastErrorCode: errorCode ?? null,
        lastErrorMessage: errorMessage ?? null,
      },
      select: publicGoogleCalendarSelect,
    });
  }

  /**
   * Updates calendar configuration settings (e.g. active calendar ID, custom fields).
   *
   * @param organizationId - Tenant organization ID
   * @param patch - Partial settings update
   */
  async updateSettings(organizationId: string, patch: GoogleCalendarSettingPatch) {
    const additionalInformation =
      patch.additionalInformation === undefined
        ? undefined
        : patch.additionalInformation === null
          ? Prisma.JsonNull
          : patch.additionalInformation;

    let validUpdatedById: string | null = null;
    if (patch.updatedById) {
      const emp = await prisma.employee.findFirst({
        where: { id: patch.updatedById, organizationId, isDeleted: false },
        select: { id: true },
      });
      validUpdatedById = emp?.id ?? null;
    }

    return prisma.googleCalendarIntegration.update({
      where: { organizationId },
      data: {
        ...(patch.calendarId !== undefined ? { calendarId: patch.calendarId } : {}),
        ...(patch.calendarName !== undefined ? { calendarName: patch.calendarName } : {}),
        ...(patch.calendarTimezone !== undefined ? { calendarTimezone: patch.calendarTimezone } : {}),
        ...(additionalInformation !== undefined ? { additionalInformation } : {}),
        ...(patch.updatedById !== undefined ? { updatedById: validUpdatedById } : {}),
      },
      select: publicGoogleCalendarSelect,
    });
  }

  /**
   * Disconnects and removes the Google Calendar integration record.
   *
   * @param organizationId - Tenant organization ID
   */
  async deleteIntegration(organizationId: string) {
    return prisma.googleCalendarIntegration.delete({
      where: { organizationId },
      select: publicGoogleCalendarSelect,
    });
  }
}

export const googleCalendarIntegrationRepo = new GoogleCalendarIntegrationRepository();

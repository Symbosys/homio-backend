import { google } from "googleapis";
import crypto from "node:crypto";
import { ENV } from "../../../config/env.js";
import {
  GoogleCalendarIntegrationStatus,
  statusCode,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import {
  generateOAuthState,
  verifyOAuthState,
} from "../../../utils/oauth-state.util.js";
import {
  googleCalendarIntegrationRepo,
  type GoogleCalendarSettingPatch,
} from "../repos/google-calendar-integration.repo.js";
import type {
  CreateCalendarEventDto,
  QueryFreeBusyDto,
  UpdateGoogleCalendarSettingsDto,
} from "../validators/google-calendar.validator.js";

/**
 * Minimum required Google Calendar and Profile OAuth Scopes.
 */
const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/**
 * Service orchestrating Google Calendar OAuth 2.0 flow, token lifecycles,
 * event scheduling, Google Meet creation, and calendar availability.
 */
export class GoogleCalendarService {
  /**
   * Instantiates a new Google OAuth2 client with configured environment credentials.
   */
  private getOAuth2Client(customRedirectUri?: string) {
    if (!ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET) {
      throw new ErrorResponse(
        "Google Calendar OAuth is not configured on this server (Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET).",
        statusCode.Internal_Server_Error,
      );
    }

    const redirectUri = customRedirectUri || ENV.GOOGLE_REDIRECT_URI;
    return new google.auth.OAuth2(
      ENV.GOOGLE_CLIENT_ID,
      ENV.GOOGLE_CLIENT_SECRET,
      redirectUri,
    );
  }

  /**
   * Generates the Google OAuth 2.0 consent authorization URL with a signed CSRF state parameter.
   *
   * @param organizationId - Tenant organization ID
   * @param employeeId - ID of employee requesting connection
   * @param returnUrl - Optional frontend redirect URL after OAuth callback
   * @returns Object containing the Google authorization URL
   */
  generateAuthUrl(
    organizationId: string,
    employeeId?: string | null,
    returnUrl?: string,
  ): { url: string; state: string } {
    const oauth2Client = this.getOAuth2Client();

    const state = generateOAuthState({
      organizationId,
      employeeId,
      returnUrl,
    });

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent", // Force consent to ensure Google returns a refresh_token
      scope: GOOGLE_CALENDAR_SCOPES,
      state,
      include_granted_scopes: true,
    });

    return { url, state };
  }

  /**
   * Handles the Google OAuth redirect callback, exchanges authorization code for tokens,
   * fetches primary calendar metadata, and persists the integration for the organization.
   *
   * @param code - Authorization code from Google redirect
   * @param state - Signed CSRF state parameter
   */
  async handleOAuthCallback(code: string, state: string) {
    if (!code) {
      throw new ErrorResponse(
        "Authorization code is missing from Google callback.",
        statusCode.Bad_Request,
      );
    }

    // 1. Verify and decode state
    const statePayload = verifyOAuthState(state);
    const { organizationId, employeeId, returnUrl } = statePayload;

    // 2. Exchange authorization code for tokens
    const oauth2Client = this.getOAuth2Client();
    let tokens;
    try {
      const response = await oauth2Client.getToken(code);
      tokens = response.tokens;
    } catch (err: any) {
      console.error("[GoogleCalendarService] Failed to exchange code:", err?.message);
      throw new ErrorResponse(
        `Failed to exchange authorization code with Google: ${err?.message || "Invalid or expired code"}`,
        statusCode.Bad_Request,
      );
    }

    if (!tokens.access_token) {
      throw new ErrorResponse(
        "Google OAuth did not return an access token.",
        statusCode.Bad_Request,
      );
    }

    oauth2Client.setCredentials(tokens);

    // 3. Identify Google account profile (email and account ID)
    let googleEmail = "unknown@gmail.com";
    let googleAccountId: string | null = null;
    try {
      const oauth2Api = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2Api.userinfo.get();
      if (userInfo.data.email) {
        googleEmail = userInfo.data.email;
      }
      if (userInfo.data.id) {
        googleAccountId = userInfo.data.id;
      }
    } catch (profileErr: any) {
      console.warn("[GoogleCalendarService] Note retrieving profile info:", profileErr?.message);
    }

    // 4. Retrieve primary calendar metadata and timezone
    let calendarName = "Primary Calendar";
    let calendarTimezone = "Asia/Kolkata";
    try {
      const calendarApi = google.calendar({ version: "v3", auth: oauth2Client });
      const primaryCal = await calendarApi.calendars.get({ calendarId: "primary" });
      if (primaryCal.data.summary) {
        calendarName = primaryCal.data.summary;
      }
      if (primaryCal.data.timeZone) {
        calendarTimezone = primaryCal.data.timeZone;
      }
    } catch (calErr: any) {
      console.warn("[GoogleCalendarService] Note retrieving primary calendar:", calErr?.message);
    }

    // 5. Persist integration record in database
    const accessTokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    const integration = await googleCalendarIntegrationRepo.upsertIntegration(
      organizationId,
      {
        googleEmail,
        googleAccountId,
        calendarId: "primary",
        calendarName,
        calendarTimezone,
        scope: Array.isArray(tokens.scope) ? tokens.scope.join(" ") : tokens.scope || null,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        accessTokenExpiresAt,
        tokenType: tokens.token_type || "Bearer",
        createdById: employeeId,
      },
    );

    return {
      integration,
      returnUrl: returnUrl || `${ENV.FRONTEND_URL}/admin/integrations?google_calendar=success`,
    };
  }

  /**
   * Programmatic code exchange endpoint (used for frontend popup / SPA flows).
   *
   * @param organizationId - Tenant organization ID
   * @param employeeId - ID of acting employee
   * @param code - Google authorization code
   * @param returnUrl - Optional return URL
   */
  async exchangeCode(
    organizationId: string,
    employeeId: string | null | undefined,
    code: string,
  ) {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      throw new ErrorResponse(
        "Google OAuth did not return an access token.",
        statusCode.Bad_Request,
      );
    }

    oauth2Client.setCredentials(tokens);

    let googleEmail = "unknown@gmail.com";
    let googleAccountId: string | null = null;
    try {
      const oauth2Api = google.oauth2({ version: "v2", auth: oauth2Client });
      const userInfo = await oauth2Api.userinfo.get();
      if (userInfo.data.email) googleEmail = userInfo.data.email;
      if (userInfo.data.id) googleAccountId = userInfo.data.id;
    } catch (profileErr: any) {
      console.warn("[GoogleCalendarService] Profile fetch note:", profileErr?.message);
    }

    let calendarName = "Primary Calendar";
    let calendarTimezone = "Asia/Kolkata";
    try {
      const calendarApi = google.calendar({ version: "v3", auth: oauth2Client });
      const primaryCal = await calendarApi.calendars.get({ calendarId: "primary" });
      if (primaryCal.data.summary) calendarName = primaryCal.data.summary;
      if (primaryCal.data.timeZone) calendarTimezone = primaryCal.data.timeZone;
    } catch (calErr: any) {
      console.warn("[GoogleCalendarService] Calendar fetch note:", calErr?.message);
    }

    const accessTokenExpiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    return googleCalendarIntegrationRepo.upsertIntegration(organizationId, {
      googleEmail,
      googleAccountId,
      calendarId: "primary",
      calendarName,
      calendarTimezone,
      scope: Array.isArray(tokens.scope) ? tokens.scope.join(" ") : tokens.scope || null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      accessTokenExpiresAt,
      tokenType: tokens.token_type || "Bearer",
      createdById: employeeId,
    });
  }

  /**
   * Retrieves an authenticated Google Calendar API client instance for the organization.
   * Checks token expiration with a 5-minute threshold and automatically refreshes tokens.
   * If Google returns `invalid_grant` or revoked permissions, marks status as `REAUTH_REQUIRED`.
   *
   * @param organizationId - Tenant organization ID
   * @returns Authenticated Google Calendar client and active integration details
   */
  async getAuthenticatedCalendarClient(organizationId: string) {
    const integration = await googleCalendarIntegrationRepo.findWithCredentials(organizationId);

    if (!integration) {
      throw new ErrorResponse(
        "Google Calendar is not connected for this organization. Please connect Google Calendar under Organization Settings.",
        statusCode.Not_Found,
      );
    }

    if (integration.status === GoogleCalendarIntegrationStatus.DISCONNECTED) {
      throw new ErrorResponse(
        "Google Calendar integration is currently disconnected. Please reconnect.",
        statusCode.Bad_Request,
      );
    }

    if (integration.status === GoogleCalendarIntegrationStatus.REAUTH_REQUIRED) {
      throw new ErrorResponse(
        "Google Calendar authorization expired or was revoked. Please reconnect Google Calendar.",
        statusCode.Unauthorized,
      );
    }

    if (!integration.accessToken) {
      throw new ErrorResponse(
        "Invalid Google Calendar credentials. Please reconnect.",
        statusCode.Unauthorized,
      );
    }

    const oauth2Client = this.getOAuth2Client();
    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken || undefined,
      token_type: integration.tokenType || "Bearer",
      expiry_date: integration.accessTokenExpiresAt
        ? integration.accessTokenExpiresAt.getTime()
        : undefined,
    });

    // Check if access token is expired or will expire in less than 5 minutes (300,000 ms)
    const isExpiringSoon =
      !integration.accessTokenExpiresAt ||
      Date.now() >= integration.accessTokenExpiresAt.getTime() - 5 * 60 * 1000;

    if (isExpiringSoon) {
      if (!integration.refreshToken) {
        await googleCalendarIntegrationRepo.updateStatus(
          organizationId,
          GoogleCalendarIntegrationStatus.REAUTH_REQUIRED,
          "NO_REFRESH_TOKEN",
          "Access token expired and no refresh token is stored. Re-authorization required.",
        );
        throw new ErrorResponse(
          "Google Calendar access token expired and no refresh token is available. Please reconnect.",
          statusCode.Unauthorized,
        );
      }

      try {
        console.log(`[GoogleCalendarService] Refreshing access token for Org "${organizationId}"...`);
        const { credentials } = await oauth2Client.refreshAccessToken();

        const newExpiresAt = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000);

        await googleCalendarIntegrationRepo.updateTokens(organizationId, {
          accessToken: credentials.access_token || integration.accessToken,
          refreshToken: credentials.refresh_token || integration.refreshToken,
          accessTokenExpiresAt: newExpiresAt,
        });

        oauth2Client.setCredentials(credentials);
      } catch (refreshErr: any) {
        console.error(
          `[GoogleCalendarService] Token refresh failed for Org "${organizationId}":`,
          refreshErr?.message,
        );

        const isRevokedOrInvalid =
          refreshErr?.message?.includes("invalid_grant") ||
          refreshErr?.response?.data?.error === "invalid_grant" ||
          refreshErr?.response?.status === 400 ||
          refreshErr?.response?.status === 401;

        if (isRevokedOrInvalid) {
          await googleCalendarIntegrationRepo.updateStatus(
            organizationId,
            GoogleCalendarIntegrationStatus.REAUTH_REQUIRED,
            "INVALID_GRANT",
            refreshErr?.message || "Refresh token revoked or invalid",
          );
          throw new ErrorResponse(
            "Google Calendar authorization has expired or was revoked by the user. Please reconnect Google Calendar.",
            statusCode.Unauthorized,
          );
        }

        throw new ErrorResponse(
          `Failed to refresh Google Calendar token: ${refreshErr?.message || "Unknown error"}`,
          statusCode.Internal_Server_Error,
        );
      }
    }

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    return { oauth2Client, calendar, integration };
  }

  /**
   * Fetches the organization's current Google Calendar integration status and metadata.
   *
   * @param organizationId - Tenant organization ID
   */
  async getIntegration(organizationId: string) {
    const integration = await googleCalendarIntegrationRepo.findByOrganizationId(organizationId);
    if (!integration) {
      return {
        isConnected: false,
        status: GoogleCalendarIntegrationStatus.DISCONNECTED,
        integration: null,
      };
    }

    return {
      isConnected: integration.status === GoogleCalendarIntegrationStatus.CONNECTED,
      status: integration.status,
      integration,
    };
  }

  /**
   * Lists all available Google Calendars for the connected account.
   *
   * @param organizationId - Tenant organization ID
   */
  async listAvailableCalendars(organizationId: string) {
    const { calendar } = await this.getAuthenticatedCalendarClient(organizationId);

    try {
      const response = await calendar.calendarList.list({
        minAccessRole: "writer",
      });

      const items = response.data.items || [];
      return items.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description || null,
        primary: cal.primary || false,
        timeZone: cal.timeZone,
        backgroundColor: cal.backgroundColor,
        accessRole: cal.accessRole,
      }));
    } catch (err: any) {
      console.error("[GoogleCalendarService] Failed to list calendars:", err?.message);
      throw new ErrorResponse(
        `Failed to fetch Google Calendars: ${err?.message || "API error"}`,
        statusCode.Bad_Request,
      );
    }
  }

  /**
   * Updates calendar settings (e.g. selected calendar ID, name, or custom additional information).
   *
   * @param organizationId - Tenant organization ID
   * @param employeeId - Acting employee ID
   * @param patch - Partial settings update
   */
  async updateSettings(
    organizationId: string,
    employeeId: string | null | undefined,
    patch: UpdateGoogleCalendarSettingsDto,
  ) {
    const existing = await googleCalendarIntegrationRepo.findByOrganizationId(organizationId);
    if (!existing) {
      throw new ErrorResponse(
        "Google Calendar integration not found.",
        statusCode.Not_Found,
      );
    }

    return googleCalendarIntegrationRepo.updateSettings(organizationId, {
      ...patch,
      updatedById: employeeId,
    });
  }

  /**
   * Tests and verifies the live connection with Google Calendar API.
   *
   * @param organizationId - Tenant organization ID
   */
  async verifyConnection(organizationId: string) {
    const { calendar, integration } = await this.getAuthenticatedCalendarClient(organizationId);

    const targetCalId = integration.calendarId || "primary";
    const calMeta = await calendar.calendars.get({ calendarId: targetCalId });

    await googleCalendarIntegrationRepo.updateSettings(organizationId, {
      calendarName: calMeta.data.summary || integration.calendarName,
      calendarTimezone: calMeta.data.timeZone || integration.calendarTimezone,
    });

    return {
      status: GoogleCalendarIntegrationStatus.CONNECTED,
      googleEmail: integration.googleEmail,
      calendarId: targetCalId,
      calendarName: calMeta.data.summary,
      calendarTimezone: calMeta.data.timeZone,
      verifiedAt: new Date(),
    };
  }

  /**
   * Disconnects the organization's Google Calendar integration and revokes OAuth tokens.
   *
   * @param organizationId - Tenant organization ID
   */
  async disconnect(organizationId: string) {
    const integration = await googleCalendarIntegrationRepo.findWithCredentials(organizationId);

    if (!integration) {
      throw new ErrorResponse(
        "Google Calendar integration not found.",
        statusCode.Not_Found,
      );
    }

    // Gracefully revoke token with Google
    if (integration.accessToken || integration.refreshToken) {
      try {
        const oauth2Client = this.getOAuth2Client();
        const tokenToRevoke = integration.refreshToken || integration.accessToken;
        if (tokenToRevoke) {
          await oauth2Client.revokeToken(tokenToRevoke);
        }
      } catch (revokeErr: any) {
        console.warn("[GoogleCalendarService] Token revocation note:", revokeErr?.message);
      }
    }

    return googleCalendarIntegrationRepo.deleteIntegration(organizationId);
  }

  /**
   * Queries Free/Busy calendar availability for scheduling meetings.
   *
   * @param organizationId - Tenant organization ID
   * @param query - Time boundaries and target calendar ID
   */
  async queryFreeBusy(organizationId: string, query: QueryFreeBusyDto) {
    const { calendar, integration } = await this.getAuthenticatedCalendarClient(organizationId);
    const targetCalendarId = query.calendarId || integration.calendarId || "primary";

    try {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: query.timeMin,
          timeMax: query.timeMax,
          timeZone: integration.calendarTimezone || "Asia/Kolkata",
          items: [{ id: targetCalendarId }],
        },
      });

      const calData = response.data.calendars?.[targetCalendarId];
      const busySlots = calData?.busy || [];

      return {
        calendarId: targetCalendarId,
        timeMin: query.timeMin,
        timeMax: query.timeMax,
        busySlots: busySlots.map((slot) => ({
          start: slot.start,
          end: slot.end,
        })),
        errors: calData?.errors || [],
      };
    } catch (err: any) {
      console.error("[GoogleCalendarService] FreeBusy query failed:", err?.message);
      throw new ErrorResponse(
        `Failed to query calendar availability: ${err?.message || "API error"}`,
        statusCode.Bad_Request,
      );
    }
  }

  /**
   * Creates a Google Calendar event with auto-generated Google Meet video conference link.
   *
   * @param organizationId - Tenant organization ID
   * @param data - Event parameters, timings, attendees, and meeting metadata
   */
  async createCalendarEvent(organizationId: string, data: CreateCalendarEventDto) {
    const { calendar, integration } = await this.getAuthenticatedCalendarClient(organizationId);
    const targetCalendarId = data.calendarId || integration.calendarId || "primary";
    const timezone = data.timezone || integration.calendarTimezone || "Asia/Kolkata";

    const eventRequestBody: any = {
      summary: data.summary,
      description: data.description || "",
      location: data.location || undefined,
      start: {
        dateTime: data.startTime,
        timeZone: timezone,
      },
      end: {
        dateTime: data.endTime,
        timeZone: timezone,
      },
      attendees: data.attendees?.map((a) => ({
        email: a.email,
        displayName: a.name || undefined,
        optional: a.optional || false,
      })),
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 },
          { method: "popup", minutes: 15 },
        ],
      },
    };

    // Auto-generate Google Meet conference link if requested
    if (data.createMeetLink) {
      eventRequestBody.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    try {
      const response = await calendar.events.insert({
        calendarId: targetCalendarId,
        requestBody: eventRequestBody,
        conferenceDataVersion: data.createMeetLink ? 1 : 0,
        sendUpdates: "all",
      });

      const event = response.data;

      // Extract Google Meet video URL
      const meetUrl =
        event.hangoutLink ||
        event.conferenceData?.entryPoints?.find(
          (entry) => entry.entryPointType === "video",
        )?.uri ||
        null;

      return {
        id: event.id,
        summary: event.summary,
        description: event.description,
        status: event.status,
        htmlLink: event.htmlLink,
        meetUrl,
        startTime: event.start?.dateTime || event.start?.date,
        endTime: event.end?.dateTime || event.end?.date,
        timezone: event.start?.timeZone,
        organizer: event.organizer,
        attendees: event.attendees,
        calendarId: targetCalendarId,
      };
    } catch (err: any) {
      console.error("[GoogleCalendarService] Failed to create event:", err?.message);
      throw new ErrorResponse(
        `Failed to schedule Google Calendar meeting: ${err?.message || "API error"}`,
        statusCode.Bad_Request,
      );
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();

import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  generateOAuthState,
  verifyOAuthState,
} from "../../src/utils/oauth-state.util.js";
import { googleCalendarService } from "../../src/module/integration/services/google-calendar.service.js";
import { googleCalendarIntegrationRepo } from "../../src/module/integration/repos/google-calendar-integration.repo.js";
import { prisma } from "../../src/lib/prisma.js";
import {
  GoogleCalendarIntegrationStatus,
} from "../../src/types/types.js";
import {
  CreateCalendarEventSchema,
  ExchangeCodeBodySchema,
  GetAuthUrlQuerySchema,
  OAuthCallbackQuerySchema,
  QueryFreeBusySchema,
  UpdateGoogleCalendarSettingsSchema,
} from "../../src/module/integration/validators/google-calendar.validator.js";

const TEST_ORG_ID = "a1111111-1111-4111-a111-111111111111";
const TEST_EMPLOYEE_ID = "e2222222-2222-4222-a222-222222222222";

describe("Google Calendar OAuth 2.0 Integration Test Suite", () => {
  // =========================================================================
  // 1. CSRF State Generation & Tamper-Proof Verification Tests
  // =========================================================================
  describe("OAuth State Utility (CSRF Protection)", () => {
    it("should generate a valid signed state with organization and employee attributes", () => {
      const state = generateOAuthState({
        organizationId: TEST_ORG_ID,
        employeeId: TEST_EMPLOYEE_ID,
        returnUrl: "http://localhost:5173/settings/integrations",
      });

      expect(state).toBeString();
      expect(state).toContain(".");

      const verified = verifyOAuthState(state);
      expect(verified.organizationId).toBe(TEST_ORG_ID);
      expect(verified.employeeId).toBe(TEST_EMPLOYEE_ID);
      expect(verified.returnUrl).toBe("http://localhost:5173/settings/integrations");
      expect(verified.nonce).toBeString();
      expect(verified.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should reject tampered state signature", () => {
      const state = generateOAuthState({ organizationId: TEST_ORG_ID });
      const [data] = state.split(".");
      const forgedState = `${data}.forgedSignature1234567890`;

      expect(() => verifyOAuthState(forgedState)).toThrow(
        "Invalid OAuth state signature - potential CSRF attempt",
      );
    });

    it("should reject expired state parameter", () => {
      // Create state with -1 minute TTL
      const expiredState = generateOAuthState({ organizationId: TEST_ORG_ID }, -1);

      expect(() => verifyOAuthState(expiredState)).toThrow(
        "OAuth state has expired",
      );
    });
  });

  // =========================================================================
  // 2. Request Validation Schemas
  // =========================================================================
  describe("Google Calendar Validator Schemas", () => {
    it("should validate GetAuthUrlQuerySchema with optional returnUrl", () => {
      const valid = GetAuthUrlQuerySchema.parse({
        returnUrl: "https://app.homiocrm.com/integrations",
      });
      expect(valid.returnUrl).toBe("https://app.homiocrm.com/integrations");
    });

    it("should validate OAuthCallbackQuerySchema", () => {
      const valid = OAuthCallbackQuerySchema.parse({
        code: "4/0AeanS0Y...",
        state: "eyJvcmciOiIxMjMifQ.sig",
      });
      expect(valid.code).toBe("4/0AeanS0Y...");
      expect(valid.state).toBe("eyJvcmciOiIxMjMifQ.sig");
    });

    it("should validate ExchangeCodeBodySchema", () => {
      const valid = ExchangeCodeBodySchema.parse({
        code: "auth_code_12345",
      });
      expect(valid.code).toBe("auth_code_12345");
    });

    it("should validate UpdateGoogleCalendarSettingsSchema", () => {
      const valid = UpdateGoogleCalendarSettingsSchema.parse({
        calendarId: "c_12345@group.calendar.google.com",
        calendarName: "Homio Sales Calendar",
        calendarTimezone: "Asia/Kolkata",
        additionalInformation: { syncMeetings: true },
      });
      expect(valid.calendarId).toBe("c_12345@group.calendar.google.com");
      expect(valid.calendarName).toBe("Homio Sales Calendar");
    });

    it("should validate QueryFreeBusySchema with valid ISO-8601 datetimes", () => {
      const valid = QueryFreeBusySchema.parse({
        timeMin: "2026-10-10T09:00:00.000Z",
        timeMax: "2026-10-10T18:00:00.000Z",
      });
      expect(valid.timeMin).toBe("2026-10-10T09:00:00.000Z");
      expect(valid.timeMax).toBe("2026-10-10T18:00:00.000Z");
    });

    it("should validate CreateCalendarEventSchema with Google Meet defaults", () => {
      const valid = CreateCalendarEventSchema.parse({
        summary: "Lead Discovery & 3BHK Turnkey Meeting",
        description: "Initial design brief consultation",
        startTime: "2026-10-12T10:00:00.000Z",
        endTime: "2026-10-12T10:45:00.000Z",
        timezone: "Asia/Kolkata",
        attendees: [{ email: "client@example.com", name: "Ramesh Gupta" }],
        createMeetLink: true,
      });

      expect(valid.summary).toBe("Lead Discovery & 3BHK Turnkey Meeting");
      expect(valid.createMeetLink).toBe(true);
      expect(valid.attendees).toHaveLength(1);
    });
  });

  // =========================================================================
  // 3. Google Calendar Service & OAuth Lifecycle Tests
  // =========================================================================
  describe("GoogleCalendarService Operations", () => {
    it("should generate Google authorization URL with offline access and required scopes", () => {
      const authData = googleCalendarService.generateAuthUrl(
        TEST_ORG_ID,
        TEST_EMPLOYEE_ID,
        "http://localhost:5173/settings",
      );

      expect(authData.url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(authData.url).toContain("access_type=offline");
      expect(authData.url).toContain("prompt=consent");
      expect(authData.url).toContain("calendar.events");
      expect(authData.url).toContain("state=");
      expect(authData.state).toBeString();
    });

    it("should handle OAuth callback, exchange code, and upsert integration", async () => {
      let upsertCalled = false;
      const state = generateOAuthState({
        organizationId: TEST_ORG_ID,
        employeeId: TEST_EMPLOYEE_ID,
      });

      // Mock OAuth2 client getToken and Google APIs
      (googleCalendarService as any).getOAuth2Client = () => ({
        getToken: async () => ({
          tokens: {
            access_token: "mock_google_access_token_xyz",
            refresh_token: "mock_google_refresh_token_abc",
            expiry_date: Date.now() + 3600 * 1000,
            token_type: "Bearer",
            scope: "https://www.googleapis.com/auth/calendar.events",
          },
        }),
        setCredentials: () => {},
      });

      googleCalendarIntegrationRepo.upsertIntegration = mock(async (orgId, data) => {
        expect(orgId).toBe(TEST_ORG_ID);
        expect(data.accessToken).toBe("mock_google_access_token_xyz");
        expect(data.refreshToken).toBe("mock_google_refresh_token_abc");
        expect(data.createdById).toBe(TEST_EMPLOYEE_ID);
        upsertCalled = true;
        return {
          id: "gcal_int_1",
          organizationId: TEST_ORG_ID,
          status: GoogleCalendarIntegrationStatus.CONNECTED,
          googleEmail: "designer@homiocrm.com",
          calendarId: "primary",
        } as any;
      });

      const result = await googleCalendarService.handleOAuthCallback("mock_auth_code_123", state);

      expect(upsertCalled).toBe(true);
      expect(result.integration.status).toBe(GoogleCalendarIntegrationStatus.CONNECTED);
    });

    it("should automatically refresh token when token is expiring soon", async () => {
      let tokenRefreshedInDb = false;

      // Mock stored integration with token expiring in 2 minutes (< 5 min threshold)
      googleCalendarIntegrationRepo.findWithCredentials = mock(async () => ({
        id: "gcal_1",
        organizationId: TEST_ORG_ID,
        status: GoogleCalendarIntegrationStatus.CONNECTED,
        googleEmail: "admin@homiocrm.com",
        calendarId: "primary",
        accessToken: "expired_access_token",
        refreshToken: "valid_refresh_token",
        accessTokenExpiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes left
      } as any));

      googleCalendarIntegrationRepo.updateTokens = mock(async (orgId, tokens) => {
        expect(orgId).toBe(TEST_ORG_ID);
        expect(tokens.accessToken).toBe("fresh_refreshed_access_token");
        tokenRefreshedInDb = true;
        return {} as any;
      });

      (googleCalendarService as any).getOAuth2Client = () => ({
        setCredentials: () => {},
        refreshAccessToken: async () => ({
          credentials: {
            access_token: "fresh_refreshed_access_token",
            refresh_token: "valid_refresh_token",
            expiry_date: Date.now() + 3600 * 1000,
          },
        }),
      });

      const client = await googleCalendarService.getAuthenticatedCalendarClient(TEST_ORG_ID);

      expect(tokenRefreshedInDb).toBe(true);
      expect(client.integration.organizationId).toBe(TEST_ORG_ID);
    });

    it("should mark integration REAUTH_REQUIRED when refresh token is revoked (invalid_grant)", async () => {
      let statusUpdatedToReauth = false;

      googleCalendarIntegrationRepo.findWithCredentials = mock(async () => ({
        id: "gcal_1",
        organizationId: TEST_ORG_ID,
        status: GoogleCalendarIntegrationStatus.CONNECTED,
        googleEmail: "admin@homiocrm.com",
        calendarId: "primary",
        accessToken: "expired_access_token",
        refreshToken: "revoked_refresh_token",
        accessTokenExpiresAt: new Date(Date.now() - 1000), // expired
      } as any));

      googleCalendarIntegrationRepo.updateStatus = mock(async (orgId, status, code) => {
        expect(orgId).toBe(TEST_ORG_ID);
        expect(status).toBe(GoogleCalendarIntegrationStatus.REAUTH_REQUIRED);
        expect(code).toBe("INVALID_GRANT");
        statusUpdatedToReauth = true;
        return {} as any;
      });

      (googleCalendarService as any).getOAuth2Client = () => ({
        setCredentials: () => {},
        refreshAccessToken: async () => {
          const err = new Error("invalid_grant: Token has been expired or revoked.");
          (err as any).response = { status: 400, data: { error: "invalid_grant" } };
          throw err;
        },
      });

      let thrownError: any = null;
      try {
        await googleCalendarService.getAuthenticatedCalendarClient(TEST_ORG_ID);
      } catch (err: any) {
        thrownError = err;
      }

      expect(statusUpdatedToReauth).toBe(true);
      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toContain("revoked");
    });

    it("should create calendar event with auto-generated Google Meet video conference link", async () => {
      googleCalendarIntegrationRepo.findWithCredentials = mock(async () => ({
        id: "gcal_1",
        organizationId: TEST_ORG_ID,
        status: GoogleCalendarIntegrationStatus.CONNECTED,
        googleEmail: "architect@homiocrm.com",
        calendarId: "primary",
        calendarTimezone: "Asia/Kolkata",
        accessToken: "valid_access_token",
        refreshToken: "valid_refresh_token",
        accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      } as any));

      (googleCalendarService as any).getOAuth2Client = () => ({
        setCredentials: () => {},
      });

      // Mock Google Calendar events.insert API
      (googleCalendarService as any).getAuthenticatedCalendarClient = async () => ({
        oauth2Client: {},
        calendar: {
          events: {
            insert: async ({ requestBody }: any) => {
              expect(requestBody.summary).toBe("Site Consultation with Mr. Rajesh");
              expect(requestBody.conferenceData).toBeDefined();
              return {
                data: {
                  id: "google_cal_event_9988",
                  summary: requestBody.summary,
                  status: "confirmed",
                  htmlLink: "https://www.google.com/calendar/event?eid=mock123",
                  hangoutLink: "https://meet.google.com/abc-defg-hij",
                  start: requestBody.start,
                  end: requestBody.end,
                  attendees: requestBody.attendees,
                },
              };
            },
          },
        },
        integration: { calendarId: "primary", calendarTimezone: "Asia/Kolkata" },
      });

      const createdEvent = await googleCalendarService.createCalendarEvent(TEST_ORG_ID, {
        summary: "Site Consultation with Mr. Rajesh",
        startTime: "2026-10-15T10:00:00.000Z",
        endTime: "2026-10-15T11:00:00.000Z",
        timezone: "Asia/Kolkata",
        attendees: [{ email: "rajesh@example.com", name: "Rajesh" }],
        createMeetLink: true,
      });

      expect(createdEvent.id).toBe("google_cal_event_9988");
      expect(createdEvent.meetUrl).toBe("https://meet.google.com/abc-defg-hij");
      expect(createdEvent.status).toBe("confirmed");
    });

    it("should query free/busy calendar intervals", async () => {
      (googleCalendarService as any).getAuthenticatedCalendarClient = async () => ({
        oauth2Client: {},
        calendar: {
          freebusy: {
            query: async ({ requestBody }: any) => ({
              data: {
                calendars: {
                  primary: {
                    busy: [
                      {
                        start: "2026-10-15T10:00:00.000Z",
                        end: "2026-10-15T11:00:00.000Z",
                      },
                      {
                        start: "2026-10-15T14:00:00.000Z",
                        end: "2026-10-15T15:00:00.000Z",
                      },
                    ],
                  },
                },
              },
            }),
          },
        },
        integration: { calendarId: "primary", calendarTimezone: "Asia/Kolkata" },
      });

      const freeBusyResult = await googleCalendarService.queryFreeBusy(TEST_ORG_ID, {
        timeMin: "2026-10-15T09:00:00.000Z",
        timeMax: "2026-10-15T18:00:00.000Z",
      });

      expect(freeBusyResult.calendarId).toBe("primary");
      expect(freeBusyResult.busySlots).toHaveLength(2);
      expect(freeBusyResult.busySlots[0]?.start).toBe("2026-10-15T10:00:00.000Z");
    });

    it("should disconnect integration and remove DB record", async () => {
      let deletedInDb = false;

      googleCalendarIntegrationRepo.findWithCredentials = mock(async () => ({
        id: "gcal_1",
        organizationId: TEST_ORG_ID,
        accessToken: "token_to_revoke",
        refreshToken: "refresh_to_revoke",
      } as any));

      googleCalendarIntegrationRepo.deleteIntegration = mock(async (orgId) => {
        expect(orgId).toBe(TEST_ORG_ID);
        deletedInDb = true;
        return {} as any;
      });

      (googleCalendarService as any).getOAuth2Client = () => ({
        revokeToken: async () => {},
      });

      await googleCalendarService.disconnect(TEST_ORG_ID);

      expect(deletedInDb).toBe(true);
    });
  });
});

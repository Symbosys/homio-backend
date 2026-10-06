import { z } from "zod";
import { GoogleCalendarIntegrationStatus } from "../../../types/types.js";

/**
 * Zod validation schema for requesting Google OAuth authorization URL.
 */
export const GetAuthUrlQuerySchema = z.object({
  returnUrl: z.string().url().optional(),
});

export type GetAuthUrlQuery = z.infer<typeof GetAuthUrlQuerySchema>;

/**
 * Zod validation schema for Google OAuth redirect callback query params.
 */
export const OAuthCallbackQuerySchema = z.object({
  code: z.string().min(1, "Authorization code is required").optional(),
  state: z.string().min(1, "OAuth state parameter is required").optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export type OAuthCallbackQuery = z.infer<typeof OAuthCallbackQuerySchema>;

/**
 * Zod validation schema for direct programmatic code exchange (e.g. from frontend SPA/popup).
 */
export const ExchangeCodeBodySchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
  state: z.string().min(1, "OAuth state is required").optional(),
  returnUrl: z.string().url().optional(),
});

export type ExchangeCodeBody = z.infer<typeof ExchangeCodeBodySchema>;

/**
 * Zod validation schema for updating calendar preferences and settings.
 */
export const UpdateGoogleCalendarSettingsSchema = z.object({
  calendarId: z.string().min(1, "Calendar ID cannot be empty").optional(),
  calendarName: z.string().max(200).optional(),
  calendarTimezone: z.string().max(100).optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type UpdateGoogleCalendarSettingsDto = z.infer<
  typeof UpdateGoogleCalendarSettingsSchema
>;

/**
 * Zod validation schema for querying Free/Busy calendar availability slots.
 */
export const QueryFreeBusySchema = z.object({
  timeMin: z.string().datetime({ message: "timeMin must be a valid ISO-8601 datetime" }),
  timeMax: z.string().datetime({ message: "timeMax must be a valid ISO-8601 datetime" }),
  calendarId: z.string().optional(),
});

export type QueryFreeBusyDto = z.infer<typeof QueryFreeBusySchema>;

/**
 * Zod validation schema for creating a Google Calendar event with optional Google Meet link.
 */
export const CreateCalendarEventSchema = z.object({
  summary: z.string().min(1, "Meeting title/summary is required").max(300),
  description: z.string().max(4000).optional(),
  startTime: z.string().datetime({ message: "startTime must be a valid ISO-8601 datetime" }),
  endTime: z.string().datetime({ message: "endTime must be a valid ISO-8601 datetime" }),
  timezone: z.string().default("Asia/Kolkata"),
  location: z.string().max(500).optional(),
  createMeetLink: z.boolean().default(true),
  calendarId: z.string().optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().email("Invalid attendee email address"),
        name: z.string().optional(),
        optional: z.boolean().optional(),
      }),
    )
    .optional()
    .default([]),
  leadId: z.string().uuid().optional(),
  meetingId: z.string().uuid().optional(),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export type CreateCalendarEventDto = z.infer<typeof CreateCalendarEventSchema>;

/**
 * Native enum representation of GoogleCalendarIntegrationStatus.
 */
export const GoogleCalendarIntegrationStatusEnum = z.nativeEnum(
  GoogleCalendarIntegrationStatus,
);

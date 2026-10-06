import type { Request, Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { ENV } from "../../../config/env.js";
import { statusCode } from "../../../types/types.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { googleCalendarService } from "../services/google-calendar.service.js";
import {
  CreateCalendarEventSchema,
  ExchangeCodeBodySchema,
  GetAuthUrlQuerySchema,
  OAuthCallbackQuerySchema,
  QueryFreeBusySchema,
  UpdateGoogleCalendarSettingsSchema,
} from "../validators/google-calendar.validator.js";

/**
 * Resolves the employee profile for audit columns. A user without an employee row is allowed.
 * @param userId Authenticated user id
 * @param organizationId Tenant id
 */
async function resolveEmployeeId(userId: string | undefined, organizationId: string) {
  if (!userId) {
    return null;
  }
  const employee = await prisma.employee.findFirst({
    where: { userId, organizationId, isDeleted: false },
    select: { id: true },
  });
  return employee?.id ?? null;
}

/**
 * @route   GET /api/v1/integrations/google-calendar/auth-url
 * @desc    Generate Google OAuth 2.0 consent authorization URL with signed state
 * @access  Authenticated (Tenant Scoped)
 */
export const getAuthUrl = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const query = GetAuthUrlQuerySchema.parse(req.query);
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);

  const result = googleCalendarService.generateAuthUrl(
    organizationId,
    employeeId,
    query.returnUrl,
  );

  return SuccessResponse(
    res,
    "Google authorization URL generated successfully",
    result,
    statusCode.OK,
  );
};

/**
 * @route   GET /api/v1/integrations/google-calendar/callback
 * @desc    Handle Google OAuth 2.0 redirect callback, exchange authorization code, and persist integration
 * @access  Public / OAuth Callback
 */
export const handleOAuthCallback = async (req: Request, res: Response) => {
  const query = OAuthCallbackQuerySchema.parse(req.query);

  // If user declined or error occurred on Google consent screen
  if (query.error) {
    console.warn("[GoogleCalendarController] OAuth error from Google:", query.error, query.error_description);
    const redirectUrl = `${ENV.FRONTEND_URL}/admin/integrations?google_calendar=error&error=${encodeURIComponent(query.error_description || query.error)}`;
    return res.redirect(redirectUrl);
  }

  if (!query.code || !query.state) {
    const redirectUrl = `${ENV.FRONTEND_URL}/admin/integrations?google_calendar=error&error=missing_code_or_state`;
    return res.redirect(redirectUrl);
  }

  try {
    const result = await googleCalendarService.handleOAuthCallback(
      query.code,
      query.state,
    );
    return res.redirect(result.returnUrl);
  } catch (err: any) {
    console.error("[GoogleCalendarController] OAuth callback exchange failed:", err?.message);
    const redirectUrl = `${ENV.FRONTEND_URL}/admin/integrations?google_calendar=error&error=${encodeURIComponent(err?.message || "oauth_exchange_failed")}`;
    return res.redirect(redirectUrl);
  }
};

/**
 * @route   POST /api/v1/integrations/google-calendar/exchange
 * @desc    Programmatic code exchange endpoint for frontend SPA / popup OAuth flows
 * @access  Authenticated (Tenant Scoped)
 */
export const exchangeCode = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const body = ExchangeCodeBodySchema.parse(req.body);
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);

  const integration = await googleCalendarService.exchangeCode(
    organizationId,
    employeeId,
    body.code,
  );

  return SuccessResponse(
    res,
    "Google Calendar connected successfully",
    integration,
    statusCode.OK,
  );
};

/**
 * @route   GET /api/v1/integrations/google-calendar
 * @desc    Get current organization's Google Calendar integration status and metadata
 * @access  Authenticated (Tenant Scoped)
 */
export const getIntegration = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const result = await googleCalendarService.getIntegration(organizationId);

  return SuccessResponse(
    res,
    "Google Calendar integration status retrieved",
    result,
    statusCode.OK,
  );
};

/**
 * @route   GET /api/v1/integrations/google-calendar/calendars
 * @desc    List available Google Calendars for the connected Google account
 * @access  Authenticated (Tenant Scoped)
 */
export const listAvailableCalendars = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const calendars = await googleCalendarService.listAvailableCalendars(organizationId);

  return SuccessResponse(
    res,
    "Available Google Calendars retrieved successfully",
    calendars,
    statusCode.OK,
  );
};

/**
 * @route   PATCH /api/v1/integrations/google-calendar
 * @desc    Update organization's Google Calendar settings (selected calendar ID, custom metadata)
 * @access  Authenticated (Tenant Scoped)
 */
export const updateSettings = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const body = UpdateGoogleCalendarSettingsSchema.parse(req.body);
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);

  const updated = await googleCalendarService.updateSettings(
    organizationId,
    employeeId,
    body,
  );

  return SuccessResponse(
    res,
    "Google Calendar settings updated successfully",
    updated,
    statusCode.OK,
  );
};

/**
 * @route   POST /api/v1/integrations/google-calendar/verify
 * @desc    Verify and test live connection with Google Calendar API
 * @access  Authenticated (Tenant Scoped)
 */
export const verifyConnection = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const result = await googleCalendarService.verifyConnection(organizationId);

  return SuccessResponse(
    res,
    "Google Calendar connection verified successfully",
    result,
    statusCode.OK,
  );
};

/**
 * @route   DELETE /api/v1/integrations/google-calendar
 * @desc    Disconnect Google Calendar integration and revoke OAuth tokens
 * @access  Authenticated (Tenant Scoped)
 */
export const disconnectIntegration = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const result = await googleCalendarService.disconnect(organizationId);

  return SuccessResponse(
    res,
    "Google Calendar disconnected successfully",
    result,
    statusCode.OK,
  );
};

/**
 * @route   POST /api/v1/integrations/google-calendar/free-busy
 * @desc    Query Free/Busy calendar availability for meeting scheduling
 * @access  Authenticated (Tenant Scoped)
 */
export const queryFreeBusy = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const body = QueryFreeBusySchema.parse(req.body);
  const result = await googleCalendarService.queryFreeBusy(organizationId, body);

  return SuccessResponse(
    res,
    "Free/busy availability retrieved successfully",
    result,
    statusCode.OK,
  );
};

/**
 * @route   POST /api/v1/integrations/google-calendar/events
 * @desc    Create a Google Calendar event with auto-generated Google Meet video conference link
 * @access  Authenticated (Tenant Scoped)
 */
export const createCalendarEvent = async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Forbidden);
  }

  const body = CreateCalendarEventSchema.parse(req.body);
  const event = await googleCalendarService.createCalendarEvent(organizationId, body);

  return SuccessResponse(
    res,
    "Google Calendar event created successfully with Google Meet link",
    event,
    statusCode.Created,
  );
};

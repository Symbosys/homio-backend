import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createCalendarEvent,
  disconnectIntegration,
  exchangeCode,
  getAuthUrl,
  getIntegration,
  handleOAuthCallback,
  listAvailableCalendars,
  queryFreeBusy,
  updateSettings,
  verifyConnection,
} from "../controllers/google-calendar.controller.js";

const router = Router();

// ==========================================
// PUBLIC GOOGLE OAUTH REDIRECT CALLBACK
// ==========================================

/**
 * @route   GET /api/v1/integrations/google-calendar/callback
 * @desc    Google OAuth 2.0 redirect callback endpoint (called by Google consent flow)
 * @access  Public
 */
router.get("/callback", handleOAuthCallback);

// ==========================================
// AUTHENTICATED TENANT-SCOPED ROUTES
// ==========================================

router.use(authenticate);

/**
 * @route   GET /api/v1/integrations/google-calendar/auth-url
 * @desc    Get Google OAuth consent URL with signed CSRF state
 * @access  Authenticated
 */
router.get("/auth-url", getAuthUrl);

/**
 * @route   POST /api/v1/integrations/google-calendar/exchange
 * @desc    Programmatic code exchange for frontend popup / SPA flows
 * @access  Authenticated
 */
router.post("/exchange", exchangeCode);

/**
 * @route   GET /api/v1/integrations/google-calendar
 * @desc    Get current organization's Google Calendar integration status and metadata
 * @access  Authenticated
 */
router.get("/", getIntegration);

/**
 * @route   GET /api/v1/integrations/google-calendar/calendars
 * @desc    List available Google Calendars in the connected account
 * @access  Authenticated
 */
router.get("/calendars", listAvailableCalendars);

/**
 * @route   PATCH /api/v1/integrations/google-calendar
 * @desc    Update organization's Google Calendar configuration (default calendar ID, custom fields)
 * @access  Authenticated
 */
router.patch("/", updateSettings);

/**
 * @route   POST /api/v1/integrations/google-calendar/verify
 * @desc    Test & verify connection with Google Calendar API
 * @access  Authenticated
 */
router.post("/verify", verifyConnection);

/**
 * @route   DELETE /api/v1/integrations/google-calendar
 * @desc    Disconnect Google Calendar and revoke OAuth tokens
 * @access  Authenticated
 */
router.delete("/", disconnectIntegration);

/**
 * @route   POST /api/v1/integrations/google-calendar/free-busy
 * @desc    Query Free/Busy availability slots for meeting scheduling
 * @access  Authenticated
 */
router.post("/free-busy", queryFreeBusy);

/**
 * @route   POST /api/v1/integrations/google-calendar/events
 * @desc    Create Google Calendar event with auto-generated Google Meet video conference link
 * @access  Authenticated
 */
router.post("/events", createCalendarEvent);

export default router;

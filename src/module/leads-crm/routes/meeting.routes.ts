import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createMeeting,
  getMeetings,
  getMeetingCalendar,
  getMeetingById,
  updateMeeting,
  updateMeetingStatus,
  rescheduleMeeting,
  updateMeetingMom,
  deleteMeeting,
  addMeetingAttendee,
  updateMeetingAttendee,
  deleteMeetingAttendee,
  uploadMeetingDocument,
  deleteMeetingDocument,
} from "../controllers/meeting.controller.js";

const meetingRoutes = Router();

// Protect all meeting routes
meetingRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/crm/meetings/calendar
 * @desc    Fetch date-range aggregated meetings for calendar / timeline schedule views
 */
meetingRoutes.get("/calendar", getMeetingCalendar);

/**
 * @route   POST /api/v1/crm/meetings
 * @desc    Schedule a new meeting (ONLINE, SITE_VISIT, OFFLINE) with initial attendees & reminders
 */
meetingRoutes.post("/", createMeeting);

/**
 * @route   GET /api/v1/crm/meetings
 * @desc    Fetch paginated list of meetings with status, type, lead, and customer filters
 */
meetingRoutes.get("/", getMeetings);

/**
 * @route   GET /api/v1/crm/meetings/:id
 * @desc    Get detailed meeting record including attendees, MOM notes, and attachments
 */
meetingRoutes.get("/:id", getMeetingById);

/**
 * @route   PATCH /api/v1/crm/meetings/:id
 * @desc    Update meeting general fields (agenda, title, location, meeting URL)
 */
meetingRoutes.patch("/:id", updateMeeting);

/**
 * @route   DELETE /api/v1/crm/meetings/:id
 * @desc    Soft-delete meeting record
 */
meetingRoutes.delete("/:id", deleteMeeting);

/**
 * @route   PATCH /api/v1/crm/meetings/:id/status
 * @desc    Transition meeting status (CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW)
 */
meetingRoutes.patch("/:id/status", updateMeetingStatus);

/**
 * @route   PATCH /api/v1/crm/meetings/:id/reschedule
 * @desc    Reschedule meeting with new date/time and reason logging
 */
meetingRoutes.patch("/:id/reschedule", rescheduleMeeting);

/**
 * @route   PATCH /api/v1/crm/meetings/:id/mom
 * @desc    Record or update Minutes of Meeting (MOM), outcome notes, and recording URL
 */
meetingRoutes.patch("/:id/mom", updateMeetingMom);

/**
 * @route   POST /api/v1/crm/meetings/:id/attendees
 * @desc    Add employee or client/guest attendee to meeting
 */
meetingRoutes.post("/:id/attendees", addMeetingAttendee);

/**
 * @route   PATCH /api/v1/crm/meetings/:id/attendees/:attendeeId
 * @desc    Update attendee role or RSVP response status (ACCEPTED, DECLINED, TENTATIVE)
 */
meetingRoutes.patch("/:id/attendees/:attendeeId", updateMeetingAttendee);

/**
 * @route   DELETE /api/v1/crm/meetings/:id/attendees/:attendeeId
 * @desc    Remove an attendee from meeting
 */
meetingRoutes.delete("/:id/attendees/:attendeeId", deleteMeetingAttendee);

/**
 * @route   POST /api/v1/crm/meetings/:id/documents
 * @desc    Upload meeting attachment, presentation, or site photo
 */
meetingRoutes.post(
  "/:id/documents",
  upload.single("file", { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  uploadMeetingDocument
);

/**
 * @route   DELETE /api/v1/crm/meetings/documents/:id
 * @desc    Delete meeting attachment document
 */
meetingRoutes.delete("/documents/:id", deleteMeetingDocument);

export default meetingRoutes;

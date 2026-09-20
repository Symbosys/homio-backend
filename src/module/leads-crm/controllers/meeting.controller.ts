import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { meetingService } from "../services/meeting.service.js";
import {
  createMeetingSchema,
  updateMeetingSchema,
  updateMeetingStatusSchema,
  rescheduleMeetingSchema,
  updateMeetingMomSchema,
  addMeetingAttendeeSchema,
  updateMeetingAttendeeSchema,
  uploadMeetingDocumentSchema,
  meetingIdParamSchema,
  meetingAttendeeIdParamSchema,
  getMeetingsQuerySchema,
  getMeetingCalendarQuerySchema,
} from "../validators/meeting.validator.js";
import { documentIdParamSchema } from "../validators/lead-document.validator.js";

/**
 * Controller: Schedule new Meeting
 */
export const createMeeting = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createMeetingSchema.parse({ body: req.body });
  const result = await meetingService.createMeeting(organizationId, parsed.body, req.user?.id);
  return SuccessResponse(res, "Meeting scheduled successfully", result, statusCode.Created);
});

/**
 * Controller: Get paginated meetings
 */
export const getMeetings = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getMeetingsQuerySchema.parse({ query: req.query });
  const result = await meetingService.getMeetings(organizationId, parsed.query);
  return SuccessResponse(res, "Meetings retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get calendar timeline view of meetings
 */
export const getMeetingCalendar = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getMeetingCalendarQuerySchema.parse({ query: req.query });
  const result = await meetingService.getCalendar(organizationId, parsed.query);
  return SuccessResponse(res, "Meeting calendar retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single meeting details by ID
 */
export const getMeetingById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = meetingIdParamSchema.parse({ params: req.params });
  const result = await meetingService.getMeetingById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Meeting details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update meeting info
 */
export const updateMeeting = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateMeetingSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.updateMeeting(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Meeting updated successfully", result, statusCode.OK);
});

/**
 * Controller: Update meeting status
 */
export const updateMeetingStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateMeetingStatusSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.updateMeetingStatus(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Meeting status updated successfully", result, statusCode.OK);
});

/**
 * Controller: Reschedule meeting
 */
export const rescheduleMeeting = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = rescheduleMeetingSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.rescheduleMeeting(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Meeting rescheduled successfully", result, statusCode.OK);
});

/**
 * Controller: Update Minutes of Meeting (MOM) & Outcomes
 */
export const updateMeetingMom = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateMeetingMomSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.updateMeetingMom(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Minutes of meeting updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete meeting
 */
export const deleteMeeting = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = meetingIdParamSchema.parse({ params: req.params });
  const result = await meetingService.deleteMeeting(parsed.params.id, organizationId);
  return SuccessResponse(res, "Meeting deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Add attendee to meeting
 */
export const addMeetingAttendee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = addMeetingAttendeeSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.addAttendee(organizationId, parsed.params.id, parsed.body);
  return SuccessResponse(res, "Attendee added successfully", result, statusCode.Created);
});

/**
 * Controller: Update attendee status/role
 */
export const updateMeetingAttendee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateMeetingAttendeeSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.updateAttendee(
    organizationId,
    parsed.params.id,
    parsed.params.attendeeId,
    parsed.body
  );
  return SuccessResponse(res, "Attendee updated successfully", result, statusCode.OK);
});

/**
 * Controller: Remove attendee from meeting
 */
export const deleteMeetingAttendee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = meetingAttendeeIdParamSchema.parse({ params: req.params });
  const result = await meetingService.deleteAttendee(
    organizationId,
    parsed.params.id,
    parsed.params.attendeeId
  );
  return SuccessResponse(res, "Attendee removed successfully", result, statusCode.OK);
});

/**
 * Controller: Upload document to meeting
 */
export const uploadMeetingDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.file) {
    throw new ErrorResponse("Please attach a document file to upload", statusCode.Bad_Request);
  }

  const parsed = uploadMeetingDocumentSchema.parse({ params: req.params, body: req.body });
  const result = await meetingService.uploadDocument(
    organizationId,
    parsed.params.id,
    parsed.body,
    req.file,
    req.user?.id
  );
  return SuccessResponse(res, "Meeting document uploaded successfully", result, statusCode.Created);
});

/**
 * Controller: Delete meeting document
 */
export const deleteMeetingDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = documentIdParamSchema.parse({ params: req.params });
  const result = await meetingService.deleteDocument(parsed.params.id, organizationId);
  return SuccessResponse(res, "Meeting document deleted successfully", result, statusCode.OK);
});

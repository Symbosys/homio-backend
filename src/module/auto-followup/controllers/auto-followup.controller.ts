import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { autoFollowUpService } from "../services/auto-followup.service.js";
import { leadFollowUpService } from "../services/lead-followup.service.js";
import { meetingFollowUpService } from "../services/meeting-followup.service.js";
import {
  createFollowUpConfigSchema,
  updateFollowUpConfigSchema,
  getFollowUpConfigByIdSchema,
  queryFollowUpConfigsSchema,
  queryEnrollmentsSchema,
  enrollmentIdParamSchema,
  cancelEnrollmentSchema,
  enrollLeadSchema,
  enrollMeetingSchema,
} from "../validators/auto-followup.validator.js";

/**
 * Controller: Get unified auto follow-up and reminder configuration for the organization
 */
export const getOrganizationConfig = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await autoFollowUpService.getUnifiedConfig(organizationId);
  return SuccessResponse(res, "Follow-up configuration retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Upsert unified auto follow-up and reminder configuration for the organization
 */
export const upsertOrganizationConfig = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await autoFollowUpService.upsertUnifiedConfig(
    organizationId,
    req.body,
    req.user?.id,
  );

  return SuccessResponse(res, "Follow-up configuration saved successfully", result, statusCode.OK);
});

/**
 * Controller: Create new auto follow-up sequence configuration
 */
export const createFollowUpConfig = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createFollowUpConfigSchema.parse({ body: req.body });
  const result = await autoFollowUpService.createConfig(
    organizationId,
    parsed.body,
    req.user?.id,
  );

  return SuccessResponse(res, "Follow-up configuration created successfully", result, statusCode.Created);
});

/**
 * Controller: Update existing auto follow-up sequence configuration
 */
export const updateFollowUpConfig = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateFollowUpConfigSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await autoFollowUpService.updateConfig(
    organizationId,
    parsed.params.id,
    parsed.body,
  );

  return SuccessResponse(res, "Follow-up configuration updated successfully", result, statusCode.OK);
});

/**
 * Controller: Get auto follow-up configuration by ID with nested steps
 */
export const getFollowUpConfigById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getFollowUpConfigByIdSchema.parse({ params: req.params });
  const result = await autoFollowUpService.getConfigById(
    organizationId,
    parsed.params.id,
  );

  if (!result) {
    throw new ErrorResponse("Configuration not found", statusCode.Not_Found);
  }

  return SuccessResponse(res, "Follow-up configuration retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: List paginated auto follow-up configurations
 */
export const listFollowUpConfigs = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = queryFollowUpConfigsSchema.parse({ query: req.query });
  const result = await autoFollowUpService.listConfigs(
    organizationId,
    parsed.query,
  );

  return SuccessResponse(res, "Follow-up configurations retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Delete an auto follow-up configuration
 */
export const deleteFollowUpConfig = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getFollowUpConfigByIdSchema.parse({ params: req.params });
  await autoFollowUpService.deleteConfig(organizationId, parsed.params.id);

  return SuccessResponse(res, "Follow-up configuration deleted successfully", null, statusCode.OK);
});

/**
 * Controller: List paginated follow-up enrollments (Lead & Meeting)
 */
export const listFollowUpEnrollments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = queryEnrollmentsSchema.parse({ query: req.query });
  const result = await autoFollowUpService.listEnrollments(
    organizationId,
    parsed.query,
  );

  return SuccessResponse(res, "Follow-up enrollments retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get enrollment details with execution history logs
 */
export const getFollowUpEnrollmentById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = enrollmentIdParamSchema.parse({ params: req.params });
  const result = await autoFollowUpService.getEnrollmentById(
    organizationId,
    parsed.params.id,
  );

  if (!result) {
    throw new ErrorResponse("Enrollment not found", statusCode.Not_Found);
  }

  return SuccessResponse(res, "Enrollment details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Cancel an active follow-up enrollment
 */
export const cancelFollowUpEnrollment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = cancelEnrollmentSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await autoFollowUpService.cancelEnrollment(
    organizationId,
    parsed.params.id,
    parsed.body.reason,
  );

  return SuccessResponse(res, "Follow-up enrollment cancelled successfully", result, statusCode.OK);
});

/**
 * Controller: Manually enroll a Lead into follow-up sequence
 */
export const enrollLeadManually = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = enrollLeadSchema.parse({ body: req.body });
  const result = await leadFollowUpService.enrollLead(
    organizationId,
    parsed.body.leadId,
    parsed.body.configId,
  );

  if (!result) {
    throw new ErrorResponse(
      "Failed to enroll lead. Verify lead existence, phone number, and active follow-up config.",
      statusCode.Bad_Request,
    );
  }

  return SuccessResponse(res, "Lead enrolled in follow-up successfully", result, statusCode.Created);
});

/**
 * Controller: Manually enroll a Meeting into reminder sequence
 */
export const enrollMeetingManually = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = enrollMeetingSchema.parse({ body: req.body });
  const result = await meetingFollowUpService.enrollMeeting(
    organizationId,
    parsed.body.meetingId,
    parsed.body.configId,
  );

  if (!result) {
    throw new ErrorResponse(
      "Failed to enroll meeting. Verify meeting existence, recipient phone, and active reminder config.",
      statusCode.Bad_Request,
    );
  }

  return SuccessResponse(res, "Meeting enrolled in reminders successfully", result, statusCode.Created);
});

/**
 * Controller: Trigger execution batch for due follow-up enrollments manually
 */
export const triggerBatchExecution = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await autoFollowUpService.processDueEnrollments(50);
  return SuccessResponse(res, "Due follow-up enrollments processed", result, statusCode.OK);
});

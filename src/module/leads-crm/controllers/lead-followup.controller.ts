import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadFollowUpService } from "../services/lead-followup.service.js";
import {
  createLeadFollowUpSchema,
  updateLeadFollowUpSchema,
  followUpIdParamSchema,
  getFollowUpsQuerySchema,
} from "../validators/lead-followup.validator.js";

/**
 * Controller: Schedule new Follow-up
 */
export const createLeadFollowUp = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLeadFollowUpSchema.parse({ body: req.body });
  const result = await leadFollowUpService.createFollowUp(organizationId, parsed.body);
  return SuccessResponse(res, "Follow-up scheduled successfully", result, statusCode.Created);
});

/**
 * Controller: Get all Follow-ups with date range and status filters
 */
export const getLeadFollowUps = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getFollowUpsQuerySchema.parse({ query: req.query });
  const result = await leadFollowUpService.getFollowUps(organizationId, parsed.query);
  return SuccessResponse(res, "Follow-ups retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single Follow-up by ID
 */
export const getLeadFollowUpById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = followUpIdParamSchema.parse({ params: req.params });
  const result = await leadFollowUpService.getFollowUpById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Follow-up details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update / Reschedule / Complete Follow-up
 */
export const updateLeadFollowUp = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLeadFollowUpSchema.parse({ params: req.params, body: req.body });
  const result = await leadFollowUpService.updateFollowUp(
    parsed.params.id,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Follow-up updated successfully", result, statusCode.OK);
});

/**
 * Controller: Delete Follow-up
 */
export const deleteLeadFollowUp = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = followUpIdParamSchema.parse({ params: req.params });
  const result = await leadFollowUpService.deleteFollowUp(parsed.params.id, organizationId);
  return SuccessResponse(res, "Follow-up deleted successfully", result, statusCode.OK);
});

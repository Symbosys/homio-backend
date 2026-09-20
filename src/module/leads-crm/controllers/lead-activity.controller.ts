import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadActivityService } from "../services/lead-activity.service.js";
import {
  createLeadActivitySchema,
  activityIdParamSchema,
} from "../validators/lead-activity.validator.js";
import { leadIdParamSchema } from "../validators/lead.validator.js";

/**
 * Controller: Add Lead Activity log
 */
export const createLeadActivity = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLeadActivitySchema.parse({ params: req.params, body: req.body });
  const result = await leadActivityService.createActivity(
    organizationId,
    parsed.params.id,
    parsed.body
  );
  return SuccessResponse(res, "Activity logged successfully", result, statusCode.Created);
});

/**
 * Controller: Get all activities for a lead
 */
export const getLeadActivities = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = leadIdParamSchema.parse({ params: req.params });
  const result = await leadActivityService.getActivitiesByLeadId(
    parsed.params.id,
    organizationId
  );
  return SuccessResponse(res, "Activities retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Delete Lead Activity
 */
export const deleteLeadActivity = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = activityIdParamSchema.parse({ params: req.params });
  const result = await leadActivityService.deleteActivity(parsed.params.id, organizationId);
  return SuccessResponse(res, "Activity deleted successfully", result, statusCode.OK);
});

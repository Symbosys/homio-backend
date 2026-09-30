import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadLostReasonService } from "../services/lead-lost-reason.service.js";
import { getLeadLostReasonsQuerySchema } from "../validators/lead-lost-reason.validator.js";

/**
 * @route   POST /api/v1/master-data/lead-lost-reasons
 * @desc    Standardized system enum - modification disabled
 * @access  Private
 */
export const createLeadLostReason = asyncHandler(async (_req, _res) => {
  throw new ErrorResponse(
    "Lead lost reasons are standardized system enums and cannot be created dynamically.",
    statusCode.Forbidden
  );
});

/**
 * @route   GET /api/v1/master-data/lead-lost-reasons
 * @desc    Fetch standardized list of lead lost reasons with rich metadata
 * @access  Private (Authenticated Tenant User)
 */
export const getLeadLostReasons = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getLeadLostReasonsQuerySchema.parse({ query: req.query });
  const result = await leadLostReasonService.getReasons(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Lead lost reasons retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Fetch details of a single lead lost reason
 * @access  Private (Authenticated Tenant User)
 */
export const getLeadLostReasonById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = String(req.params.id);
  const result = await leadLostReasonService.getReasonById(id, organizationId);
  if (!result) {
    throw new ErrorResponse("Lead lost reason not found", statusCode.Not_Found);
  }
  return SuccessResponse(res, "Lead lost reason retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Standardized system enum - modification disabled
 * @access  Private
 */
export const updateLeadLostReason = asyncHandler(async (_req, _res) => {
  throw new ErrorResponse(
    "Lead lost reasons are standardized system enums and cannot be modified.",
    statusCode.Forbidden
  );
});

/**
 * @route   DELETE /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Standardized system enum - deletion disabled
 * @access  Private
 */
export const deleteLeadLostReason = asyncHandler(async (_req, _res) => {
  throw new ErrorResponse(
    "Lead lost reasons are standardized system enums and cannot be deleted.",
    statusCode.Forbidden
  );
});

/**
 * @route   PATCH /api/v1/master-data/lead-lost-reasons/:id/toggle-active
 * @desc    Standardized system enum - toggle disabled
 * @access  Private
 */
export const toggleActiveLeadLostReason = asyncHandler(async (_req, _res) => {
  throw new ErrorResponse(
    "Lead lost reasons are standardized system enums.",
    statusCode.Forbidden
  );
});

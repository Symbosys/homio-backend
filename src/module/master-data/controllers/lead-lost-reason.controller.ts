import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadLostReasonService } from "../services/lead-lost-reason.service.js";
import {
  createLeadLostReasonSchema,
  updateLeadLostReasonSchema,
  getLeadLostReasonsQuerySchema,
  leadLostReasonIdParamSchema,
} from "../validators/lead-lost-reason.validator.js";

/**
 * @route   POST /api/v1/master-data/lead-lost-reasons
 * @desc    Create a new lead lost reason for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const createLeadLostReason = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLeadLostReasonSchema.parse({ body: req.body });
  const result = await leadLostReasonService.createReason(organizationId, parsed.body);
  return SuccessResponse(res, "Lead lost reason created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/master-data/lead-lost-reasons
 * @desc    Fetch paginated list of lead lost reasons for the organization
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
 * @desc    Fetch details of a single lead lost reason with usage count
 * @access  Private (Authenticated Tenant User)
 */
export const getLeadLostReasonById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = leadLostReasonIdParamSchema.parse({ params: req.params });
  const result = await leadLostReasonService.getReasonById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Lead lost reason retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Update lead lost reason details
 * @access  Private (Authenticated Tenant User)
 */
export const updateLeadLostReason = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLeadLostReasonSchema.parse({ params: req.params, body: req.body });
  const result = await leadLostReasonService.updateReason(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Lead lost reason updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/master-data/lead-lost-reasons/:id
 * @desc    Soft delete a lead lost reason
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLeadLostReason = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = leadLostReasonIdParamSchema.parse({ params: req.params });
  await leadLostReasonService.deleteReason(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Lead lost reason deleted successfully", null, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/lead-lost-reasons/:id/toggle-active
 * @desc    Toggle active state of a lead lost reason
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveLeadLostReason = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = leadLostReasonIdParamSchema.parse({ params: req.params });
  const result = await leadLostReasonService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Lead lost reason status updated successfully", result, statusCode.OK);
});

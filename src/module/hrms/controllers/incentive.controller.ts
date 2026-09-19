import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { incentiveService } from "../services/incentive.service.js";
import {
  createIncentiveSchema,
  updateIncentiveSchema,
  getIncentivesQuerySchema,
  getMyIncentivesQuerySchema,
  incentiveIdParamSchema,
  rejectIncentiveSchema,
} from "../validators/incentive.validator.js";

/**
 * Controller: Create incentive / debit transaction
 */
export const createIncentive = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = createIncentiveSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await incentiveService.createIncentive(
    organizationId,
    userId,
    parsed.body,
    files
  );

  return SuccessResponse(res, "Incentive transaction created successfully", result, statusCode.Created);
});

/**
 * Controller: Get personal incentives for logged-in employee
 */
export const getMyIncentives = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = getMyIncentivesQuerySchema.parse({ query: req.query });
  const result = await incentiveService.getMyIncentives(organizationId, userId, parsed.query);

  return SuccessResponse(res, "Your incentive records retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get organization aggregate metrics
 */
export const getSummaryMetrics = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const result = await incentiveService.getSummaryMetrics(organizationId);
  return SuccessResponse(res, "Incentive metrics summary retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get all incentives for organization (Admin / HR)
 */
export const getAllIncentives = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getIncentivesQuerySchema.parse({ query: req.query });
  const result = await incentiveService.getAllIncentives(organizationId, parsed.query);

  return SuccessResponse(res, "Incentive transactions retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single incentive by ID
 */
export const getIncentiveById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = incentiveIdParamSchema.parse({ params: req.params });
  const result = await incentiveService.getIncentiveById(params.id, organizationId);

  return SuccessResponse(res, "Incentive details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update incentive details (only if PENDING)
 */
export const updateIncentive = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = updateIncentiveSchema.parse({ params: req.params, body: req.body });
  const result = await incentiveService.updateIncentive(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body
  );

  return SuccessResponse(res, "Incentive transaction updated successfully", result, statusCode.OK);
});

/**
 * Controller: Approve incentive / penalty
 */
export const approveIncentive = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const { params } = incentiveIdParamSchema.parse({ params: req.params });
  const result = await incentiveService.approveIncentive(params.id, organizationId, userId);

  return SuccessResponse(res, "Incentive approved successfully", result, statusCode.OK);
});

/**
 * Controller: Reject incentive transaction
 */
export const rejectIncentive = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = rejectIncentiveSchema.parse({ params: req.params, body: req.body });
  const result = await incentiveService.rejectIncentive(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body.remarks
  );

  return SuccessResponse(res, "Incentive rejected successfully", result, statusCode.OK);
});

/**
 * Controller: Cancel incentive transaction
 */
export const cancelIncentive = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const { params } = incentiveIdParamSchema.parse({ params: req.params });
  const result = await incentiveService.cancelIncentive(params.id, organizationId, userId);

  return SuccessResponse(res, "Incentive cancelled successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete incentive
 */
export const deleteIncentive = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = incentiveIdParamSchema.parse({ params: req.params });
  const result = await incentiveService.deleteIncentive(params.id, organizationId);

  return SuccessResponse(res, result.message, null, statusCode.OK);
});

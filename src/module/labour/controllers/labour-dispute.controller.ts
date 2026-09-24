import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourDisputeService } from "../services/labour-dispute.service.js";
import {
  createLabourDisputeSchema,
  updateLabourDisputeSchema,
  updateDisputeStatusSchema,
  getLabourDisputesQuerySchema,
  disputeIdParamSchema,
} from "../validators/labour-dispute.validator.js";

/**
 * @route   POST /api/v1/labour/disputes
 * @desc    File a new legal / site dispute with evidence attachments
 * @access  Private (Authenticated Tenant User)
 */
export const createLabourDispute = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLabourDisputeSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.createDispute(parsed.body, organizationId, files);
  return SuccessResponse(res, "Labour dispute filed successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour/disputes
 * @desc    Fetch paginated disputes with filters
 * @access  Private (Authenticated Tenant User)
 */
export const getAllLabourDisputes = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLabourDisputesQuerySchema.parse({ query: req.query });
  const result = await labourDisputeService.getDisputes(parsed.query, organizationId);
  return SuccessResponse(res, "Labour disputes retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/disputes/:id
 * @desc    Get dispute case file by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getLabourDisputeById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = disputeIdParamSchema.parse({ params: req.params });
  const result = await labourDisputeService.getDisputeById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour dispute retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/disputes/:id
 * @desc    Full symmetric update of dispute case (Rule 19)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourDispute = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLabourDisputeSchema.parse({ params: req.params, body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.updateDispute(
    parsed.params.id,
    parsed.body,
    organizationId,
    files
  );
  return SuccessResponse(res, "Labour dispute updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/disputes/:id/status
 * @desc    Update dispute resolution status (SETTLED, CLOSED, UNDER_REVIEW, etc.)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourDisputeStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateDisputeStatusSchema.parse({ params: req.params, body: req.body });
  const result = await labourDisputeService.updateStatus(parsed.params.id, parsed.body, organizationId);
  return SuccessResponse(res, "Dispute status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/disputes/:id
 * @desc    Delete dispute case and prune cloud evidence docs
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLabourDispute = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = disputeIdParamSchema.parse({ params: req.params });
  await labourDisputeService.deleteDispute(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour dispute deleted successfully", null, statusCode.OK);
});

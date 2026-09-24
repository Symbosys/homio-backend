import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourPaymentService } from "../services/labour-payment.service.js";
import {
  createLabourPaymentSchema,
  updateLabourPaymentSchema,
  updatePaymentStatusSchema,
  getLabourPaymentsQuerySchema,
  paymentIdParamSchema,
} from "../validators/labour-payment.validator.js";

/**
 * @route   POST /api/v1/labour/payments
 * @desc    Record a labour wage payout with optional receipt voucher photo
 * @access  Private (Authenticated Tenant User)
 */
export const createLabourPayment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLabourPaymentSchema.parse({ body: req.body });
  const result = await labourPaymentService.createPayment(parsed.body, organizationId, req.file);
  return SuccessResponse(res, "Labour payment recorded successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour/payments
 * @desc    Fetch paginated payment history with filters
 * @access  Private (Authenticated Tenant User)
 */
export const getAllLabourPayments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLabourPaymentsQuerySchema.parse({ query: req.query });
  const result = await labourPaymentService.getPayments(parsed.query, organizationId);
  return SuccessResponse(res, "Labour payments retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/payments/:id
 * @desc    Get payment voucher details by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getLabourPaymentById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = paymentIdParamSchema.parse({ params: req.params });
  const result = await labourPaymentService.getPaymentById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour payment retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/payments/:id
 * @desc    Full symmetric update of payment record (prunes old cloud receipt upon replacement)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourPayment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLabourPaymentSchema.parse({ params: req.params, body: req.body });
  const result = await labourPaymentService.updatePayment(
    parsed.params.id,
    parsed.body,
    organizationId,
    req.file
  );
  return SuccessResponse(res, "Labour payment updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/payments/:id/status
 * @desc    Update payment status (PAID, PENDING, CANCELLED)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabourPaymentStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updatePaymentStatusSchema.parse({ params: req.params, body: req.body });
  const result = await labourPaymentService.updateStatus(parsed.params.id, parsed.body.status, organizationId);
  return SuccessResponse(res, "Labour payment status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/payments/:id
 * @desc    Delete payment voucher and prune cloud receipt
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLabourPayment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = paymentIdParamSchema.parse({ params: req.params });
  await labourPaymentService.deletePayment(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour payment deleted successfully", null, statusCode.OK);
});

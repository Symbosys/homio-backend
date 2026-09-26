import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { paymentService } from "../services/payment.service.js";
import {
  createPaymentSchema,
  updatePaymentSchema,
  getPaymentsQuerySchema,
  getPaymentSummaryQuerySchema,
  paymentIdParamSchema,
  projectPaymentParamSchema,
} from "../validators/payment.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/payments or POST /api/v1/projects/payments
 * @desc    Record a new payment transaction
 * @access  Private (Authenticated Tenant User)
 */
export const createPayment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createPaymentSchema.parse({ params: req.params, body: req.body });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const payload = {
    ...parsed.body,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await paymentService.createPayment(organizationId, payload);
  return SuccessResponse(res, "Payment transaction recorded successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/payments or GET /api/v1/projects/payments
 * @desc    Fetch paginated list of payment transactions with comprehensive filters
 * @access  Private (Authenticated Tenant User)
 */
export const getPayments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getPaymentsQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await paymentService.getPayments(organizationId, query);
  return SuccessResponse(res, "Payments retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/payments/:id or GET /api/v1/projects/payments/:id
 * @desc    Fetch details of a single payment transaction
 * @access  Private (Authenticated Tenant User)
 */
export const getPaymentById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { params } = paymentIdParamSchema.parse({ params: req.params });
  const result = await paymentService.getPaymentById(organizationId, params.id);
  return SuccessResponse(res, "Payment retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/payments/:id or PATCH /api/v1/projects/payments/:id
 * @desc    Update payment transaction parameters
 * @access  Private (Authenticated Tenant User)
 */
export const updatePayment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updatePaymentSchema.parse({ params: req.params, body: req.body });
  const result = await paymentService.updatePayment(organizationId, parsed.params.id, parsed.body);
  return SuccessResponse(res, "Payment updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/payments/:id or DELETE /api/v1/projects/payments/:id
 * @desc    Soft delete a payment transaction
 * @access  Private (Authenticated Tenant User)
 */
export const deletePayment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { params } = paymentIdParamSchema.parse({ params: req.params });
  const result = await paymentService.deletePayment(organizationId, params.id);
  return SuccessResponse(res, result.message, null, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/payments/summary or GET /api/v1/projects/payments/summary
 * @desc    Fetch financial summary analytics for payments
 * @access  Private (Authenticated Tenant User)
 */
export const getPaymentSummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getPaymentSummaryQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await paymentService.getPaymentSummary(organizationId, query);
  return SuccessResponse(res, "Payment financial summary retrieved successfully", result, statusCode.OK);
});

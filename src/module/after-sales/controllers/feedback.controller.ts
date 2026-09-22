import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { feedbackService } from "../services/feedback.service.js";
import {
  createCustomerFeedbackSchema,
  updateCustomerFeedbackSchema,
  escalateFeedbackSchema,
  resolveEscalationSchema,
  getCustomerFeedbacksQuerySchema,
  feedbackIdParamSchema,
} from "../validators/feedback.validator.js";

/**
 * @route   POST /api/v1/after-sales/feedbacks
 * @desc    Submit customer feedback & 5-pillar CSAT ratings
 * @access  Private
 */
export const createFeedback = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.body.projectId && req.params.projectId) {
    req.body.projectId = req.params.projectId;
  }

  const validatedBody = createCustomerFeedbackSchema.parse(req.body);
  const feedback = await feedbackService.createFeedback(organizationId, validatedBody);

  return SuccessResponse(res, "Customer feedback submitted successfully", feedback, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/feedbacks
 * @desc    List customer feedbacks with filters & pagination
 * @access  Private
 */
export const getFeedbacks = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.query.projectId && req.params.projectId) {
    req.query.projectId = req.params.projectId;
  }

  const query = getCustomerFeedbacksQuerySchema.parse(req.query);
  const result = await feedbackService.getFeedbacks(organizationId, query);

  return SuccessResponse(res, "Customer feedbacks fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/feedbacks/:id
 * @desc    Get single customer feedback details
 * @access  Private
 */
export const getFeedbackById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = feedbackIdParamSchema.parse(req.params);
  const feedback = await feedbackService.getFeedbackById(organizationId, id);

  return SuccessResponse(res, "Customer feedback fetched successfully", feedback, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/feedbacks/:id
 * @desc    Update customer feedback details
 * @access  Private
 */
export const updateFeedback = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = feedbackIdParamSchema.parse(req.params);
  const validatedBody = updateCustomerFeedbackSchema.parse(req.body);

  const updated = await feedbackService.updateFeedback(organizationId, id, validatedBody);

  return SuccessResponse(res, "Customer feedback updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/feedbacks/:id/escalate
 * @desc    Escalate low rating or customer complaint to management
 * @access  Private (Admin)
 */
export const escalateFeedback = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = feedbackIdParamSchema.parse(req.params);
  const validatedBody = escalateFeedbackSchema.parse(req.body);

  const updated = await feedbackService.escalateFeedback(organizationId, id, validatedBody);

  return SuccessResponse(res, "Customer feedback escalated to management", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/feedbacks/:id/resolve-escalation
 * @desc    Manager adds notes and marks escalation resolved
 * @access  Private (Admin)
 */
export const resolveEscalation = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = feedbackIdParamSchema.parse(req.params);
  const validatedBody = resolveEscalationSchema.parse(req.body);

  const updated = await feedbackService.resolveEscalation(organizationId, id, validatedBody);

  return SuccessResponse(res, "Escalation resolved successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/after-sales/feedbacks/:id
 * @desc    Soft delete customer feedback
 * @access  Private (Admin)
 */
export const deleteFeedback = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = feedbackIdParamSchema.parse(req.params);
  await feedbackService.deleteFeedback(organizationId, id);

  return SuccessResponse(res, "Customer feedback deleted successfully", null, statusCode.OK);
});

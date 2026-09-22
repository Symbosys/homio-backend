import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { retentionService } from "../services/retention.service.js";
import {
  createRetentionFollowUpSchema,
  updateRetentionFollowUpSchema,
  logRetentionCallSchema,
  getRetentionFollowUpsQuerySchema,
  retentionIdParamSchema,
} from "../validators/retention.validator.js";

/**
 * @route   POST /api/v1/after-sales/retentions
 * @desc    Schedule a proactive retention follow-up call
 * @access  Private
 */
export const createFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.body.projectId && req.params.projectId) {
    req.body.projectId = req.params.projectId;
  }

  const validatedBody = createRetentionFollowUpSchema.parse(req.body);
  const followUp = await retentionService.createFollowUp(organizationId, validatedBody);

  return SuccessResponse(res, "Retention follow-up scheduled successfully", followUp, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/retentions
 * @desc    List retention follow-ups with filters & pagination
 * @access  Private
 */
export const getFollowUps = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.query.projectId && req.params.projectId) {
    req.query.projectId = req.params.projectId;
  }

  const query = getRetentionFollowUpsQuerySchema.parse(req.query);
  const result = await retentionService.getFollowUps(organizationId, query);

  return SuccessResponse(res, "Retention follow-ups fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/retentions/:id
 * @desc    Get single retention follow-up details
 * @access  Private
 */
export const getFollowUpById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = retentionIdParamSchema.parse(req.params);
  const followUp = await retentionService.getFollowUpById(organizationId, id);

  return SuccessResponse(res, "Retention follow-up fetched successfully", followUp, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/retentions/:id
 * @desc    Partial update retention follow-up details
 * @access  Private
 */
export const updateFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = retentionIdParamSchema.parse(req.params);
  const validatedBody = updateRetentionFollowUpSchema.parse(req.body);

  const updated = await retentionService.updateFollowUp(organizationId, id, validatedBody);

  return SuccessResponse(res, "Retention follow-up updated successfully", updated, statusCode.OK);
});

/**
 * @route   POST /api/v1/after-sales/retentions/:id/log-call
 * @desc    Log conducted call outcome, CSAT score & referral lead
 * @access  Private
 */
export const logCall = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = retentionIdParamSchema.parse(req.params);
  const validatedBody = logRetentionCallSchema.parse(req.body);

  const updated = await retentionService.logCall(organizationId, id, validatedBody);

  return SuccessResponse(res, "Retention call outcome logged successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/after-sales/retentions/:id
 * @desc    Soft delete retention follow-up
 * @access  Private (Admin)
 */
export const deleteFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = retentionIdParamSchema.parse(req.params);
  await retentionService.deleteFollowUp(organizationId, id);

  return SuccessResponse(res, "Retention follow-up deleted successfully", null, statusCode.OK);
});

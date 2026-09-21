import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { approvalService } from "../services/approval.service.js";
import {
  createApprovalSchema,
  updateApprovalSchema,
  reviewApprovalSchema,
  getApprovalsQuerySchema,
  approvalProjectIdParamSchema,
  approvalIdParamSchema,
  createChangeRequestSchema,
  respondChangeRequestSchema,
  approvalChangeRequestsParamSchema,
} from "../validators/approval.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/approvals
 * @desc    Create a work approval request item with drawings & details
 * @access  Private (Authenticated Tenant User)
 */
export const createApproval = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createApprovalSchema.parse({ params: req.params, body: req.body });
  const result = await approvalService.createApproval(
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Work approval created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/approvals
 * @desc    Fetch paginated list of approvals with status and type filters
 * @access  Private (Authenticated Tenant User)
 */
export const getApprovals = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = approvalProjectIdParamSchema.parse({ params: req.params });
  const parsedQuery = getApprovalsQuerySchema.parse({ query: req.query });

  const result = await approvalService.getApprovals(
    parsedParams.params.projectId,
    organizationId,
    parsedQuery.query
  );
  return SuccessResponse(res, "Work approvals retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/approvals/:id
 * @desc    Fetch single approval with nested change requests
 * @access  Private (Authenticated Tenant User)
 */
export const getApprovalById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = approvalIdParamSchema.parse({ params: req.params });
  const result = await approvalService.getApprovalById(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );
  return SuccessResponse(res, "Work approval details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/approvals/:id
 * @desc    Update work approval details and attachments
 * @access  Private (Authenticated Tenant User)
 */
export const updateApproval = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateApprovalSchema.parse({ params: req.params, body: req.body });
  const result = await approvalService.updateApproval(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Work approval updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/approvals/:id/review
 * @desc    Submit client approval decision (APPROVE / REJECT)
 * @access  Private (Authenticated Tenant User)
 */
export const reviewApproval = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = reviewApprovalSchema.parse({ params: req.params, body: req.body });
  const result = await approvalService.reviewApproval(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, `Work approval ${parsed.body.action.toLowerCase()}d successfully`, result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/approvals/:id
 * @desc    Soft delete a work approval
 * @access  Private (Authenticated Tenant User)
 */
export const deleteApproval = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = approvalIdParamSchema.parse({ params: req.params });
  const result = await approvalService.deleteApproval(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );
  return SuccessResponse(res, "Work approval deleted successfully", result, statusCode.OK);
});

// ==========================================
// CHANGE REQUESTS CONTROLLERS
// ==========================================

/**
 * @route   POST /api/v1/projects/:projectId/approvals/:approvalId/change-requests
 * @desc    Client submits a change request round for a work approval
 * @access  Private (Authenticated Tenant User)
 */
export const createChangeRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createChangeRequestSchema.parse({ params: req.params, body: req.body });
  const result = await approvalService.createChangeRequest(
    parsed.params.projectId,
    parsed.params.approvalId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Change request submitted successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/approvals/:approvalId/change-requests
 * @desc    List all change requests for a work approval
 * @access  Private (Authenticated Tenant User)
 */
export const getChangeRequests = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = approvalChangeRequestsParamSchema.parse({ params: req.params });
  const result = await approvalService.getChangeRequests(
    parsed.params.projectId,
    parsed.params.approvalId,
    organizationId
  );
  return SuccessResponse(res, "Change requests retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/approvals/:approvalId/change-requests/:id/respond
 * @desc    Organization responds to a change request (Accept / Reject / Implement)
 * @access  Private (Authenticated Tenant User)
 */
export const respondChangeRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = respondChangeRequestSchema.parse({ params: req.params, body: req.body });
  const result = await approvalService.respondChangeRequest(
    parsed.params.projectId,
    parsed.params.approvalId,
    parsed.params.id,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Change request responded successfully", result, statusCode.OK);
});

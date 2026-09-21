import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { complaintService } from "../services/complaint.service.js";
import {
  createComplaintSchema,
  updateComplaintSchema,
  updateComplaintStatusSchema,
  getComplaintsQuerySchema,
  complaintProjectIdParamSchema,
  complaintIdParamSchema,
  complaintCommentsParamSchema,
  addComplaintCommentSchema,
} from "../validators/complaint.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/complaints
 * @desc    File a new project complaint / snag ticket
 * @access  Private (Authenticated Tenant User)
 */
export const createComplaint = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createComplaintSchema.parse({ params: req.params, body: req.body });
  const result = await complaintService.createComplaint(
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Complaint filed successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/complaints
 * @desc    Fetch paginated list of complaints with search, severity & status filters
 * @access  Private (Authenticated Tenant User)
 */
export const getComplaints = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = complaintProjectIdParamSchema.parse({ params: req.params });
  const parsedQuery = getComplaintsQuerySchema.parse({ query: req.query });

  const result = await complaintService.getComplaints(
    parsedParams.params.projectId,
    organizationId,
    parsedQuery.query
  );
  return SuccessResponse(res, "Complaints retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/complaints/:id
 * @desc    Fetch comprehensive details of a single complaint with comments
 * @access  Private (Authenticated Tenant User)
 */
export const getComplaintById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = complaintIdParamSchema.parse({ params: req.params });
  const result = await complaintService.getComplaintById(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );
  return SuccessResponse(res, "Complaint details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/complaints/:id
 * @desc    Update complaint details, room, and target resolution date
 * @access  Private (Authenticated Tenant User)
 */
export const updateComplaint = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateComplaintSchema.parse({ params: req.params, body: req.body });
  const result = await complaintService.updateComplaint(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Complaint updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/complaints/:id/status
 * @desc    Update complaint status (RESOLVED, CLOSED, etc.) with resolution notes
 * @access  Private (Authenticated Tenant User)
 */
export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateComplaintStatusSchema.parse({ params: req.params, body: req.body });
  const result = await complaintService.updateComplaintStatus(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Complaint status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/complaints/:id
 * @desc    Soft delete a complaint
 * @access  Private (Authenticated Tenant User)
 */
export const deleteComplaint = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = complaintIdParamSchema.parse({ params: req.params });
  const result = await complaintService.deleteComplaint(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );
  return SuccessResponse(res, "Complaint deleted successfully", result, statusCode.OK);
});

// ==========================================
// COMPLAINT COMMENTS CONTROLLERS
// ==========================================

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/comments
 * @desc    Add a comment / activity update to a complaint
 * @access  Private (Authenticated Tenant User)
 */
export const addComplaintComment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = addComplaintCommentSchema.parse({ params: req.params, body: req.body });
  const result = await complaintService.addComment(
    parsed.params.projectId,
    parsed.params.complaintId,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Comment added successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/complaints/:complaintId/comments
 * @desc    Get all comments for a complaint
 * @access  Private (Authenticated Tenant User)
 */
export const getComplaintComments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = complaintCommentsParamSchema.parse({ params: req.params });
  const result = await complaintService.getComments(
    parsed.params.projectId,
    parsed.params.complaintId,
    organizationId
  );
  return SuccessResponse(res, "Comments retrieved successfully", result, statusCode.OK);
});

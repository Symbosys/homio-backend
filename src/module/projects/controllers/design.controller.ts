import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { DesignService } from "../services/design.service.js";
import {
  createDesignFolderSchema,
  updateDesignFolderSchema,
  getDesignFoldersQuerySchema,
  createProjectDesignSchema,
  updateProjectDesignSchema,
  getProjectDesignsQuerySchema,
  createDesignVersionSchema,
  updateDesignVersionSchema,
  submitDesignVersionSchema,
  createDesignAttachmentSchema,
  updateDesignAttachmentSchema,
  createDesignApprovalSchema,
  createDesignChangeRequestSchema,
  respondDesignChangeRequestSchema,
  getDesignChangeRequestsQuerySchema,
} from "../validators/design.validator.js";

export const designService = new DesignService();

// ============================================================================
// 1. DESIGN FOLDERS CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/design-folders
 * @desc    Create a new design folder (or nested room/stage sub-folder)
 * @access  Private (Authenticated Tenant User)
 */
export const createDesignFolder = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createDesignFolderSchema.parse({ params: req.params, body: req.body });
  const result = await designService.createFolder(parsed.params.projectId, organizationId, parsed.body);
  return SuccessResponse(res, "Design folder created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/design-folders
 * @desc    Fetch list of design folders (or recursive tree hierarchy) with room and stage filters
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignFolders = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getDesignFoldersQuerySchema.parse({ params: req.params, query: req.query });
  const result = await designService.getFolders(parsed.params.projectId, organizationId, parsed.query);
  return SuccessResponse(res, "Design folders retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/design-folders/:id
 * @desc    Fetch single folder details with children and contained designs
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignFolderById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getFolderById(req.params.projectId as string, organizationId, req.params.id as string);
  return SuccessResponse(res, "Design folder retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/design-folders/:id
 * @desc    Partial update of design folder metadata, stage, color, and budget
 * @access  Private (Authenticated Tenant User)
 */
export const updateDesignFolder = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateDesignFolderSchema.parse({ params: req.params, body: req.body });
  const result = await designService.updateFolder(parsed.params.projectId, organizationId, parsed.params.id, parsed.body);
  return SuccessResponse(res, "Design folder updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/design-folders/:id
 * @desc    Soft delete a design folder
 * @access  Private (Authenticated Tenant User)
 */
export const deleteDesignFolder = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  await designService.deleteFolder(req.params.projectId as string, organizationId, req.params.id as string);
  return SuccessResponse(res, "Design folder deleted successfully", null, statusCode.OK);
});

// ============================================================================
// 2. MASTER DESIGNS CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs
 * @desc    Create a master design asset with initial v1 version and optional attachments
 * @access  Private (Authenticated Tenant User)
 */
export const createProjectDesign = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createProjectDesignSchema.parse({ params: req.params, body: req.body });
  const result = await designService.createDesign(parsed.params.projectId, organizationId, parsed.body);
  return SuccessResponse(res, "Design asset created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs
 * @desc    Fetch paginated list of designs with room, type, status, and milestone filters
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectDesigns = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getProjectDesignsQuerySchema.parse({ params: req.params, query: req.query });
  const result = await designService.getDesigns(parsed.params.projectId, organizationId, parsed.query);
  return SuccessResponse(res, "Design assets retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:id
 * @desc    Fetch comprehensive design details with versions, attachments, and change requests
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectDesignById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getDesignById(req.params.projectId as string, organizationId, req.params.id as string);
  return SuccessResponse(res, "Design asset retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:id
 * @desc    Partial dirty update of master design specifications and metadata
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectDesign = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectDesignSchema.parse({ params: req.params, body: req.body });
  const result = await designService.updateDesign(parsed.params.projectId, organizationId, parsed.params.id, parsed.body);
  return SuccessResponse(res, "Design asset updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/designs/:id
 * @desc    Soft delete a master design asset
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProjectDesign = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  await designService.deleteDesign(req.params.projectId as string, organizationId, req.params.id as string);
  return SuccessResponse(res, "Design asset deleted successfully", null, statusCode.OK);
});

// ============================================================================
// 3. DESIGN VERSIONS CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions
 * @desc    Create a new design revision version (v2, v3) with changelog and attachments
 * @access  Private (Authenticated Tenant User)
 */
export const createDesignVersion = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createDesignVersionSchema.parse({ params: req.params, body: req.body });
  const result = await designService.createVersion(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.body
  );
  return SuccessResponse(res, "Design version revision created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions
 * @desc    List all version revision snapshots for a design asset
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignVersions = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getVersions(
    req.params.projectId as string,
    organizationId,
    req.params.designId as string
  );
  return SuccessResponse(res, "Design versions retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId
 * @desc    Fetch specific design version details with attachments, approvals, and change requests
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignVersionById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getVersionById(
    req.params.projectId as string,
    organizationId,
    req.params.designId as string,
    req.params.versionId as string
  );
  return SuccessResponse(res, "Design version retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:designId/versions/:versionId
 * @desc    Update version changelog and notes (blocked if version is locked/approved)
 * @access  Private (Authenticated Tenant User)
 */
export const updateDesignVersion = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateDesignVersionSchema.parse({ params: req.params, body: req.body });
  const result = await designService.updateVersion(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    parsed.body
  );
  return SuccessResponse(res, "Design version updated successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/submit
 * @desc    Submit design version for client review (transitions status from DRAFT to SUBMITTED)
 * @access  Private (Authenticated Tenant User)
 */
export const submitDesignVersion = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = submitDesignVersionSchema.parse({ params: req.params, body: req.body });
  const result = await designService.submitVersion(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    parsed.body.submittedById,
    parsed.body.submissionNotes
  );
  return SuccessResponse(res, "Design version submitted for client review", result, statusCode.OK);
});

// ============================================================================
// 4. DESIGN ATTACHMENTS CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments
 * @desc    Add attachment to a design version (PDF, render image, DWG, GLB, YouTube/Vimeo, 3D preview URL)
 * @access  Private (Authenticated Tenant User)
 */
export const createDesignAttachment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createDesignAttachmentSchema.parse({ params: req.params, body: req.body });
  const result = await designService.createAttachment(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    parsed.body
  );
  return SuccessResponse(res, "Design attachment added successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments
 * @desc    List all attachments of a design version
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignAttachments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getAttachments(
    req.params.projectId as string,
    organizationId,
    req.params.designId as string,
    req.params.versionId as string
  );
  return SuccessResponse(res, "Design attachments retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments/:attachmentId
 * @desc    Update attachment metadata (title, caption, primary flag, orderIndex, client visibility)
 * @access  Private (Authenticated Tenant User)
 */
export const updateDesignAttachment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateDesignAttachmentSchema.parse({ params: req.params, body: req.body });
  const result = await designService.updateAttachment(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    parsed.params.attachmentId,
    parsed.body
  );
  return SuccessResponse(res, "Design attachment updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments/:attachmentId
 * @desc    Delete an attachment from a design version (blocked if version is locked)
 * @access  Private (Authenticated Tenant User)
 */
export const deleteDesignAttachment = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  await designService.deleteAttachment(
    req.params.projectId as string,
    organizationId,
    req.params.designId as string,
    req.params.versionId as string,
    req.params.attachmentId as string
  );
  return SuccessResponse(res, "Design attachment deleted successfully", null, statusCode.OK);
});

// ============================================================================
// 5. CLIENT APPROVALS CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/approvals
 * @desc    Client submits formal signoff/decision on a design version (locks version upon approval)
 * @access  Private (Authenticated Tenant / Client User)
 */
export const createDesignApproval = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("User authentication & organization context required", statusCode.Bad_Request);
  }

  const parsed = createDesignApprovalSchema.parse({ params: req.params, body: req.body });

  // Enrich with request metadata if not supplied
  const enrichedBody = {
    ...parsed.body,
    digitalSignature: parsed.body.digitalSignature ? {
      ...parsed.body.digitalSignature,
      ipAddress: parsed.body.digitalSignature.ipAddress || req.ip || "",
      userAgent: parsed.body.digitalSignature.userAgent || req.headers["user-agent"] || "",
      signedAt: parsed.body.digitalSignature.signedAt || new Date().toISOString(),
    } : null,
  };

  const result = await designService.createApproval(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    userId,
    enrichedBody
  );
  return SuccessResponse(res, "Design approval decision recorded successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/approvals
 * @desc    Fetch audit history of approval decisions for a design version
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignApprovals = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getApprovals(
    req.params.projectId as string,
    organizationId,
    req.params.designId as string,
    req.params.versionId as string
  );
  return SuccessResponse(res, "Design approvals audit trail retrieved successfully", result, statusCode.OK);
});

// ============================================================================
// 6. CHANGE REQUESTS CONTROLLERS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests
 * @desc    Client files change request with coordinate pin annotations on drawing/render sheets
 * @access  Private (Authenticated Tenant / Client User)
 */
export const createDesignChangeRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id || null;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createDesignChangeRequestSchema.parse({ params: req.params, body: req.body });
  const result = await designService.createChangeRequest(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    userId,
    parsed.body
  );
  return SuccessResponse(res, "Design change request filed successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests
 * @desc    List all change requests for a design version with status and category filters
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignChangeRequests = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getDesignChangeRequestsQuerySchema.parse({ params: req.params, query: req.query });
  const result = await designService.getChangeRequests(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    parsed.query
  );
  return SuccessResponse(res, "Design change requests retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests/:changeRequestId
 * @desc    Fetch details of a single change request with coordinate markers and inspiration media
 * @access  Private (Authenticated Tenant User)
 */
export const getDesignChangeRequestById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await designService.getChangeRequestById(
    req.params.projectId as string,
    organizationId,
    req.params.designId as string,
    req.params.versionId as string,
    req.params.changeRequestId as string
  );
  return SuccessResponse(res, "Design change request retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests/:changeRequestId/respond
 * @desc    Designer responds to change request with impact estimates and resolving version link
 * @access  Private (Authenticated Tenant User)
 */
export const respondDesignChangeRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = respondDesignChangeRequestSchema.parse({ params: req.params, body: req.body });
  const result = await designService.respondChangeRequest(
    parsed.params.projectId,
    organizationId,
    parsed.params.designId,
    parsed.params.versionId,
    parsed.params.changeRequestId,
    parsed.body
  );
  return SuccessResponse(res, "Design change request responded successfully", result, statusCode.OK);
});

import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createProjectDesign,
  getProjectDesigns,
  getProjectDesignById,
  updateProjectDesign,
  deleteProjectDesign,
  createDesignVersion,
  getDesignVersions,
  getDesignVersionById,
  updateDesignVersion,
  submitDesignVersion,
  createDesignAttachment,
  getDesignAttachments,
  updateDesignAttachment,
  deleteDesignAttachment,
  createDesignApproval,
  getDesignApprovals,
  createDesignChangeRequest,
  getDesignChangeRequests,
  getDesignChangeRequestById,
  respondDesignChangeRequest,
} from "../controllers/design.controller.js";

const designRoutes = Router({ mergeParams: true });

// Protect all design routes with authentication
designRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

// ============================================================================
// 1. MASTER DESIGNS ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs
 * @desc    Create a master design asset with initial v1 version and optional attachments
 */
designRoutes.post("/", createProjectDesign);

/**
 * @route   GET /api/v1/projects/:projectId/designs
 * @desc    Fetch paginated list of designs with room, type, status, and milestone filters
 */
designRoutes.get("/", getProjectDesigns);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:id
 * @desc    Fetch comprehensive design details with versions, attachments, and change requests
 */
designRoutes.get("/:id", getProjectDesignById);

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:id
 * @desc    Partial dirty update of master design specifications and metadata
 */
designRoutes.patch("/:id", updateProjectDesign);

/**
 * @route   DELETE /api/v1/projects/:projectId/designs/:id
 * @desc    Soft delete a master design asset
 */
designRoutes.delete("/:id", deleteProjectDesign);

// ============================================================================
// 2. DESIGN VERSIONS ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions
 * @desc    Create a new design revision version (v2, v3) with changelog and attachments
 */
designRoutes.post("/:designId/versions", createDesignVersion);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions
 * @desc    List all version revision snapshots for a design asset
 */
designRoutes.get("/:designId/versions", getDesignVersions);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId
 * @desc    Fetch specific design version details with attachments, approvals, and change requests
 */
designRoutes.get("/:designId/versions/:versionId", getDesignVersionById);

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:designId/versions/:versionId
 * @desc    Update version changelog and notes (blocked if version is locked/approved)
 */
designRoutes.patch("/:designId/versions/:versionId", updateDesignVersion);

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/submit
 * @desc    Submit design version for client review (transitions status from DRAFT to SUBMITTED)
 */
designRoutes.post("/:designId/versions/:versionId/submit", submitDesignVersion);

// ============================================================================
// 3. DEDICATED ATTACHMENTS ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments
 * @desc    Add attachment to a design version (PDF, render image, DWG, GLB, YouTube/Vimeo, 3D preview URL)
 */
designRoutes.post("/:designId/versions/:versionId/attachments", createDesignAttachment);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments
 * @desc    List all attachments of a design version
 */
designRoutes.get("/:designId/versions/:versionId/attachments", getDesignAttachments);

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments/:attachmentId
 * @desc    Update attachment metadata (title, caption, primary flag, orderIndex, client visibility)
 */
designRoutes.patch("/:designId/versions/:versionId/attachments/:attachmentId", updateDesignAttachment);

/**
 * @route   DELETE /api/v1/projects/:projectId/designs/:designId/versions/:versionId/attachments/:attachmentId
 * @desc    Delete an attachment from a design version (blocked if version is locked)
 */
designRoutes.delete("/:designId/versions/:versionId/attachments/:attachmentId", deleteDesignAttachment);

// ============================================================================
// 4. CLIENT APPROVALS ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/approvals
 * @desc    Client submits formal signoff/decision on a design version (locks version upon approval)
 */
designRoutes.post("/:designId/versions/:versionId/approvals", createDesignApproval);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/approvals
 * @desc    Fetch audit history of approval decisions for a design version
 */
designRoutes.get("/:designId/versions/:versionId/approvals", getDesignApprovals);

// ============================================================================
// 5. CHANGE REQUESTS ENDPOINTS
// ============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests
 * @desc    Client files change request with coordinate pin annotations on drawing/render sheets
 */
designRoutes.post("/:designId/versions/:versionId/change-requests", createDesignChangeRequest);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests
 * @desc    List all change requests for a design version with status and category filters
 */
designRoutes.get("/:designId/versions/:versionId/change-requests", getDesignChangeRequests);

/**
 * @route   GET /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests/:changeRequestId
 * @desc    Fetch details of a single change request with coordinate markers and inspiration media
 */
designRoutes.get("/:designId/versions/:versionId/change-requests/:changeRequestId", getDesignChangeRequestById);

/**
 * @route   PATCH /api/v1/projects/:projectId/designs/:designId/versions/:versionId/change-requests/:changeRequestId/respond
 * @desc    Designer responds to change request with impact estimates and resolving version link
 */
designRoutes.patch("/:designId/versions/:versionId/change-requests/:changeRequestId/respond", respondDesignChangeRequest);

export default designRoutes;

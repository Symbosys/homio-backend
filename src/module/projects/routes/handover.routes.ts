import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createHandover,
  getHandovers,
  getHandoverById,
  getHandoverReadiness,
  updateHandover,
  updateHandoverStatus,
  updateCommercialClearance,
  clientSignoff,
  deleteHandover,
  addItem,
  getItems,
  getItemById,
  updateItem,
  updateItemStatus,
  bulkHandoverItems,
  deleteItem,
  addSnag,
  getSnags,
  getSnagById,
  updateSnag,
  resolveSnag,
  verifySnag,
  deleteSnag,
} from "../controllers/handover.controller.js";

const handoverRoutes = Router({ mergeParams: true });

// Protect all handover routes with authentication & role-based authorization
handoverRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

// Multer upload configurations for multi-cloud storage
const handoverUpload = upload.fields(
  [
    { name: "warrantyDoc", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "signature", maxCount: 1 },
    { name: "sitePhotos", maxCount: 10 },
  ],
  { category: "all" }
);

const signoffUpload = upload.fields(
  [
    { name: "signature", maxCount: 1 },
    { name: "certificate", maxCount: 1 },
    { name: "sitePhotos", maxCount: 10 },
  ],
  { category: "all" }
);

const itemUpload = upload.fields(
  [{ name: "document", maxCount: 1 }],
  { category: "all" }
);

const snagBeforeUpload = upload.fields(
  [{ name: "beforePhoto", maxCount: 1 }],
  { category: "all" }
);

const snagResolveUpload = upload.fields(
  [{ name: "afterPhoto", maxCount: 1 }],
  { category: "all" }
);

// ==========================================
// 1. ROOT PROJECT HANDOVER ROUTES
// ==========================================

/**
 * @route   POST /api/v1/projects/handovers
 * @desc    Create a new project handover docket with warranties, initial items, snags, and cloud documents
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.post("/", handoverUpload, createHandover);

/**
 * @route   GET /api/v1/projects/handovers
 * @desc    Fetch paginated list of project handovers with search, status, and commercial filters
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/", getHandovers);

/**
 * @route   GET /api/v1/projects/handovers/:id
 * @desc    Fetch single project handover by ID with deliverable checklist and snag items
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/:id", getHandoverById);

/**
 * @route   GET /api/v1/projects/handovers/:id/readiness
 * @desc    Compute comprehensive pre-handover readiness audit (commercial status, open snags, pending items)
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/:id/readiness", getHandoverReadiness);

/**
 * @route   PATCH /api/v1/projects/handovers/:id
 * @desc    Update project handover details, dates, warranty terms, and documents
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:id", handoverUpload, updateHandover);

/**
 * @route   PATCH /api/v1/projects/handovers/:id/status
 * @desc    Transition handover status across lifecycle states and cascade to parent project
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:id/status", updateHandoverStatus);

/**
 * @route   PATCH /api/v1/projects/handovers/:id/commercial-clearance
 * @desc    Approve commercial clearance, final settlement, and outstanding balance
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:id/commercial-clearance", updateCommercialClearance);

/**
 * @route   POST /api/v1/projects/handovers/:id/client-signoff
 * @desc    Record client digital touch signature, rating, feedback, and site walkthrough verification photos
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.post("/:id/client-signoff", signoffUpload, clientSignoff);

/**
 * @route   DELETE /api/v1/projects/handovers/:id
 * @desc    Permanently delete a handover docket (only allowed if DRAFT, REJECTED, or CANCELLED)
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.delete("/:id", deleteHandover);

// ==========================================
// 2. DELIVERABLE CHECKLIST ITEMS SUB-ROUTES
// ==========================================

/**
 * @route   POST /api/v1/projects/handovers/:id/items
 * @desc    Add a physical or digital deliverable item (keys, warranty docs, manuals) to the handover docket
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.post("/:id/items", itemUpload, addItem);

/**
 * @route   GET /api/v1/projects/handovers/:id/items
 * @desc    Fetch all deliverable items for a handover docket with category and status filters
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/:id/items", getItems);

/**
 * @route   POST /api/v1/projects/handovers/:id/items/bulk-handover
 * @desc    Hand over multiple checklist items in bulk to the client / recipient
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.post("/:id/items/bulk-handover", bulkHandoverItems);

/**
 * @route   GET /api/v1/projects/handovers/:handoverId/items/:itemId
 * @desc    Fetch single deliverable item details by ID
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/:handoverId/items/:itemId", getItemById);

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/items/:itemId
 * @desc    Update deliverable item information, recipient name, or uploaded document
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:handoverId/items/:itemId", itemUpload, updateItem);

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/items/:itemId/status
 * @desc    Update single deliverable item status (VERIFIED, HANDED_OVER, etc.)
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:handoverId/items/:itemId/status", updateItemStatus);

/**
 * @route   DELETE /api/v1/projects/handovers/:handoverId/items/:itemId
 * @desc    Delete a deliverable item from the handover checklist
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.delete("/:handoverId/items/:itemId", deleteItem);

// ==========================================
// 3. PRE-HANDOVER SNAGS / PUNCH-LIST SUB-ROUTES
// ==========================================

/**
 * @route   POST /api/v1/projects/handovers/:id/snags
 * @desc    Report a pre-handover defect / snag ticket with severity and cloud before photo
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.post("/:id/snags", snagBeforeUpload, addSnag);

/**
 * @route   GET /api/v1/projects/handovers/:id/snags
 * @desc    Fetch punch-list snags for a handover docket with severity, status, and room filters
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/:id/snags", getSnags);

/**
 * @route   GET /api/v1/projects/handovers/:handoverId/snags/:snagId
 * @desc    Fetch single punch-list snag details by ID
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.get("/:handoverId/snags/:snagId", getSnagById);

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/snags/:snagId
 * @desc    Update snag details, assigned technician, severity, or before photo
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:handoverId/snags/:snagId", snagBeforeUpload, updateSnag);

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/snags/:snagId/resolve
 * @desc    Mark snag as resolved with rectification notes and cloud after photo proof
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:handoverId/snags/:snagId/resolve", snagResolveUpload, resolveSnag);

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/snags/:snagId/verify
 * @desc    Verify resolved snag by client or supervisor (ACCEPTED_BY_CLIENT or WAIVED)
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.patch("/:handoverId/snags/:snagId/verify", verifySnag);

/**
 * @route   DELETE /api/v1/projects/handovers/:handoverId/snags/:snagId
 * @desc    Delete a snag ticket from the punch-list
 * @access  Private (Authenticated Tenant User)
 */
handoverRoutes.delete("/:handoverId/snags/:snagId", deleteSnag);

export { handoverRoutes };
export default handoverRoutes;

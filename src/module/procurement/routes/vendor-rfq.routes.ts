import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createVendorRfq,
  getVendorRfqs,
  getVendorRfqById,
  updateVendorRfq,
  deleteVendorRfq,
  updateVendorRfqStatus,
  addRfqItem,
  updateRfqItem,
  removeRfqItem,
  inviteVendor,
  getRfqInvites,
  updateRfqInvite,
  removeRfqInvite,
} from "../controllers/vendor-rfq.controller.js";

const router = Router();

// Apply auth to all procurement RFQ routes
router.use(authenticate);

/**
 * @route   POST /api/v1/procurement/vendor-rfqs
 * @desc    Create a new RFQ with items and vendor invites for a project
 * @access  Private
 */
router.post("/", createVendorRfq);

/**
 * @route   GET /api/v1/procurement/vendor-rfqs
 * @desc    Fetch paginated list of RFQs with filters
 * @access  Private
 */
router.get("/", getVendorRfqs);

/**
 * @route   GET /api/v1/procurement/vendor-rfqs/:id
 * @desc    Fetch single RFQ with items, invites, and bids
 * @access  Private
 */
router.get("/:id", getVendorRfqById);

/**
 * @route   PATCH /api/v1/procurement/vendor-rfqs/:id
 * @desc    Update RFQ header details
 * @access  Private
 */
router.patch("/:id", updateVendorRfq);

/**
 * @route   DELETE /api/v1/procurement/vendor-rfqs/:id
 * @desc    Soft-delete an RFQ
 * @access  Private
 */
router.delete("/:id", deleteVendorRfq);

/**
 * @route   PATCH /api/v1/procurement/vendor-rfqs/:id/status
 * @desc    Transition RFQ status (e.g. SENT, RESPONSES_RECEIVED, CLOSED)
 * @access  Private
 */
router.patch("/:id/status", updateVendorRfqStatus);

// ==========================================
// RFQ Items
// ==========================================

/**
 * @route   POST /api/v1/procurement/vendor-rfqs/:id/items
 * @desc    Add a requested item to an RFQ
 * @access  Private
 */
router.post("/:id/items", addRfqItem);

/**
 * @route   PATCH /api/v1/procurement/vendor-rfqs/:rfqId/items/:itemId
 * @desc    Update an RFQ item
 * @access  Private
 */
router.patch("/:rfqId/items/:itemId", updateRfqItem);

/**
 * @route   DELETE /api/v1/procurement/vendor-rfqs/:rfqId/items/:itemId
 * @desc    Remove an item from an RFQ
 * @access  Private
 */
router.delete("/:rfqId/items/:itemId", removeRfqItem);

// ==========================================
// RFQ Invites
// ==========================================

/**
 * @route   POST /api/v1/procurement/vendor-rfqs/:id/invites
 * @desc    Invite a vendor to submit a bid for the RFQ
 * @access  Private
 */
router.post("/:id/invites", inviteVendor);

/**
 * @route   GET /api/v1/procurement/vendor-rfqs/:id/invites
 * @desc    List all invited vendors for an RFQ
 * @access  Private
 */
router.get("/:id/invites", getRfqInvites);

/**
 * @route   PATCH /api/v1/procurement/vendor-rfqs/:rfqId/invites/:inviteId
 * @desc    Update vendor invite status (e.g. VIEWED, RESPONDED, DECLINED)
 * @access  Private
 */
router.patch("/:rfqId/invites/:inviteId", updateRfqInvite);

/**
 * @route   DELETE /api/v1/procurement/vendor-rfqs/:rfqId/invites/:inviteId
 * @desc    Remove a vendor invite from an RFQ
 * @access  Private
 */
router.delete("/:rfqId/invites/:inviteId", removeRfqInvite);

export default router;

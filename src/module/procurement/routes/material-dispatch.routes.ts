import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createMaterialDispatch,
  getMaterialDispatches,
  getMaterialDispatchById,
  updateMaterialDispatch,
  deleteMaterialDispatch,
  updateMaterialDispatchStatus,
  bulkReceiveDispatch,
  uploadDispatchSignature,
  addDispatchItem,
  updateDispatchItem,
  removeDispatchItem,
} from "../controllers/material-dispatch.controller.js";

const router = Router();

// Apply auth to all procurement dispatch routes
router.use(authenticate);

/**
 * @route   POST /api/v1/procurement/material-dispatches
 * @desc    Create a new consignment dispatch record
 * @access  Private
 */
router.post("/", createMaterialDispatch);

/**
 * @route   GET /api/v1/procurement/material-dispatches
 * @desc    Fetch paginated list of material dispatches with logistics filters
 * @access  Private
 */
router.get("/", getMaterialDispatches);

/**
 * @route   GET /api/v1/procurement/material-dispatches/:id
 * @desc    Fetch single dispatch details with all items and transporter info
 * @access  Private
 */
router.get("/:id", getMaterialDispatchById);

/**
 * @route   PATCH /api/v1/procurement/material-dispatches/:id
 * @desc    Update dispatch header details
 * @access  Private
 */
router.patch("/:id", updateMaterialDispatch);

/**
 * @route   DELETE /api/v1/procurement/material-dispatches/:id
 * @desc    Soft-delete a dispatch record
 * @access  Private
 */
router.delete("/:id", deleteMaterialDispatch);

/**
 * @route   PATCH /api/v1/procurement/material-dispatches/:id/status
 * @desc    Transition dispatch status (e.g. IN_TRANSIT, DELIVERED, RECEIVED, REJECTED)
 * @access  Private
 */
router.patch("/:id/status", updateMaterialDispatchStatus);

/**
 * @route   PATCH /api/v1/procurement/material-dispatches/:id/receive
 * @desc    Bulk site receipt: verify received/accepted/rejected quantities and QA condition
 * @access  Private
 */
router.patch("/:id/receive", bulkReceiveDispatch);

/**
 * @route   PATCH /api/v1/procurement/material-dispatches/:id/signature
 * @desc    Upload site supervisor signature and proof of delivery images
 * @access  Private
 */
router.patch(
  "/:id/signature",
  upload.fields([
    { name: "signature", maxCount: 1 },
    { name: "proof", maxCount: 1 },
  ]),
  uploadDispatchSignature
);

// ==========================================
// Dispatch Items
// ==========================================

/**
 * @route   POST /api/v1/procurement/material-dispatches/:id/items
 * @desc    Add a line item to a dispatch
 * @access  Private
 */
router.post("/:id/items", addDispatchItem);

/**
 * @route   PATCH /api/v1/procurement/material-dispatches/:dispatchId/items/:itemId
 * @desc    Update an individual dispatch item
 * @access  Private
 */
router.patch("/:dispatchId/items/:itemId", updateDispatchItem);

/**
 * @route   DELETE /api/v1/procurement/material-dispatches/:dispatchId/items/:itemId
 * @desc    Remove an item from a dispatch
 * @access  Private
 */
router.delete("/:dispatchId/items/:itemId", removeDispatchItem);

export default router;

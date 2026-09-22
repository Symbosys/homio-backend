import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createMaterialRequest,
  getMaterialRequests,
  getMaterialRequestById,
  updateMaterialRequest,
  deleteMaterialRequest,
  updateMaterialRequestStatus,
  addMaterialRequestItem,
  updateMaterialRequestItem,
  removeMaterialRequestItem,
} from "../controllers/material-request.controller.js";

const router = Router();

// Apply auth to all procurement material request routes
router.use(authenticate);

/**
 * @route   POST /api/v1/procurement/material-requests
 * @desc    Create a new site material requisition with initial line items
 * @access  Private
 */
router.post("/", createMaterialRequest);

/**
 * @route   GET /api/v1/procurement/material-requests
 * @desc    Fetch paginated list of material requests with filters
 * @access  Private
 */
router.get("/", getMaterialRequests);

/**
 * @route   GET /api/v1/procurement/material-requests/:id
 * @desc    Fetch single material request details including line items and stakeholders
 * @access  Private
 */
router.get("/:id", getMaterialRequestById);

/**
 * @route   PATCH /api/v1/procurement/material-requests/:id
 * @desc    Update material request header fields
 * @access  Private
 */
router.patch("/:id", updateMaterialRequest);

/**
 * @route   DELETE /api/v1/procurement/material-requests/:id
 * @desc    Soft-delete a material request
 * @access  Private
 */
router.delete("/:id", deleteMaterialRequest);

/**
 * @route   PATCH /api/v1/procurement/material-requests/:id/status
 * @desc    Transition status of material request (e.g. APPROVED, REJECTED, IN_PROCUREMENT)
 * @access  Private
 */
router.patch("/:id/status", updateMaterialRequestStatus);

/**
 * @route   POST /api/v1/procurement/material-requests/:id/items
 * @desc    Add a line item to an existing material request
 * @access  Private
 */
router.post("/:id/items", addMaterialRequestItem);

/**
 * @route   PATCH /api/v1/procurement/material-requests/:requestId/items/:itemId
 * @desc    Update a line item in a material request
 * @access  Private
 */
router.patch("/:requestId/items/:itemId", updateMaterialRequestItem);

/**
 * @route   DELETE /api/v1/procurement/material-requests/:requestId/items/:itemId
 * @desc    Remove a line item from a material request
 * @access  Private
 */
router.delete("/:requestId/items/:itemId", removeMaterialRequestItem);

export default router;

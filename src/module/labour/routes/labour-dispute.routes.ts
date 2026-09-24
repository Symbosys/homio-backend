import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createLabourDispute,
  getAllLabourDisputes,
  getLabourDisputeById,
  updateLabourDispute,
  updateLabourDisputeStatus,
  deleteLabourDispute,
} from "../controllers/labour-dispute.controller.js";

const router = Router();

// Protect all dispute endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/labour/disputes
 * @desc    File a new dispute with multi-file evidence upload
 * 
 * @route   GET /api/v1/labour/disputes
 * @desc    Get paginated disputes
 */
router
  .route("/disputes")
  .post(upload.array("evidenceDocs", 5, { category: "all" }), createLabourDispute)
  .get(getAllLabourDisputes);

/**
 * @route   GET /api/v1/labour/disputes/:id
 * @desc    Get dispute by ID
 * 
 * @route   PUT /api/v1/labour/disputes/:id
 * @desc    Update dispute
 * 
 * @route   DELETE /api/v1/labour/disputes/:id
 * @desc    Delete dispute
 */
router
  .route("/disputes/:id")
  .get(getLabourDisputeById)
  .put(upload.array("evidenceDocs", 5, { category: "all" }), updateLabourDispute)
  .delete(deleteLabourDispute);

/**
 * @route   PATCH /api/v1/labour/disputes/:id/status
 * @desc    Update dispute status
 */
router.patch("/disputes/:id/status", updateLabourDisputeStatus);

export default router;

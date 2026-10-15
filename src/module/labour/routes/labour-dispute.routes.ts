import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createLabourDispute,
  reportBypassAttempt,
  reportClientPaymentDue,
  reportLabourAbandonment,
  assignEmpanelledLawyer,
  recordLegalNotice,
  recordLabourCourtAction,
  getAllLabourDisputes,
  getLabourDisputeById,
  updateLabourDispute,
  updateLabourDisputeStatus,
  deleteLabourDispute,
  takeLabourDisputeAction,
} from "../controllers/labour-dispute.controller.js";

const router = Router();

// Protect all dispute endpoints with authentication
router.use("/disputes", authenticate);

/**
 * @route   POST /api/v1/labour/disputes/bypass-report
 * @desc    Report off-platform cash bypass attempt
 */
router.post(
  "/disputes/bypass-report",
  upload.array("evidenceDocs", 5, { category: "all" }),
  reportBypassAttempt
);

/**
 * @route   POST /api/v1/labour/disputes/client-payment-due
 * @desc    Worker reports client payment default
 */
router.post(
  "/disputes/client-payment-due",
  upload.array("evidenceDocs", 5, { category: "all" }),
  reportClientPaymentDue
);

/**
 * @route   POST /api/v1/labour/disputes/labour-abandonment
 * @desc    Client reports worker work abandonment
 */
router.post(
  "/disputes/labour-abandonment",
  upload.array("evidenceDocs", 5, { category: "all" }),
  reportLabourAbandonment
);

/**
 * @route   POST /api/v1/labour/disputes/:id/assign-lawyer
 * @desc    Assign empanelled lawyer to dispute
 */
router.post("/disputes/:id/assign-lawyer", assignEmpanelledLawyer);

/**
 * @route   POST /api/v1/labour/disputes/:id/legal-notice
 * @desc    Record formal demand/legal notice dispatched
 */
router.post("/disputes/:id/legal-notice", recordLegalNotice);

/**
 * @route   POST /api/v1/labour/disputes/:id/labour-court
 * @desc    Record claim petition filed in Labour Court
 */
router.post("/disputes/:id/labour-court", recordLabourCourtAction);

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

/**
 * @route   PATCH /api/v1/labour/disputes/:id/take-action
 * @desc    Platform Admin takes action against dispute (rating reduction, warning, blacklisting, legal proceedings)
 */
router.patch("/disputes/:id/take-action", takeLabourDisputeAction);

export default router;

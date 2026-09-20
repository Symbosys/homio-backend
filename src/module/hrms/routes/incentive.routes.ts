import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as incentiveController from "../controllers/incentive.controller.js";

const router = Router();

// Protect all incentive endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/hrms/incentives/my-incentives
 * @desc    Fetch authenticated employee's earned sales bonuses and project commissions
 */
router.get("/my-incentives", incentiveController.getMyIncentives);

/**
 * @route   GET /api/v1/hrms/incentives/summary
 * @desc    Fetch organization-wide incentive KPI metrics (total approved, pending payout, average bonus)
 */
router.get("/summary", incentiveController.getSummaryMetrics);

/**
 * @route   POST /api/v1/hrms/incentives
 * @desc    Create and submit a new incentive reward / performance bonus with supporting files
 */
router.post(
  "/",
  upload.array("documents", 5, { category: "document" }),
  incentiveController.createIncentive
);

/**
 * @route   GET /api/v1/hrms/incentives
 * @desc    Fetch paginated list of all organization employee incentives with status and date filters
 */
router.get("/", incentiveController.getAllIncentives);

/**
 * @route   GET /api/v1/hrms/incentives/:id
 * @desc    Get detailed incentive claim record by ID including approval timeline
 */
router.get("/:id", incentiveController.getIncentiveById);

/**
 * @route   PATCH /api/v1/hrms/incentives/:id
 * @desc    Update draft incentive amount, title, or category
 */
router.patch("/:id", incentiveController.updateIncentive);

/**
 * @route   PATCH /api/v1/hrms/incentives/:id/approve
 * @desc    Approve pending incentive for payroll disbursement
 */
router.patch("/:id/approve", incentiveController.approveIncentive);

/**
 * @route   PATCH /api/v1/hrms/incentives/:id/reject
 * @desc    Reject incentive claim with feedback note
 */
router.patch("/:id/reject", incentiveController.rejectIncentive);

/**
 * @route   PATCH /api/v1/hrms/incentives/:id/cancel
 * @desc    Cancel an incentive request
 */
router.patch("/:id/cancel", incentiveController.cancelIncentive);

/**
 * @route   DELETE /api/v1/hrms/incentives/:id
 * @desc    Soft-delete / remove incentive entry
 */
router.delete("/:id", incentiveController.deleteIncentive);

export default router;

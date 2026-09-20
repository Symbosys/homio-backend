import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as noticePeriodController from "../controllers/notice-period.controller.js";

const router = Router();

// Protect all notice period endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/hrms/notice-periods/my-notice-period
 * @desc    Fetch authenticated employee's active resignation status, exit checklist, and LWD
 */
router.get("/my-notice-period", noticePeriodController.getMyNoticePeriods);

/**
 * @route   POST /api/v1/hrms/notice-periods/apply
 * @desc    Submit formal employee resignation request with resignation letter attachments
 */
router.post(
  "/apply",
  upload.array("documents", 5, { category: "document" }),
  noticePeriodController.applyNoticePeriod
);

/**
 * @route   GET /api/v1/hrms/notice-periods
 * @desc    Fetch paginated list of all active employee resignations and exit pipelines
 */
router.get("/", noticePeriodController.getAllNoticePeriods);

/**
 * @route   GET /api/v1/hrms/notice-periods/:id
 * @desc    Get detailed exit application record including handover tasks and settlement calculation
 */
router.get("/:id", noticePeriodController.getNoticePeriodById);

/**
 * @route   PATCH /api/v1/hrms/notice-periods/:id/approve
 * @desc    Approve resignation and confirm official Last Working Day (LWD)
 */
router.patch("/:id/approve", noticePeriodController.approveNoticePeriod);

/**
 * @route   PATCH /api/v1/hrms/notice-periods/:id/reject
 * @desc    Reject resignation with official reasoning
 */
router.patch("/:id/reject", noticePeriodController.rejectNoticePeriod);

/**
 * @route   PATCH /api/v1/hrms/notice-periods/:id/withdraw
 * @desc    Withdraw employee resignation prior to final exit
 */
router.patch("/:id/withdraw", noticePeriodController.withdrawNoticePeriod);

/**
 * @route   PATCH /api/v1/hrms/notice-periods/:id/buyout
 * @desc    Configure notice period buyout amount and waive remaining days
 */
router.patch("/:id/buyout", noticePeriodController.updateNoticeBuyout);

/**
 * @route   PATCH /api/v1/hrms/notice-periods/:id/handover
 * @desc    Update asset return status and project knowledge transfer checklist
 */
router.patch("/:id/handover", noticePeriodController.updateHandover);

/**
 * @route   PATCH /api/v1/hrms/notice-periods/:id/complete
 * @desc    Finalize Full & Final (FnF) settlement and offboard employee
 */
router.patch("/:id/complete", noticePeriodController.completeSettlement);

export default router;

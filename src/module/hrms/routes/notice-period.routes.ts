import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as noticePeriodController from "../controllers/notice-period.controller.js";

const router = Router();

// Protect all notice period endpoints
router.use(authenticate);

// Personal notice periods / resignation status
router.get("/my-notice-period", noticePeriodController.getMyNoticePeriods);

// Resignation application & Management
router.post(
  "/apply",
  upload.array("documents", 5, { category: "document" }),
  noticePeriodController.applyNoticePeriod
);
router.get("/", noticePeriodController.getAllNoticePeriods);
router.get("/:id", noticePeriodController.getNoticePeriodById);

// Lifecycle workflows
router.patch("/:id/approve", noticePeriodController.approveNoticePeriod);
router.patch("/:id/reject", noticePeriodController.rejectNoticePeriod);
router.patch("/:id/withdraw", noticePeriodController.withdrawNoticePeriod);
router.patch("/:id/buyout", noticePeriodController.updateNoticeBuyout);
router.patch("/:id/handover", noticePeriodController.updateHandover);
router.patch("/:id/complete", noticePeriodController.completeSettlement);

export default router;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as incentiveController from "../controllers/incentive.controller.js";

const router = Router();

// Protect all incentive endpoints
router.use(authenticate);

// Personal incentives
router.get("/my-incentives", incentiveController.getMyIncentives);

// Organization aggregates
router.get("/summary", incentiveController.getSummaryMetrics);

// Incentive Management
router.post(
  "/",
  upload.array("documents", 5, { category: "document" }),
  incentiveController.createIncentive
);
router.get("/", incentiveController.getAllIncentives);
router.get("/:id", incentiveController.getIncentiveById);
router.patch("/:id", incentiveController.updateIncentive);
router.patch("/:id/approve", incentiveController.approveIncentive);
router.patch("/:id/reject", incentiveController.rejectIncentive);
router.patch("/:id/cancel", incentiveController.cancelIncentive);
router.delete("/:id", incentiveController.deleteIncentive);

export default router;

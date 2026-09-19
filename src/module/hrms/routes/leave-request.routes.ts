import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as leaveRequestController from "../controllers/leave-request.controller.js";

const router = Router();

// Protect all leave-request endpoints
router.use(authenticate);

// Personal leave endpoints
router.post(
  "/apply",
  upload.array("documents", 5, { category: "document" }),
  leaveRequestController.applyLeave
);
router.get("/my-leaves", leaveRequestController.getMyLeaves);
router.get("/my-balance", leaveRequestController.getMyLeaveBalance);

// Admin / Organization queries & analytics
router.get("/employee-balance/:employeeId", leaveRequestController.getEmployeeLeaveBalance);
router.get("/", leaveRequestController.getAllLeaveRequests);
router.get("/:id", leaveRequestController.getLeaveRequestById);

// Approval & Status workflows
router.patch("/:id/approve", leaveRequestController.approveLeave);
router.patch("/:id/reject", leaveRequestController.rejectLeave);
router.patch("/:id/cancel", leaveRequestController.cancelLeave);

export default router;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as leaveTypeController from "../controllers/leave-type.controller.js";

const router = Router();

// Protect all leave-type endpoints
router.use(authenticate);

// Leave Type CRUD
router.post("/", leaveTypeController.createLeaveType);
router.get("/", leaveTypeController.getLeaveTypes);
router.get("/:id", leaveTypeController.getLeaveTypeById);
router.patch("/:id", leaveTypeController.updateLeaveType);
router.delete("/:id", leaveTypeController.deleteLeaveType);

export default router;

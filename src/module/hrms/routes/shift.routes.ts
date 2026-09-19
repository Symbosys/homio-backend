import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as shiftController from "../controllers/shift.controller.js";

const router = Router();

// Protect all shift endpoints
router.use(authenticate);

// Shift CRUD
router.post("/", shiftController.createShift);
router.get("/", shiftController.getShifts);
router.get("/:id", shiftController.getShiftById);
router.patch("/:id", shiftController.updateShift);
router.delete("/:id", shiftController.deleteShift);

// Employee assignment
router.post("/:id/assign-employees", shiftController.assignEmployees);
router.post("/unassign-employee/:employeeId", shiftController.unassignEmployee);

export default router;

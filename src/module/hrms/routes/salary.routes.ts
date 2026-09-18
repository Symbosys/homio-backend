import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as salaryController from "../controllers/salary.controller.js";

const router = Router();

// Protect all salary endpoints with authentication
router.use(authenticate);

const ALLOWED_SALARY_DOCUMENT_MIMES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

// Record initial salary or create a new salary revision (closes previous active period automatically)
router.post(
  "/employee/:employeeId",
  upload.single("document", { allowedMimeTypes: ALLOWED_SALARY_DOCUMENT_MIMES }),
  salaryController.createSalaryRevision
);

// Get complete chronological salary history for an employee
router.get("/employee/:employeeId/history", salaryController.getEmployeeSalaryHistory);

// Get the active salary structure for an employee
router.get("/employee/:employeeId/current", salaryController.getCurrentSalary);

// Get single salary record by ID
router.get("/:id", salaryController.getSalaryById);

// Update a specific salary record
router.patch(
  "/employee/:employeeId/:salaryId",
  upload.single("document", { allowedMimeTypes: ALLOWED_SALARY_DOCUMENT_MIMES }),
  salaryController.updateSalary
);

// Delete / archive salary record
router.delete("/:id", salaryController.deleteSalary);

export default router;

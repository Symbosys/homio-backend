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

/**
 * @route   POST /api/v1/hrms/salaries/employee/:employeeId
 * @desc    Record initial compensation or create a salary revision (automatically closes previous active structure)
 */
router.post(
  "/employee/:employeeId",
  upload.single("document", { allowedMimeTypes: ALLOWED_SALARY_DOCUMENT_MIMES }),
  salaryController.createSalaryRevision
);

/**
 * @route   GET /api/v1/hrms/salaries/employee/:employeeId/history
 * @desc    Fetch complete chronological compensation revision history for an employee
 */
router.get("/employee/:employeeId/history", salaryController.getEmployeeSalaryHistory);

/**
 * @route   GET /api/v1/hrms/salaries/employee/:employeeId/current
 * @desc    Get currently active salary structure (CTC, basic, allowances, deductions) for an employee
 */
router.get("/employee/:employeeId/current", salaryController.getCurrentSalary);

/**
 * @route   GET /api/v1/hrms/salaries/:id
 * @desc    Get single salary structure record by ID
 */
router.get("/:id", salaryController.getSalaryById);

/**
 * @route   PATCH /api/v1/hrms/salaries/employee/:employeeId/:salaryId
 * @desc    Update specific salary revision record with optional proof document upload
 */
router.patch(
  "/employee/:employeeId/:salaryId",
  upload.single("document", { allowedMimeTypes: ALLOWED_SALARY_DOCUMENT_MIMES }),
  salaryController.updateSalary
);

/**
 * @route   DELETE /api/v1/hrms/salaries/:id
 * @desc    Soft-delete / remove compensation record
 */
router.delete("/:id", salaryController.deleteSalary);

export default router;

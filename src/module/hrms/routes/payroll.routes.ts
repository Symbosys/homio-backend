import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as payrollController from "../controllers/payroll.controller.js";

const router = Router();

// Protect all payroll endpoints
router.use(authenticate);

/**
 * @route   GET /api/v1/hrms/payroll/my-payslips
 * @desc    Fetch authenticated employee's generated monthly payslips and tax summaries
 */
router.get("/my-payslips", payrollController.getMyPayslips);

/**
 * @route   POST /api/v1/hrms/payroll/periods
 * @desc    Create a new monthly payroll processing cycle (month, year, cutoff dates)
 */
router.post("/periods", payrollController.createPayrollPeriod);

/**
 * @route   GET /api/v1/hrms/payroll/periods
 * @desc    Fetch paginated list of organization payroll cycles and disbursement statuses
 */
router.get("/periods", payrollController.getPayrollPeriods);

/**
 * @route   GET /api/v1/hrms/payroll/periods/:id
 * @desc    Get payroll period summary and financial breakdown by ID
 */
router.get("/periods/:id", payrollController.getPayrollPeriodById);

/**
 * @route   POST /api/v1/hrms/payroll/periods/:id/process
 * @desc    Trigger automated batch payroll calculation (net pay, attendance deductions, incentives)
 */
router.post("/periods/:id/process", payrollController.processPayrollPeriod);

/**
 * @route   PATCH /api/v1/hrms/payroll/periods/:id/disburse
 * @desc    Mark payroll period as disbursed and release employee payslips
 */
router.patch("/periods/:id/disburse", payrollController.disbursePayrollPeriod);

/**
 * @route   DELETE /api/v1/hrms/payroll/periods/:id
 * @desc    Delete unprocessed draft payroll period
 */
router.delete("/periods/:id", payrollController.deletePayrollPeriod);

/**
 * @route   GET /api/v1/hrms/payroll/records
 * @desc    Fetch paginated list of individual employee monthly payroll line items
 */
router.get("/records", payrollController.getAllPayrollRecords);

/**
 * @route   GET /api/v1/hrms/payroll/records/:id
 * @desc    Get detailed individual payslip calculation breakdown by ID
 */
router.get("/records/:id", payrollController.getPayrollRecordById);

/**
 * @route   PATCH /api/v1/hrms/payroll/records/:id
 * @desc    Manually adjust bonus, reimbursement, or deduction line items on individual payslip
 */
router.patch("/records/:id", payrollController.updatePayrollRecord);

/**
 * @route   POST /api/v1/hrms/payroll/records/:id/upload-payslip
 * @desc    Upload generated payslip PDF to multi-cloud storage
 */
router.post(
  "/records/:id/upload-payslip",
  upload.single("file", { category: "document" }),
  payrollController.uploadPayslipPdf
);

export default router;

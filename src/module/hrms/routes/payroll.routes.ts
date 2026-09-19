import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as payrollController from "../controllers/payroll.controller.js";

const router = Router();

// Protect all payroll endpoints
router.use(authenticate);

// Personal payslips
router.get("/my-payslips", payrollController.getMyPayslips);

// Payroll Period batch endpoints
router.post("/periods", payrollController.createPayrollPeriod);
router.get("/periods", payrollController.getPayrollPeriods);
router.get("/periods/:id", payrollController.getPayrollPeriodById);
router.post("/periods/:id/process", payrollController.processPayrollPeriod);
router.patch("/periods/:id/disburse", payrollController.disbursePayrollPeriod);
router.delete("/periods/:id", payrollController.deletePayrollPeriod);

// Individual Payroll Records / Payslips
router.get("/records", payrollController.getAllPayrollRecords);
router.get("/records/:id", payrollController.getPayrollRecordById);
router.patch("/records/:id", payrollController.updatePayrollRecord);
router.post(
  "/records/:id/upload-payslip",
  upload.single("file", { category: "document" }),
  payrollController.uploadPayslipPdf
);

export default router;

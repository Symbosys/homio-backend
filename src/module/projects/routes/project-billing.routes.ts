import { Router } from "express";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createProjectBill,
  getProjectBills,
  getProjectBillById,
  updateProjectBill,
  updateProjectBillStatus,
  deleteProjectBill,
  uploadProjectBillDocument,
  createProjectPaymentRecord,
  getProjectPaymentRecords,
  getProjectPaymentRecordById,
  updateProjectPaymentRecord,
  deleteProjectPaymentRecord,
  uploadProjectPaymentReceipt,
  getProjectCommercialSummary,
} from "../controllers/project-billing.controller.js";

// Router for Project Bills
export const projectBillRouter = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/bills or POST /api/v1/projects/bills/upload
 * @desc    Upload bill invoice / delivery slip document
 */
projectBillRouter.post("/upload", upload.single("file"), uploadProjectBillDocument);

/**
 * @route   POST /api/v1/projects/:projectId/bills or POST /api/v1/projects/bills
 * @desc    Create a new Project Bill
 */
projectBillRouter.post("/", createProjectBill);

/**
 * @route   GET /api/v1/projects/:projectId/bills or GET /api/v1/projects/bills
 * @desc    Fetch paginated list of project bills
 */
projectBillRouter.get("/", getProjectBills);

/**
 * @route   GET /api/v1/projects/bills/:id
 * @desc    Fetch single project bill by ID
 */
projectBillRouter.get("/:id", getProjectBillById);

/**
 * @route   PATCH /api/v1/projects/bills/:id
 * @desc    Update project bill
 */
projectBillRouter.patch("/:id", updateProjectBill);

/**
 * @route   PATCH /api/v1/projects/bills/:id/status
 * @desc    Update project bill status
 */
projectBillRouter.patch("/:id/status", updateProjectBillStatus);

/**
 * @route   DELETE /api/v1/projects/bills/:id
 * @desc    Soft delete project bill
 */
projectBillRouter.delete("/:id", deleteProjectBill);

// Router for Project Payment Records
export const projectPaymentRecordRouter = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/payment-records/upload
 * @desc    Upload payment receipt / counterfoil
 */
projectPaymentRecordRouter.post("/upload", upload.single("file"), uploadProjectPaymentReceipt);

/**
 * @route   POST /api/v1/projects/:projectId/payment-records
 * @desc    Create payment record
 */
projectPaymentRecordRouter.post("/", createProjectPaymentRecord);

/**
 * @route   GET /api/v1/projects/:projectId/payment-records
 * @desc    Fetch paginated payment records
 */
projectPaymentRecordRouter.get("/", getProjectPaymentRecords);

/**
 * @route   GET /api/v1/projects/payment-records/:id
 * @desc    Fetch single payment record by ID
 */
projectPaymentRecordRouter.get("/:id", getProjectPaymentRecordById);

/**
 * @route   PATCH /api/v1/projects/payment-records/:id
 * @desc    Update payment record
 */
projectPaymentRecordRouter.patch("/:id", updateProjectPaymentRecord);

/**
 * @route   DELETE /api/v1/projects/payment-records/:id
 * @desc    Soft delete payment record
 */
projectPaymentRecordRouter.delete("/:id", deleteProjectPaymentRecord);

// Router for Commercial Summary
export const projectCommercialSummaryRouter = Router({ mergeParams: true });

/**
 * @route   GET /api/v1/projects/:projectId/commercials/summary
 * @desc    Fetch commercial summary
 */
projectCommercialSummaryRouter.get("/summary", getProjectCommercialSummary);
projectCommercialSummaryRouter.get("/", getProjectCommercialSummary);

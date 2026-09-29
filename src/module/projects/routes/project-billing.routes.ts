import { Router } from "express";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createProjectBill,
  getProjectBills,
  getProjectBillById,
  updateProjectBill,
  updateProjectBillStatus,
  deleteProjectBill,
  createProjectPaymentRecord,
  getProjectPaymentRecords,
  getProjectPaymentRecordById,
  updateProjectPaymentRecord,
  deleteProjectPaymentRecord,
  getProjectCommercialSummary,
} from "../controllers/project-billing.controller.js";

// Router for Project Bills
export const projectBillRouter = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/bills or POST /api/v1/projects/bills
 * @desc    Create a new Project Bill (Supports embedded multipart bill document + attachments upload)
 */
projectBillRouter.post(
  "/",
  upload.fields([
    { name: "billDocument", maxCount: 1 },
    { name: "attachments", maxCount: 10 },
  ], { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  createProjectBill
);

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
 * @desc    Update project bill (Supports embedded multipart bill document + attachments replacement)
 */
projectBillRouter.patch(
  "/:id",
  upload.fields([
    { name: "billDocument", maxCount: 1 },
    { name: "attachments", maxCount: 10 },
  ], { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  updateProjectBill
);

/**
 * @route   PATCH /api/v1/projects/bills/:id/status
 * @desc    Update project bill status
 */
projectBillRouter.patch("/:id/status", updateProjectBillStatus);

/**
 * @route   DELETE /api/v1/projects/bills/:id
 * @desc    Soft delete project bill and prune all associated cloud media (Rule 4)
 */
projectBillRouter.delete("/:id", deleteProjectBill);

// Router for Project Payment Records
export const projectPaymentRecordRouter = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/payment-records
 * @desc    Create payment record (Supports embedded multipart payment receipt + attachments upload)
 */
projectPaymentRecordRouter.post(
  "/",
  upload.fields([
    { name: "receipt", maxCount: 1 },
    { name: "attachments", maxCount: 10 },
  ], { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  createProjectPaymentRecord
);

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
 * @desc    Update payment record (Supports embedded multipart receipt + attachments replacement)
 */
projectPaymentRecordRouter.patch(
  "/:id",
  upload.fields([
    { name: "receipt", maxCount: 1 },
    { name: "attachments", maxCount: 10 },
  ], { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  updateProjectPaymentRecord
);

/**
 * @route   DELETE /api/v1/projects/payment-records/:id
 * @desc    Soft delete payment record and prune associated receipt vouchers (Rule 4)
 */
projectPaymentRecordRouter.delete("/:id", deleteProjectPaymentRecord);

// Router for Commercial Summary
export const projectCommercialSummaryRouter = Router({ mergeParams: true });

/**
 * @route   GET /api/v1/projects/:projectId/commercials or GET /api/v1/projects/:projectId/commercials/summary
 * @desc    Calculate project commercial metrics & gross profit margins
 */
projectCommercialSummaryRouter.get("/", getProjectCommercialSummary);
projectCommercialSummaryRouter.get("/summary", getProjectCommercialSummary);

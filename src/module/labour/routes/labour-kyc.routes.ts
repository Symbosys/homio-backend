import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  getLabourKyc,
  upsertLabourKyc,
  verifyLabourKyc,
  deleteLabourKycDocument,
} from "../controllers/labour-kyc.controller.js";

const router = Router({ mergeParams: true });

// Protect all KYC endpoints with authentication
router.use(authenticate);

/**
 * Multi-field file upload middleware for KYC documents (images & pdf documents)
 */
const kycUploadMiddleware = upload.fields(
  [
    { name: "aadhaarDoc", maxCount: 1 },
    { name: "selfiePhoto", maxCount: 1 },
    { name: "policeClearanceDoc", maxCount: 1 },
  ],
  { category: "all" }
);

/**
 * @route   GET /api/v1/labour/:id/kyc
 * @desc    Fetch KYC documents, bank details, and verification status
 * 
 * @route   PUT /api/v1/labour/:id/kyc
 * @desc    Upload / update KYC documents and bank details (automatically deletes old cloud files upon update)
 */
router
  .route("/:id/kyc")
  .get(getLabourKyc)
  .put(kycUploadMiddleware, upsertLabourKyc);

/**
 * @route   PATCH /api/v1/labour/:id/kyc/verify
 * @desc    Review and verify KYC status (Approved / Rejected / Under Review)
 */
router.patch("/:id/kyc/verify", verifyLabourKyc);

/**
 * @route   DELETE /api/v1/labour/:id/kyc/documents/:docType
 * @desc    Delete a specific KYC document from cloud storage and database
 */
router.delete("/:id/kyc/documents/:docType", deleteLabourKycDocument);

export default router;

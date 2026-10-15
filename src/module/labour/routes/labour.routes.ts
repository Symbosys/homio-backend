import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createLabour,
  getLabours,
  getLabourById,
  updateLabour,
  deleteLabour,
  registerPublicLabour,
  getMyLabourProfile,
  updateMyLabourProfile,
} from "../controllers/labour.controller.js";

const router = Router();

/**
 * Multi-field file upload middleware for worker profile photo and KYC documents (Rule 4)
 */
const myProfileUploadMiddleware = upload.fields(
  [
    { name: "photo", maxCount: 1 },
    { name: "aadhaarDoc", maxCount: 1 },
    { name: "selfiePhoto", maxCount: 1 },
    { name: "policeClearanceDoc", maxCount: 1 },
  ],
  { category: "all" }
);

/**
 * @route   POST /api/v1/labour/register
 * @desc    Public self-registration for independent labours (Platform Pool)
 * @access  Public (No Auth Required)
 */
router.post("/register", upload.single("photo"), registerPublicLabour);

// Protect all following routes with tenant authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/labour/profile/me
 * @desc    Fetch authenticated labourer's own profile and complete KYC dossier
 * @access  Private (Authenticated Labour Worker)
 * 
 * @route   PUT /api/v1/labour/profile/me
 * @desc    Symmetric update of authenticated worker's profile and KYC documents
 * @access  Private (Authenticated Labour Worker)
 */
router
  .route("/profile/me")
  .get(getMyLabourProfile)
  .put(myProfileUploadMiddleware, updateMyLabourProfile);

/**
 * @route   POST /api/v1/labour
 * @desc    Onboard a new labour profile with KYC & settlement details (supports multipart photo upload)
 * @access  Private (Authenticated Tenant User)
 * 
 * @route   GET /api/v1/labour
 * @desc    Fetch paginated list of labours with search and filters
 * @access  Private (Authenticated Tenant User)
 */
router.route("/")
  .post(upload.single("photo"), createLabour)
  .get(getLabours);

/**
 * @route   GET /api/v1/labour/:id
 * @desc    Fetch single labour profile with full KYC documents and project history
 * @access  Private (Authenticated Tenant User)
 * 
 * @route   PATCH /api/v1/labour/:id or PUT /api/v1/labour/:id
 * @desc    Update labour profile (Symmetric: all creation fields editable)
 * @access  Private (Authenticated Tenant User)
 * 
 * @route   DELETE /api/v1/labour/:id
 * @desc    Soft delete a labour profile
 * @access  Private (Authenticated Tenant User)
 */
router.route("/:id")
  .get(getLabourById)
  .put(upload.single("photo"), updateLabour)
  .patch(upload.single("photo"), updateLabour)
  .delete(deleteLabour);

export default router;

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
} from "../controllers/labour.controller.js";

const router = Router();

/**
 * @route   POST /api/v1/labour/register
 * @desc    Public self-registration for independent labours (Platform Pool)
 * @access  Public (No Auth Required)
 */
router.post("/register", upload.single("photo"), registerPublicLabour);

// Protect all following routes with tenant authentication
router.use(authenticate);

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

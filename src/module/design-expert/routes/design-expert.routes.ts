import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createExpert,
  getExperts,
  getExpertById,
  updateExpert,
  deleteExpert,
  getAvailability,
  setWeeklyAvailability,
  addDateOverride,
  deleteDateOverride,
  getSlots,
} from "../controllers/design-expert.controller.js";
import {
  getBookings,
  getBookingById,
  platformEditBooking,
  platformCancelBooking,
  platformCompleteBooking,
  submitReview,
} from "../controllers/design-expert-booking.controller.js";

const router = Router();

// ==========================================
// 1. PUBLIC / CLIENT READ DIRECTORY & SLOTS
// ==========================================

/**
 * @route   GET /api/v1/design-experts
 * @desc    Browse directory of design experts with search & filters
 */
router.get("/", getExperts);

/**
 * @route   GET /api/v1/design-experts/:id
 * @desc    Get expert public profile and credentials
 */
router.get("/:id", getExpertById);

/**
 * @route   GET /api/v1/design-experts/:id/availability
 * @desc    Get expert weekly schedule and date overrides
 */
router.get("/:id/availability", getAvailability);

/**
 * @route   GET /api/v1/design-experts/:id/slots
 * @desc    Compute real-time available time slots for a given date (?date=YYYY-MM-DD)
 */
router.get("/:id/slots", getSlots);

// ==========================================
// 2. CLIENT REVIEW SUBMISSION (Authenticated User)
// ==========================================

/**
 * @route   POST /api/v1/design-experts/bookings/:id/review
 * @desc    Client submits post-session rating (1-5 stars) and feedback comment
 */
router.post("/bookings/:id/review", authenticate, submitReview);

// ==========================================
// 3. PLATFORM ADMIN ONLY ROUTES
// ==========================================

const platformGuard = [authenticate, authorize("PLATFORM_ADMIN")];

/**
 * @route   POST /api/v1/design-experts
 * @desc    Create new Design Expert profile
 */
router.post(
  "/",
  ...platformGuard,
  upload.single("avatar", { category: "image" }),
  createExpert
);

/**
 * @route   PATCH /api/v1/design-experts/:id
 * @desc    Update Design Expert profile or platform status
 */
router.patch(
  "/:id",
  ...platformGuard,
  upload.single("avatar", { category: "image" }),
  updateExpert
);

/**
 * @route   DELETE /api/v1/design-experts/:id
 * @desc    Soft delete an expert profile
 */
router.delete("/:id", ...platformGuard, deleteExpert);

/**
 * @route   PUT /api/v1/design-experts/:id/availability
 * @desc    Configure weekly recurring working shifts
 */
router.put("/:id/availability", ...platformGuard, setWeeklyAvailability);

/**
 * @route   POST /api/v1/design-experts/:id/availability/override
 * @desc    Add date-specific leave or custom operating hours
 */
router.post("/:id/availability/override", ...platformGuard, addDateOverride);

/**
 * @route   DELETE /api/v1/design-experts/:id/availability/override/:overrideId
 * @desc    Remove date-specific override
 */
router.delete("/:id/availability/override/:overrideId", ...platformGuard, deleteDateOverride);

// ==========================================
// 4. PLATFORM BOOKING ADMINISTRATION
// ==========================================

/**
 * @route   GET /api/v1/design-experts/bookings/list
 * @desc    Get all bookings with filters & pagination
 */
router.get("/bookings/list", ...platformGuard, getBookings);

/**
 * @route   GET /api/v1/design-experts/bookings/item/:id
 * @desc    Get single booking details
 */
router.get("/bookings/item/:id", ...platformGuard, getBookingById);

/**
 * @route   PATCH /api/v1/design-experts/bookings/:id
 * @desc    Platform edit booking details (reschedule date/time, update link, topic)
 */
router.patch("/bookings/:id", ...platformGuard, platformEditBooking);

/**
 * @route   PATCH /api/v1/design-experts/bookings/:id/cancel
 * @desc    Platform cancel booking
 */
router.patch("/bookings/:id/cancel", ...platformGuard, platformCancelBooking);

/**
 * @route   PATCH /api/v1/design-experts/bookings/:id/complete
 * @desc    Platform mark booking as completed post-session
 */
router.patch("/bookings/:id/complete", ...platformGuard, platformCompleteBooking);

export default router;

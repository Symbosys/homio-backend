import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createLabourBooking,
  getAllLabourBookings,
  getLabourBookingById,
  updateLabourBooking,
  updateLabourBookingStatus,
  deleteLabourBooking,
} from "../controllers/labour-booking.controller.js";

const router = Router();

// Protect all booking endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/labour/bookings
 * @desc    Create a new labour booking
 * 
 * @route   GET /api/v1/labour/bookings
 * @desc    Get paginated labour bookings
 */
router
  .route("/bookings")
  .post(createLabourBooking)
  .get(getAllLabourBookings);

/**
 * @route   GET /api/v1/labour/bookings/:id
 * @desc    Get booking by ID
 * 
 * @route   PUT /api/v1/labour/bookings/:id
 * @desc    Update booking
 * 
 * @route   DELETE /api/v1/labour/bookings/:id
 * @desc    Soft delete booking
 */
router
  .route("/bookings/:id")
  .get(getLabourBookingById)
  .put(updateLabourBooking)
  .delete(deleteLabourBooking);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/status
 * @desc    Update booking status
 */
router.patch("/bookings/:id/status", updateLabourBookingStatus);

export default router;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createLabourBooking,
  createMarketplaceBooking,
  getAllLabourBookings,
  getLabourBookingById,
  updateLabourBooking,
  updateLabourBookingStatus,
  deleteLabourBooking,
  acceptLabourBooking,
  rejectLabourBooking,
  submitLabourBookingQuote,
  respondLabourBookingQuote,
  completeLabourBookingWork,
  confirmLabourBookingCompletion,
  settleLabourBookingCommission,
  reportLabourBookingDelay,
  reassignLabourBooking,
} from "../controllers/labour-booking.controller.js";

const router = Router();

// Protect all booking endpoints with authentication
router.use("/bookings", authenticate);

/**
 * @route   POST /api/v1/labour/bookings/marketplace
 * @desc    Client requests on-demand service booking directly from platform
 */
router.post("/bookings/marketplace", createMarketplaceBooking);

/**
 * @route   POST /api/v1/labour/bookings
 * @desc    Organization creates project site labour allocation
 * 
 * @route   GET /api/v1/labour/bookings
 * @desc    Get paginated labour bookings across Org, Client, Worker & Platform Admin
 */
router
  .route("/bookings")
  .post(createLabourBooking)
  .get(getAllLabourBookings);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/accept
 * @desc    Worker accepts booking request
 */
router.patch("/bookings/:id/accept", acceptLabourBooking);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/reject
 * @desc    Worker rejects booking request
 */
router.patch("/bookings/:id/reject", rejectLabourBooking);

/**
 * @route   POST /api/v1/labour/bookings/:id/quote
 * @desc    Worker submits on-site deal quotation
 */
router.post("/bookings/:id/quote", submitLabourBookingQuote);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/quote-response
 * @desc    Client accepts or rejects on-site quotation
 */
router.patch("/bookings/:id/quote-response", respondLabourBookingQuote);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/complete-work
 * @desc    Worker submits task checklist and proof photos
 */
router.patch("/bookings/:id/complete-work", completeLabourBookingWork);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/confirm-completion
 * @desc    Client confirms completion and leaves performance review/rating
 */
router.patch("/bookings/:id/confirm-completion", confirmLabourBookingCompletion);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/settle-commission
 * @desc    Settle platform commission payment
 */
router.patch("/bookings/:id/settle-commission", settleLabourBookingCommission);

/**
 * @route   POST /api/v1/labour/bookings/:id/report-delay
 * @desc    Client reports labour worker arrival delay after 24 hours
 */
router.post("/bookings/:id/report-delay", reportLabourBookingDelay);

/**
 * @route   POST /api/v1/labour/bookings/:id/reassign
 * @desc    Platform Admin manually reassigns replacement labour
 */
router.post("/bookings/:id/reassign", reassignLabourBooking);

/**
 * @route   PATCH /api/v1/labour/bookings/:id/status
 * @desc    Update booking status
 */
router.patch("/bookings/:id/status", updateLabourBookingStatus);

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

export default router;

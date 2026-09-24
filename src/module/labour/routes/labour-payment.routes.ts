import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createLabourPayment,
  getAllLabourPayments,
  getLabourPaymentById,
  updateLabourPayment,
  updateLabourPaymentStatus,
  deleteLabourPayment,
} from "../controllers/labour-payment.controller.js";

const router = Router();

// Protect all payment endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/labour/payments
 * @desc    Create labour payment voucher with optional receipt
 * 
 * @route   GET /api/v1/labour/payments
 * @desc    Get paginated labour payments
 */
router
  .route("/payments")
  .post(upload.single("receiptPhoto", { category: "image" }), createLabourPayment)
  .get(getAllLabourPayments);

/**
 * @route   GET /api/v1/labour/payments/:id
 * @desc    Get payment by ID
 * 
 * @route   PUT /api/v1/labour/payments/:id
 * @desc    Update payment
 * 
 * @route   DELETE /api/v1/labour/payments/:id
 * @desc    Delete payment
 */
router
  .route("/payments/:id")
  .get(getLabourPaymentById)
  .put(upload.single("receiptPhoto", { category: "image" }), updateLabourPayment)
  .delete(deleteLabourPayment);

/**
 * @route   PATCH /api/v1/labour/payments/:id/status
 * @desc    Update payment status
 */
router.patch("/payments/:id/status", updateLabourPaymentStatus);

export default router;

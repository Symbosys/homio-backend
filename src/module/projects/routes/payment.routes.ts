import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  deletePayment,
  getPaymentSummary,
} from "../controllers/payment.controller.js";

const paymentRoutes = Router({ mergeParams: true });

// Protect all payment routes with authentication
paymentRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/projects/:projectId/payments/summary or GET /api/v1/projects/payments/summary
 * @desc    Fetch financial summary metrics (total inflow, outflow, net balance)
 */
paymentRoutes.get("/summary", getPaymentSummary);

/**
 * @route   POST /api/v1/projects/:projectId/payments or POST /api/v1/projects/payments
 * @desc    Record a new payment transaction
 */
paymentRoutes.post("/", createPayment);

/**
 * @route   GET /api/v1/projects/:projectId/payments or GET /api/v1/projects/payments
 * @desc    Fetch paginated list of payments with filters
 */
paymentRoutes.get("/", getPayments);

/**
 * @route   GET /api/v1/projects/:projectId/payments/:id or GET /api/v1/projects/payments/:id
 * @desc    Fetch details of a single payment transaction
 */
paymentRoutes.get("/:id", getPaymentById);

/**
 * @route   PATCH /api/v1/projects/:projectId/payments/:id or PATCH /api/v1/projects/payments/:id
 * @desc    Update payment transaction parameters
 */
paymentRoutes.patch("/:id", updatePayment);

/**
 * @route   DELETE /api/v1/projects/:projectId/payments/:id or DELETE /api/v1/projects/payments/:id
 * @desc    Soft delete a payment transaction
 */
paymentRoutes.delete("/:id", deletePayment);

export default paymentRoutes;

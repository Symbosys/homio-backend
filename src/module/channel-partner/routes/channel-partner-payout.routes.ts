import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createPayout,
  getPayouts,
  getPayoutById,
} from "../controllers/channel-partner-payout.controller.js";

const payoutRoutes = Router();

// Protect all payout routes
payoutRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/channel-partners/payouts
 * @desc    Disburse commission payout and upload receipt proof
 */
payoutRoutes.post(
  "/",
  upload.single("file", { category: "all", maxFileSize: 10 * 1024 * 1024 }),
  createPayout
);

/**
 * @route   GET /api/v1/channel-partners/payouts
 * @desc    Fetch paginated organization-wide payout transactions ledger with filters
 */
payoutRoutes.get("/", getPayouts);

/**
 * @route   GET /api/v1/channel-partners/payouts/:id
 * @desc    Get individual payout disbursement record with transaction receipt
 */
payoutRoutes.get("/:id", getPayoutById);

export default payoutRoutes;

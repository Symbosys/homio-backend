import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createChannelPartner,
  getChannelPartners,
  getChannelPartnerById,
  updateChannelPartner,
  deleteChannelPartner,
  uploadAvatar,
} from "../controllers/channel-partner.controller.js";
import { getPayoutsByPartnerId } from "../controllers/channel-partner-payout.controller.js";

const channelPartnerRoutes = Router();

// Protect all Channel Partner routes with auth & permissions
channelPartnerRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/channel-partners
 * @desc    Create a new Channel Partner (with code generation, bank details & KYC config)
 */
channelPartnerRoutes.post("/", createChannelPartner);

/**
 * @route   GET /api/v1/channel-partners
 * @desc    Fetch paginated Channel Partners list with search, status, and KYC filters
 */
channelPartnerRoutes.get("/", getChannelPartners);

/**
 * @route   GET /api/v1/channel-partners/:id
 * @desc    Get comprehensive Channel Partner details by ID
 */
channelPartnerRoutes.get("/:id", getChannelPartnerById);

/**
 * @route   PATCH /api/v1/channel-partners/:id
 * @desc    Update Channel Partner details (dirty updates, including status & KYC updates)
 */
channelPartnerRoutes.patch("/:id", updateChannelPartner);

/**
 * @route   DELETE /api/v1/channel-partners/:id
 * @desc    Soft delete Channel Partner record from tenant organization
 */
channelPartnerRoutes.delete("/:id", deleteChannelPartner);

/**
 * @route   POST /api/v1/channel-partners/:id/avatar
 * @desc    Upload or update avatar image for Channel Partner profile
 */
channelPartnerRoutes.post(
  "/:id/avatar",
  upload.single("file", { category: "image", maxFileSize: 5 * 1024 * 1024 }),
  uploadAvatar
);

/**
 * @route   GET /api/v1/channel-partners/:id/payouts
 * @desc    Fetch payout history for a specific partner
 */
channelPartnerRoutes.get("/:id/payouts", getPayoutsByPartnerId);

export default channelPartnerRoutes;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createRateCard,
  getRateCards,
  getDefaultRateCard,
  getRateCardById,
  updateRateCard,
  deleteRateCard,
  toggleActiveRateCard,
  setDefaultRateCard,
  reorderRateCards,
} from "../controllers/quotation-rate-card.controller.js";

const router = Router();

// Apply authentication middleware to all rate card routes
router.use(authenticate);

/**
 * @route   POST /api/v1/quotation-master/rate-cards
 * @desc    Create a new rate card / pricing tier
 * @access  Private (Authenticated Tenant User)
 */
router.post("/", createRateCard);

/**
 * @route   GET /api/v1/quotation-master/rate-cards
 * @desc    Fetch all non-paginated rate cards for the tenant
 * @access  Private (Authenticated Tenant User)
 */
router.get("/", getRateCards);

/**
 * @route   GET /api/v1/quotation-master/rate-cards/default
 * @desc    Fetch active default rate card
 * @access  Private (Authenticated Tenant User)
 */
router.get("/default", getDefaultRateCard);

/**
 * @route   POST /api/v1/quotation-master/rate-cards/reorder
 * @desc    Batch reorder rate cards
 * @access  Private (Authenticated Tenant User)
 */
router.post("/reorder", reorderRateCards);

/**
 * @route   GET /api/v1/quotation-master/rate-cards/:id
 * @desc    Fetch single rate card by ID
 * @access  Private (Authenticated Tenant User)
 */
router.get("/:id", getRateCardById);

/**
 * @route   PATCH /api/v1/quotation-master/rate-cards/:id
 * @desc    Update rate card details (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id", updateRateCard);

/**
 * @route   DELETE /api/v1/quotation-master/rate-cards/:id
 * @desc    Soft delete a rate card
 * @access  Private (Authenticated Tenant User)
 */
router.delete("/:id", deleteRateCard);

/**
 * @route   PATCH /api/v1/quotation-master/rate-cards/:id/toggle-active
 * @desc    Toggle active state of a rate card
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/toggle-active", toggleActiveRateCard);

/**
 * @route   PATCH /api/v1/quotation-master/rate-cards/:id/set-default
 * @desc    Set rate card as organization default
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/set-default", setDefaultRateCard);

export default router;

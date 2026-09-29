import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotation,
  adjustQuotationExpiry,
} from "../controllers/quotation.controller.js";

const router = Router();

// Apply authentication middleware to all quotation routes
router.use(authenticate);

/**
 * @route   POST /api/v1/quotations
 * @desc    Create a new Quotation proposal with nested spatial rooms, line items, payment schedules, and PDF assets
 * @access  Private (Authenticated Tenant User)
 */
router.post("/", createQuotation);

/**
 * @route   GET /api/v1/quotations
 * @desc    Fetch paginated list of quotations with comprehensive multi-criteria filters
 * @access  Private (Authenticated Tenant User)
 */
router.get("/", getQuotations);

/**
 * @route   GET /api/v1/quotations/:id
 * @desc    Fetch a single quotation by ID with full nested spatial rooms, line items, milestones, and PDF presentation pages
 * @access  Private (Authenticated Tenant User)
 */
router.get("/:id", getQuotationById);

/**
 * @route   PUT /api/v1/quotations/:id
 * @desc    Update an existing quotation proposal (all fields, rooms, line items, payment milestones, and PDF presentation pages)
 * @access  Private (Authenticated Tenant User)
 */
router.put("/:id", updateQuotation);

/**
 * @route   PATCH /api/v1/quotations/:id/expiry
 * @desc    Adjust or extend quotation discount expiry date (by +/- days or custom ISO date)
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/expiry", adjustQuotationExpiry);

export default router;



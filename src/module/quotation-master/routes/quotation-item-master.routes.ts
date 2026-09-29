import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createQuotationItem,
  bulkCreateQuotationItems,
  getQuotationItems,
  getQuotationItemCategorySummary,
  getQuotationItemById,
  updateQuotationItem,
  deleteQuotationItem,
  toggleActiveQuotationItem,
  uploadQuotationItemImage,
  uploadQuotationItemGallery,
  deleteQuotationItemGalleryImage,
} from "../controllers/quotation-item-master.controller.js";

const router = Router();

// Apply authentication middleware to all quotation item master routes
router.use(authenticate);

/**
 * @route   POST /api/v1/quotation-master/items
 * @desc    Create a new item in the organization catalog
 * @access  Private (Authenticated Tenant User)
 */
router.post("/", createQuotationItem);

/**
 * @route   POST /api/v1/quotation-master/items/bulk-create
 * @desc    Bulk create/import catalog items
 * @access  Private (Authenticated Tenant User)
 */
router.post("/bulk-create", bulkCreateQuotationItems);

/**
 * @route   GET /api/v1/quotation-master/items
 * @desc    Fetch paginated list of catalog items with multi-criteria filters
 * @access  Private (Authenticated Tenant User)
 */
router.get("/", getQuotationItems);

/**
 * @route   GET /api/v1/quotation-master/items/categories/summary
 * @desc    Fetch summary counts grouped by category
 * @access  Private (Authenticated Tenant User)
 */
router.get("/categories/summary", getQuotationItemCategorySummary);

/**
 * @route   GET /api/v1/quotation-master/items/:id
 * @desc    Fetch single catalog item by ID
 * @access  Private (Authenticated Tenant User)
 */
router.get("/:id", getQuotationItemById);

/**
 * @route   PATCH /api/v1/quotation-master/items/:id
 * @desc    Update catalog item details (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id", updateQuotationItem);

/**
 * @route   DELETE /api/v1/quotation-master/items/:id
 * @desc    Soft delete a catalog item
 * @access  Private (Authenticated Tenant User)
 */
router.delete("/:id", deleteQuotationItem);

/**
 * @route   PATCH /api/v1/quotation-master/items/:id/toggle-active
 * @desc    Toggle active state of a catalog item
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/toggle-active", toggleActiveQuotationItem);

/**
 * @route   POST /api/v1/quotation-master/items/:id/image
 * @desc    Upload primary thumbnail image for an item
 * @access  Private (Authenticated Tenant User)
 */
router.post(
  "/:id/image",
  upload.single("image", { category: "image" }),
  uploadQuotationItemImage,
);

/**
 * @route   POST /api/v1/quotation-master/items/:id/gallery
 * @desc    Upload multiple gallery images for an item (max 10 per batch)
 * @access  Private (Authenticated Tenant User)
 */
router.post(
  "/:id/gallery",
  upload.array("images", 10, { category: "image" }),
  uploadQuotationItemGallery,
);

/**
 * @route   DELETE /api/v1/quotation-master/items/:id/gallery/:imageId
 * @desc    Remove a specific gallery image from an item
 * @access  Private (Authenticated Tenant User)
 */
router.delete("/:id/gallery/:imageId", deleteQuotationItemGalleryImage);

export default router;

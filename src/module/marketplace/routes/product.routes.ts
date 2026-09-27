import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createProduct,
  getProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  updateProductStatus,
  deleteProduct,
} from "../controllers/product.controller.js";

const productRoutes = Router();

/**
 * @route   POST /api/v1/marketplace/products
 * @desc    Create a new marketplace product with type-specific 1:1 details
 * @access  Protected
 */
productRoutes.post("/", authenticate, createProduct);

/**
 * @route   GET /api/v1/marketplace/products
 * @desc    Get paginated catalog of marketplace products with multi-filter capability
 * @access  Protected
 */
productRoutes.get("/", authenticate, getProducts);

/**
 * @route   GET /api/v1/marketplace/products/slug/:slug
 * @desc    Get single product by SEO URL slug
 * @access  Protected
 */
productRoutes.get("/slug/:slug", authenticate, getProductBySlug);

/**
 * @route   GET /api/v1/marketplace/products/:id
 * @desc    Get single product details with all 1:1 type extensions by ID
 * @access  Protected
 */
productRoutes.get("/:id", authenticate, getProductById);

/**
 * @route   PATCH /api/v1/marketplace/products/:id
 * @desc    Update product attributes and type extensions (partial / dirty payload)
 * @access  Protected
 */
productRoutes.patch("/:id", authenticate, updateProduct);

/**
 * @route   PATCH /api/v1/marketplace/products/:id/status
 * @desc    Update product status (DRAFT, PUBLISHED, ARCHIVED)
 * @access  Protected
 */
productRoutes.patch("/:id/status", authenticate, updateProductStatus);

/**
 * @route   DELETE /api/v1/marketplace/products/:id
 * @desc    Soft delete product from catalog
 * @access  Protected
 */
productRoutes.delete("/:id", authenticate, deleteProduct);

export default productRoutes;

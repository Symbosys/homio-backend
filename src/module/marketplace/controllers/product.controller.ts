import { asyncHandler } from "../../../middlewares/error.middleware.js";
import {
  SuccessResponse,
  ErrorResponse,
} from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { productService } from "../services/product.service.js";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
  productIdParamSchema,
  productSlugParamSchema,
  updateProductStatusSchema,
} from "../validators/product.validator.js";

/**
 * @route   POST /api/v1/marketplace/products
 * @desc    Create a new product with optional type-specific 1:1 details (Digital, Decor, Property, Material)
 * @access  Protected (Org Admin / User)
 */
export const createProduct = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required to create a product",
      statusCode.Forbidden,
    );
  }

  const parsed = createProductSchema.parse({ body: req.body });
  const product = await productService.createProduct(
    organizationId,
    parsed.body,
    req.user?.id,
  );

  return SuccessResponse(
    res,
    "Product created successfully",
    product,
    statusCode.Created,
  );
});

/**
 * @route   GET /api/v1/marketplace/products
 * @desc    Get paginated list of marketplace products with filters (type, status, vendor, price, city, search)
 * @access  Protected (Org Admin / User)
 */
export const getProducts = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required to retrieve products",
      statusCode.Forbidden,
    );
  }

  const parsed = getProductsQuerySchema.parse({ query: req.query });
  const result = await productService.getProducts(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "Products retrieved successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   GET /api/v1/marketplace/products/:id
 * @desc    Get complete product details by ID including 1:1 type-specific extension details
 * @access  Protected (Org Admin / User)
 */
export const getProductById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required",
      statusCode.Forbidden,
    );
  }

  const parsed = productIdParamSchema.parse({ params: req.params });
  const product = await productService.getProductById(
    parsed.params.id,
    organizationId,
  );

  return SuccessResponse(
    res,
    "Product retrieved successfully",
    product,
    statusCode.OK,
  );
});

/**
 * @route   GET /api/v1/marketplace/products/slug/:slug
 * @desc    Get complete product details by URL slug
 * @access  Protected (Org Admin / User)
 */
export const getProductBySlug = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required",
      statusCode.Forbidden,
    );
  }

  const parsed = productSlugParamSchema.parse({ params: req.params });
  const product = await productService.getProductBySlug(
    parsed.params.slug,
    organizationId,
  );

  return SuccessResponse(
    res,
    "Product retrieved successfully",
    product,
    statusCode.OK,
  );
});

/**
 * @route   PATCH /api/v1/marketplace/products/:id
 * @desc    Update an existing product and its nested type-specific extension details (partial / dirty updates)
 * @access  Protected (Org Admin / User)
 */
export const updateProduct = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required",
      statusCode.Forbidden,
    );
  }

  const parsed = updateProductSchema.parse({
    params: req.params,
    body: req.body,
  });

  const product = await productService.updateProduct(
    parsed.params.id,
    organizationId,
    parsed.body,
  );

  return SuccessResponse(
    res,
    "Product updated successfully",
    product,
    statusCode.OK,
  );
});

/**
 * @route   PATCH /api/v1/marketplace/products/:id/status
 * @desc    Update the publishing lifecycle status of a product (DRAFT, PUBLISHED, ARCHIVED)
 * @access  Protected (Org Admin / User)
 */
export const updateProductStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required",
      statusCode.Forbidden,
    );
  }

  const parsed = updateProductStatusSchema.parse({
    params: req.params,
    body: req.body,
  });

  const product = await productService.updateProductStatus(
    parsed.params.id,
    organizationId,
    parsed.body.status,
  );

  return SuccessResponse(
    res,
    "Product status updated successfully",
    product,
    statusCode.OK,
  );
});

/**
 * @route   DELETE /api/v1/marketplace/products/:id
 * @desc    Soft delete a product from the organization's catalog
 * @access  Protected (Org Admin / User)
 */
export const deleteProduct = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context is required",
      statusCode.Forbidden,
    );
  }

  const parsed = productIdParamSchema.parse({ params: req.params });
  await productService.deleteProduct(parsed.params.id, organizationId);

  return SuccessResponse(
    res,
    "Product deleted successfully",
    null,
    statusCode.OK,
  );
});

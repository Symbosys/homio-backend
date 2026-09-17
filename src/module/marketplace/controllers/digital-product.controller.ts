import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { digitalProductService } from "../services/digital-product.service.js";
import {
  createDigitalProductSchema,
  updateDigitalProductSchema,
  getDigitalProductsQuerySchema,
  digitalProductIdParamSchema,
} from "../validators/digital-product.validator.js";

/**
 * Org Admin: Create digital product
 */
export const createDigitalProduct = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required to create a product", statusCode.Forbidden);
  }

  const parsed = createDigitalProductSchema.parse({ body: req.body });
  const product = await digitalProductService.createProduct(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Digital product created successfully", product, statusCode.Created);
});

/**
 * Public: List digital products (filterable by organizationId, categoryId, etc.)
 */
export const getDigitalProducts = asyncHandler(async (req, res) => {
  const parsed = getDigitalProductsQuerySchema.parse({ query: req.query });

  const organizationId = parsed.query.organizationId;

  const result = await digitalProductService.getProducts({
    ...parsed.query,
    organizationId,
  });
  return SuccessResponse(res, "Digital products retrieved successfully", result, statusCode.OK);
});

/**
 * Authenticated: Get single digital product
 */
export const getDigitalProductById = asyncHandler(async (req, res) => {
  const parsed = digitalProductIdParamSchema.parse({ params: req.params });
  const product = await digitalProductService.getProductById(parsed.params.id);
  return SuccessResponse(res, "Digital product retrieved successfully", product, statusCode.OK);
});

/**
 * Org Admin: Update digital product
 */
export const updateDigitalProduct = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updateDigitalProductSchema.parse({ params: req.params, body: req.body });
  const product = await digitalProductService.updateProduct(parsed.params.id, organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Digital product updated successfully", product, statusCode.OK);
});

/**
 * Org Admin: Soft-delete digital product
 */
export const deleteDigitalProduct = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = digitalProductIdParamSchema.parse({ params: req.params });
  await digitalProductService.deleteProduct(parsed.params.id, organizationId);
  return SuccessResponse(res, "Digital product deleted successfully", {}, statusCode.OK);
});

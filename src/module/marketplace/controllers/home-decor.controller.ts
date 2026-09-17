import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { homeDecorService } from "../services/home-decor.service.js";
import {
  createHomeDecorSchema,
  updateHomeDecorSchema,
  getHomeDecorQuerySchema,
  homeDecorIdParamSchema,
} from "../validators/home-decor.validator.js";

/**
 * Org Admin: Create home decor product
 */
export const createHomeDecor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required to create a product", statusCode.Forbidden);
  }

  const parsed = createHomeDecorSchema.parse({ body: req.body });
  const product = await homeDecorService.createProduct(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Home decor product created successfully", product, statusCode.Created);
});

/**
 * Public: List home decor products (filterable by organizationId, categoryId, etc.)
 */
export const getHomeDecor = asyncHandler(async (req, res) => {
  const parsed = getHomeDecorQuerySchema.parse({ query: req.query });

  const organizationId = parsed.query.organizationId;

  const result = await homeDecorService.getProducts({
    ...parsed.query,
    organizationId,
  });
  return SuccessResponse(res, "Home decor products retrieved successfully", result, statusCode.OK);
});

/**
 * Authenticated: Get single home decor product
 */
export const getHomeDecorById = asyncHandler(async (req, res) => {
  const parsed = homeDecorIdParamSchema.parse({ params: req.params });
  const product = await homeDecorService.getProductById(parsed.params.id);
  return SuccessResponse(res, "Home decor product retrieved successfully", product, statusCode.OK);
});

/**
 * Org Admin: Update home decor product
 */
export const updateHomeDecor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updateHomeDecorSchema.parse({ params: req.params, body: req.body });
  const product = await homeDecorService.updateProduct(parsed.params.id, organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Home decor product updated successfully", product, statusCode.OK);
});

/**
 * Org Admin: Soft-delete home decor product
 */
export const deleteHomeDecor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = homeDecorIdParamSchema.parse({ params: req.params });
  await homeDecorService.deleteProduct(parsed.params.id, organizationId);
  return SuccessResponse(res, "Home decor product deleted successfully", {}, statusCode.OK);
});

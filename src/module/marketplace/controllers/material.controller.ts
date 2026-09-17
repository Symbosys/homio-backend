import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { materialService } from "../services/material.service.js";
import {
  createMaterialSchema,
  updateMaterialSchema,
  getMaterialsQuerySchema,
  materialIdParamSchema,
} from "../validators/material.validator.js";

/**
 * Org Admin: Create wholesale material product
 */
export const createMaterial = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required to create a material product", statusCode.Forbidden);
  }

  const parsed = createMaterialSchema.parse({ body: req.body });
  const material = await materialService.createProduct(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Material product created successfully", material, statusCode.Created);
});

/**
 * Public: List material products (filterable by organizationId, categoryId, etc.)
 */
export const getMaterials = asyncHandler(async (req, res) => {
  const parsed = getMaterialsQuerySchema.parse({ query: req.query });

  const organizationId = parsed.query.organizationId;

  const result = await materialService.getProducts({
    ...parsed.query,
    organizationId,
  });
  return SuccessResponse(res, "Material products retrieved successfully", result, statusCode.OK);
});

/**
 * Authenticated: Get single material product
 */
export const getMaterialById = asyncHandler(async (req, res) => {
  const parsed = materialIdParamSchema.parse({ params: req.params });
  const material = await materialService.getProductById(parsed.params.id);
  return SuccessResponse(res, "Material product retrieved successfully", material, statusCode.OK);
});

/**
 * Org Admin: Update material product
 */
export const updateMaterial = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updateMaterialSchema.parse({ params: req.params, body: req.body });
  const material = await materialService.updateProduct(parsed.params.id, organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Material product updated successfully", material, statusCode.OK);
});

/**
 * Org Admin: Soft-delete material product
 */
export const deleteMaterial = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = materialIdParamSchema.parse({ params: req.params });
  await materialService.deleteProduct(parsed.params.id, organizationId);
  return SuccessResponse(res, "Material product deleted successfully", {}, statusCode.OK);
});

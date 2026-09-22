import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { materialService } from "../services/material.service.js";
import {
  createMaterialSchema,
  updateMaterialSchema,
  getMaterialsQuerySchema,
  materialIdParamSchema,
  createMaterialVendorOfferingSchema,
  updateMaterialVendorOfferingSchema,
  materialVendorParamSchema,
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

// ===========================================================================
// MULTI-VENDOR OFFERINGS CONTROLLER HANDLERS
// ===========================================================================

/**
 * @route   POST /api/v1/marketplace/materials/:productId/vendors
 * @desc    Attach a vendor offering / supplier to a Material product
 */
export const addMaterialVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = createMaterialVendorOfferingSchema.parse({
    params: req.params,
    body: req.body,
  });

  const offering = await materialService.addVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.body
  );

  return SuccessResponse(res, "Vendor offering attached to material product successfully", offering, statusCode.Created);
});

/**
 * @route   GET /api/v1/marketplace/materials/:productId/vendors
 * @desc    List all vendor offerings for a Material product
 */
export const getMaterialVendorOfferings = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = materialVendorParamSchema.parse({ params: req.params });
  const offerings = await materialService.getVendorOfferings(organizationId, parsed.params.productId);

  return SuccessResponse(res, "Product vendor offerings retrieved successfully", offerings, statusCode.OK);
});

/**
 * @route   GET /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId
 * @desc    Retrieve single vendor offering details
 */
export const getMaterialVendorOfferingById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = materialVendorParamSchema.parse({ params: req.params });
  if (!parsed.params.vendorOfferingId) {
    throw new ErrorResponse("Vendor offering ID is required", statusCode.Bad_Request);
  }

  const offering = await materialService.getVendorOfferingById(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId
  );

  return SuccessResponse(res, "Vendor offering retrieved successfully", offering, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId
 * @desc    Update a vendor offering (commission rate, pricing, stock, lead time)
 */
export const updateMaterialVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updateMaterialVendorOfferingSchema.parse({
    params: req.params,
    body: req.body,
  });

  const updatedOffering = await materialService.updateVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId,
    parsed.body
  );

  return SuccessResponse(res, "Vendor offering updated successfully", updatedOffering, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId
 * @desc    Detach / remove vendor offering from a Material product
 */
export const removeMaterialVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = materialVendorParamSchema.parse({ params: req.params });
  if (!parsed.params.vendorOfferingId) {
    throw new ErrorResponse("Vendor offering ID is required", statusCode.Bad_Request);
  }

  await materialService.removeVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId
  );

  return SuccessResponse(res, "Vendor offering removed from material product successfully", {}, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/marketplace/materials/:productId/vendors/:vendorOfferingId/primary
 * @desc    Set vendor offering as primary supplier for a Material product
 */
export const setPrimaryMaterialVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = materialVendorParamSchema.parse({ params: req.params });
  if (!parsed.params.vendorOfferingId) {
    throw new ErrorResponse("Vendor offering ID is required", statusCode.Bad_Request);
  }

  const updatedOffering = await materialService.setPrimaryVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId
  );

  return SuccessResponse(res, "Primary vendor offering updated successfully", updatedOffering, statusCode.OK);
});

import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { homeDecorService } from "../services/home-decor.service.js";
import {
  createHomeDecorSchema,
  updateHomeDecorSchema,
  getHomeDecorQuerySchema,
  homeDecorIdParamSchema,
  createHomeDecorVendorOfferingSchema,
  updateHomeDecorVendorOfferingSchema,
  homeDecorVendorParamSchema,
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

// ===========================================================================
// MULTI-VENDOR OFFERINGS CONTROLLER HANDLERS
// ===========================================================================

/**
 * @route   POST /api/v1/marketplace/home-decor/:productId/vendors
 * @desc    Attach a vendor offering / supplier to a Home Decor product
 */
export const addHomeDecorVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = createHomeDecorVendorOfferingSchema.parse({
    params: req.params,
    body: req.body,
  });

  const offering = await homeDecorService.addVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.body
  );

  return SuccessResponse(res, "Vendor offering attached to product successfully", offering, statusCode.Created);
});

/**
 * @route   GET /api/v1/marketplace/home-decor/:productId/vendors
 * @desc    List all vendor offerings for a Home Decor product
 */
export const getHomeDecorVendorOfferings = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = homeDecorVendorParamSchema.parse({ params: req.params });
  const offerings = await homeDecorService.getVendorOfferings(organizationId, parsed.params.productId);

  return SuccessResponse(res, "Product vendor offerings retrieved successfully", offerings, statusCode.OK);
});

/**
 * @route   GET /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId
 * @desc    Retrieve single vendor offering details
 */
export const getHomeDecorVendorOfferingById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = homeDecorVendorParamSchema.parse({ params: req.params });
  if (!parsed.params.vendorOfferingId) {
    throw new ErrorResponse("Vendor offering ID is required", statusCode.Bad_Request);
  }

  const offering = await homeDecorService.getVendorOfferingById(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId
  );

  return SuccessResponse(res, "Vendor offering retrieved successfully", offering, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId
 * @desc    Update a vendor offering (commission rate, pricing, stock, lead time)
 */
export const updateHomeDecorVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = updateHomeDecorVendorOfferingSchema.parse({
    params: req.params,
    body: req.body,
  });

  const updatedOffering = await homeDecorService.updateVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId,
    parsed.body
  );

  return SuccessResponse(res, "Vendor offering updated successfully", updatedOffering, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId
 * @desc    Detach / remove vendor offering from a Home Decor product
 */
export const removeHomeDecorVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = homeDecorVendorParamSchema.parse({ params: req.params });
  if (!parsed.params.vendorOfferingId) {
    throw new ErrorResponse("Vendor offering ID is required", statusCode.Bad_Request);
  }

  await homeDecorService.removeVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId
  );

  return SuccessResponse(res, "Vendor offering removed from product successfully", {}, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/marketplace/home-decor/:productId/vendors/:vendorOfferingId/primary
 * @desc    Set vendor offering as primary supplier for a product
 */
export const setPrimaryHomeDecorVendorOffering = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = homeDecorVendorParamSchema.parse({ params: req.params });
  if (!parsed.params.vendorOfferingId) {
    throw new ErrorResponse("Vendor offering ID is required", statusCode.Bad_Request);
  }

  const updatedOffering = await homeDecorService.setPrimaryVendorOffering(
    organizationId,
    parsed.params.productId,
    parsed.params.vendorOfferingId
  );

  return SuccessResponse(res, "Primary vendor offering updated successfully", updatedOffering, statusCode.OK);
});

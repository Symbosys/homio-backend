import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { sellerCategoryService } from "../services/seller-category.service.js";
import {
  registerSellerCategorySchema,
  approveSellerCategorySchema,
  getSellerCategoriesQuerySchema,
  sellerCategoryIdParamSchema,
} from "../validators/seller-category.validator.js";

/**
 * Org Admin: Register intent to sell in a category
 */
export const registerSellerCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = registerSellerCategorySchema.parse({ body: req.body });
  const assignment = await sellerCategoryService.registerCategory(organizationId, parsed.body.categoryId);
  return SuccessResponse(res, "Seller category registered successfully", assignment, statusCode.Created);
});

/**
 * Org Admin / Platform Admin: Get seller categories
 */
export const getSellerCategories = asyncHandler(async (req, res) => {
  const parsed = getSellerCategoriesQuerySchema.parse({ query: req.query });
  const organizationId = req.user?.userType === "PLATFORM_ADMIN" ? undefined : req.user?.organizationId || undefined;

  const result = await sellerCategoryService.getSellerCategories({
    ...parsed.query,
    organizationId,
  });

  return SuccessResponse(res, "Seller categories retrieved successfully", result, statusCode.OK);
});

/**
 * Org Admin: View single seller category
 */
export const getSellerCategoryById = asyncHandler(async (req, res) => {
  const parsed = sellerCategoryIdParamSchema.parse({ params: req.params });
  const assignment = await sellerCategoryService.getSellerCategoryById(parsed.params.id);
  return SuccessResponse(res, "Seller category assignment retrieved successfully", assignment, statusCode.OK);
});

/**
 * Platform Admin: Review & approve/reject seller category with commission rate
 */
export const approveSellerCategory = asyncHandler(async (req, res) => {
  const parsed = approveSellerCategorySchema.parse({ params: req.params, body: req.body });
  const updated = await sellerCategoryService.approveSellerCategory(
    parsed.params.id,
    parsed.body.isApproved,
    parsed.body.commissionRate
  );
  return SuccessResponse(res, "Seller category approval updated successfully", updated, statusCode.OK);
});

/**
 * Org Admin: Remove/deregister seller category
 */
export const removeSellerCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const parsed = sellerCategoryIdParamSchema.parse({ params: req.params });
  await sellerCategoryService.removeSellerCategory(parsed.params.id, organizationId);
  return SuccessResponse(res, "Seller category removed successfully", {}, statusCode.OK);
});

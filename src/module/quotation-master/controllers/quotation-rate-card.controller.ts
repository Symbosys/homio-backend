import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { quotationRateCardService } from "../services/quotation-rate-card.service.js";
import {
  createRateCardSchema,
  updateRateCardSchema,
  getRateCardsQuerySchema,
  rateCardIdParamSchema,
  reorderRateCardsSchema,
} from "../validators/quotation-rate-card.validator.js";

/**
 * @route   POST /api/v1/quotation-master/rate-cards
 * @desc    Create a new rate card / pricing tier
 * @access  Private (Authenticated Tenant User)
 */
export const createRateCard = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createRateCardSchema.parse({ body: req.body });
  const result = await quotationRateCardService.createRateCard(organizationId, parsed.body);
  return SuccessResponse(res, "Rate card created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/quotation-master/rate-cards
 * @desc    Fetch non-paginated list of rate cards for the tenant
 * @access  Private (Authenticated Tenant User)
 */
export const getRateCards = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getRateCardsQuerySchema.parse({ query: req.query });
  const result = await quotationRateCardService.getRateCards(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Rate cards retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/quotation-master/rate-cards/default
 * @desc    Fetch active default rate card for the tenant
 * @access  Private (Authenticated Tenant User)
 */
export const getDefaultRateCard = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await quotationRateCardService.getDefaultRateCard(organizationId);
  return SuccessResponse(res, "Default rate card retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/quotation-master/rate-cards/:id
 * @desc    Fetch details of a single rate card
 * @access  Private (Authenticated Tenant User)
 */
export const getRateCardById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = rateCardIdParamSchema.parse({ params: req.params });
  const result = await quotationRateCardService.getRateCardById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Rate card retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/rate-cards/:id
 * @desc    Update rate card (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
export const updateRateCard = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateRateCardSchema.parse({ params: req.params, body: req.body });
  const result = await quotationRateCardService.updateRateCard(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Rate card updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/quotation-master/rate-cards/:id
 * @desc    Soft delete a rate card
 * @access  Private (Authenticated Tenant User)
 */
export const deleteRateCard = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = rateCardIdParamSchema.parse({ params: req.params });
  const result = await quotationRateCardService.deleteRateCard(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Rate card deleted successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/rate-cards/:id/toggle-active
 * @desc    Toggle active state of a rate card
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveRateCard = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = rateCardIdParamSchema.parse({ params: req.params });
  const result = await quotationRateCardService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Rate card status updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/rate-cards/:id/set-default
 * @desc    Set specific rate card as the organization default
 * @access  Private (Authenticated Tenant User)
 */
export const setDefaultRateCard = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = rateCardIdParamSchema.parse({ params: req.params });
  const result = await quotationRateCardService.setDefaultRateCard(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Default rate card updated successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/quotation-master/rate-cards/reorder
 * @desc    Batch reorder rate cards
 * @access  Private (Authenticated Tenant User)
 */
export const reorderRateCards = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = reorderRateCardsSchema.parse({ body: req.body });
  const result = await quotationRateCardService.reorderRateCards(organizationId, parsed.body);
  return SuccessResponse(res, "Rate cards reordered successfully", result, statusCode.OK);
});

import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { quotationPdfAssetService } from "../services/quotation-pdf-asset.service.js";
import {
  createPdfAssetSchema,
  updatePdfAssetSchema,
  getPdfAssetsQuerySchema,
  pdfAssetIdParamSchema,
  reorderPdfAssetsSchema,
} from "../validators/quotation-pdf-asset.validator.js";

/**
 * @route   POST /api/v1/quotation-master/pdf-assets
 * @desc    Upload & create a new PDF page image asset (Max 10 Front / 10 Back limit per tenant)
 * @access  Private (Authenticated Tenant User)
 */
export const createPdfAsset = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.file) {
    throw new ErrorResponse("No image file provided in upload request", statusCode.Bad_Request);
  }

  const parsed = createPdfAssetSchema.parse({ body: req.body });
  const result = await quotationPdfAssetService.createAsset(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "PDF page asset uploaded successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/quotation-master/pdf-assets
 * @desc    Fetch non-paginated list of PDF page assets
 * @access  Private (Authenticated Tenant User)
 */
export const getPdfAssets = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getPdfAssetsQuerySchema.parse({ query: req.query });
  const result = await quotationPdfAssetService.getAssets(organizationId, parsedQuery.query);
  return SuccessResponse(res, "PDF page assets retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/quotation-master/pdf-assets/summary
 * @desc    Fetch quota summary and usage (Front & Back image counts against max 10 limit)
 * @access  Private (Authenticated Tenant User)
 */
export const getPdfAssetsSummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await quotationPdfAssetService.getSummary(organizationId);
  return SuccessResponse(res, "PDF page assets summary retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/quotation-master/pdf-assets/:id
 * @desc    Fetch details of a single PDF page asset
 * @access  Private (Authenticated Tenant User)
 */
export const getPdfAssetById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = pdfAssetIdParamSchema.parse({ params: req.params });
  const result = await quotationPdfAssetService.getAssetById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "PDF page asset retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/pdf-assets/:id
 * @desc    Update PDF asset metadata (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
export const updatePdfAsset = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updatePdfAssetSchema.parse({ params: req.params, body: req.body });
  const result = await quotationPdfAssetService.updateAsset(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "PDF page asset updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/quotation-master/pdf-assets/:id
 * @desc    Soft delete a PDF asset, clean up storage, and recompact sort orders
 * @access  Private (Authenticated Tenant User)
 */
export const deletePdfAsset = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = pdfAssetIdParamSchema.parse({ params: req.params });
  const result = await quotationPdfAssetService.deleteAsset(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "PDF page asset deleted successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/pdf-assets/:id/toggle-active
 * @desc    Toggle active state of a PDF asset
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActivePdfAsset = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = pdfAssetIdParamSchema.parse({ params: req.params });
  const result = await quotationPdfAssetService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "PDF page asset status updated successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/quotation-master/pdf-assets/reorder
 * @desc    Batch reorder PDF assets within FRONT or BACK position
 * @access  Private (Authenticated Tenant User)
 */
export const reorderPdfAssets = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = reorderPdfAssetsSchema.parse({ body: req.body });
  const result = await quotationPdfAssetService.reorderAssets(organizationId, parsed.body);
  return SuccessResponse(res, "PDF page assets reordered successfully", result, statusCode.OK);
});

import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { quotationTermsTemplateService } from "../services/quotation-terms-template.service.js";
import {
  createTermsTemplateSchema,
  updateTermsTemplateSchema,
  getTermsTemplatesQuerySchema,
  termsTemplateIdParamSchema,
  duplicateTermsTemplateSchema,
} from "../validators/quotation-terms-template.validator.js";

/**
 * @route   POST /api/v1/quotation-master/terms-templates
 * @desc    Create a new terms & conditions / warranty template
 * @access  Private (Authenticated Tenant User)
 */
export const createTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createTermsTemplateSchema.parse({ body: req.body });
  const result = await quotationTermsTemplateService.createTermsTemplate(organizationId, parsed.body);
  return SuccessResponse(res, "Terms template created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/quotation-master/terms-templates
 * @desc    Fetch non-paginated list of terms templates for the tenant
 * @access  Private (Authenticated Tenant User)
 */
export const getTermsTemplates = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getTermsTemplatesQuerySchema.parse({ query: req.query });
  const result = await quotationTermsTemplateService.getTermsTemplates(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Terms templates retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/quotation-master/terms-templates/default
 * @desc    Fetch active default terms template for the tenant
 * @access  Private (Authenticated Tenant User)
 */
export const getDefaultTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const result = await quotationTermsTemplateService.getDefaultTermsTemplate(organizationId);
  return SuccessResponse(res, "Default terms template retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/quotation-master/terms-templates/:id
 * @desc    Fetch details of a single terms template
 * @access  Private (Authenticated Tenant User)
 */
export const getTermsTemplateById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = termsTemplateIdParamSchema.parse({ params: req.params });
  const result = await quotationTermsTemplateService.getTermsTemplateById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Terms template retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/terms-templates/:id
 * @desc    Update terms template (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
export const updateTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateTermsTemplateSchema.parse({ params: req.params, body: req.body });
  const result = await quotationTermsTemplateService.updateTermsTemplate(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Terms template updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/quotation-master/terms-templates/:id
 * @desc    Soft delete a terms template
 * @access  Private (Authenticated Tenant User)
 */
export const deleteTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = termsTemplateIdParamSchema.parse({ params: req.params });
  const result = await quotationTermsTemplateService.deleteTermsTemplate(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Terms template deleted successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/terms-templates/:id/toggle-active
 * @desc    Toggle active state of a terms template
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = termsTemplateIdParamSchema.parse({ params: req.params });
  const result = await quotationTermsTemplateService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Terms template status updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/quotation-master/terms-templates/:id/set-default
 * @desc    Set specific terms template as the organization default
 * @access  Private (Authenticated Tenant User)
 */
export const setDefaultTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = termsTemplateIdParamSchema.parse({ params: req.params });
  const result = await quotationTermsTemplateService.setDefaultTermsTemplate(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Default terms template updated successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/quotation-master/terms-templates/:id/duplicate
 * @desc    Duplicate / clone an existing terms template
 * @access  Private (Authenticated Tenant User)
 */
export const duplicateTermsTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = duplicateTermsTemplateSchema.parse({ params: req.params, body: req.body });
  const result = await quotationTermsTemplateService.duplicateTermsTemplate(
    parsed.params.id,
    organizationId,
    parsed.body
  );
  return SuccessResponse(res, "Terms template duplicated successfully", result, statusCode.Created);
});

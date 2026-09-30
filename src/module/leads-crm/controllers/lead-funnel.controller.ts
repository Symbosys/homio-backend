import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadFunnelService } from "../services/lead-funnel.service.js";
import {
  createLeadFunnelSchema,
  updateLeadFunnelSchema,
  getLeadFunnelsQuerySchema,
  createFunnelStageSchema,
  updateFunnelStageSchema,
  reorderStagesSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
  submitPublicLeadSchema,
} from "../validators/lead-funnel.validator.js";

/**
 * Controller: Get all funnels for the tenant
 */
export const getLeadFunnels = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLeadFunnelsQuerySchema.parse({ query: req.query });
  const result = await leadFunnelService.getFunnels(organizationId, parsed.query);
  return SuccessResponse(res, "Lead funnels retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single funnel by ID
 */
export const getLeadFunnelById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const result = await leadFunnelService.getFunnelById(id, organizationId);
  return SuccessResponse(res, "Lead funnel retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Create new funnel
 */
export const createLeadFunnel = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLeadFunnelSchema.parse({ body: req.body });
  const result = await leadFunnelService.createFunnel(organizationId, parsed.body);
  return SuccessResponse(res, "Lead funnel created successfully", result, statusCode.Created);
});

/**
 * Controller: Update existing funnel
 */
export const updateLeadFunnel = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const parsed = updateLeadFunnelSchema.parse({ body: req.body });
  const result = await leadFunnelService.updateFunnel(id, organizationId, parsed.body);
  return SuccessResponse(res, "Lead funnel updated successfully", result, statusCode.OK);
});

/**
 * Controller: Delete funnel
 */
export const deleteLeadFunnel = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  await leadFunnelService.deleteFunnel(id, organizationId);
  return SuccessResponse(res, "Lead funnel deleted successfully", null, statusCode.OK);
});

// ==========================================
// STAGES CONTROLLERS
// ==========================================

/**
 * Controller: Add stage to funnel
 */
export const addFunnelStage = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const parsed = createFunnelStageSchema.parse({ body: req.body });
  const result = await leadFunnelService.addStage(id, organizationId, parsed.body);
  return SuccessResponse(res, "Stage added successfully", result, statusCode.Created);
});

/**
 * Controller: Update stage
 */
export const updateFunnelStage = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const stageId = req.params.stageId as string;
  const parsed = updateFunnelStageSchema.parse({ body: req.body });
  const result = await leadFunnelService.updateStage(stageId, id, organizationId, parsed.body);
  return SuccessResponse(res, "Stage updated successfully", result, statusCode.OK);
});

/**
 * Controller: Delete stage
 */
export const deleteFunnelStage = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const stageId = req.params.stageId as string;
  await leadFunnelService.deleteStage(stageId, id, organizationId);
  return SuccessResponse(res, "Stage deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Reorder stages
 */
export const reorderFunnelStages = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const parsed = reorderStagesSchema.parse({ body: req.body });
  const result = await leadFunnelService.reorderStages(id, organizationId, parsed.body.stages);
  return SuccessResponse(res, "Stages reordered successfully", result, statusCode.OK);
});

// ==========================================
// DYNAMIC FORM FIELDS CONTROLLERS
// ==========================================

/**
 * Controller: Add form field to funnel
 */
export const addFunnelFormField = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const parsed = createFormFieldSchema.parse({ body: req.body });
  const result = await leadFunnelService.addFormField(id, organizationId, parsed.body);
  return SuccessResponse(res, "Dynamic form field added successfully", result, statusCode.Created);
});

/**
 * Controller: Update form field
 */
export const updateFunnelFormField = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const fieldId = req.params.fieldId as string;
  const parsed = updateFormFieldSchema.parse({ body: req.body });
  const result = await leadFunnelService.updateFormField(fieldId, id, organizationId, parsed.body);
  return SuccessResponse(res, "Dynamic form field updated successfully", result, statusCode.OK);
});

/**
 * Controller: Delete form field
 */
export const deleteFunnelFormField = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const fieldId = req.params.fieldId as string;
  await leadFunnelService.deleteFormField(fieldId, id, organizationId);
  return SuccessResponse(res, "Dynamic form field deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Reorder form fields
 */
export const reorderFunnelFormFields = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const id = req.params.id as string;
  const parsed = reorderFormFieldsSchema.parse({ body: req.body });
  const result = await leadFunnelService.reorderFormFields(id, organizationId, parsed.body.fields);
  return SuccessResponse(res, "Dynamic form fields reordered successfully", result, statusCode.OK);
});

// ==========================================
// PUBLIC EMBED CONTROLLERS
// ==========================================

/**
 * Controller: Get public funnel definition by embed slug (No auth required)
 */
export const getPublicEmbedFunnel = asyncHandler(async (req, res) => {
  const { embedSlug } = req.params;
  if (!embedSlug || typeof embedSlug !== "string") {
    throw new ErrorResponse("Valid embed slug required", statusCode.Bad_Request);
  }
  const result = await leadFunnelService.getPublicEmbedFunnel(embedSlug);
  return SuccessResponse(res, "Public funnel definition retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Ingest lead from public embedded form submission (No auth required)
 */
export const submitPublicEmbedLead = asyncHandler(async (req, res) => {
  const { embedSlug } = req.params;
  if (!embedSlug || typeof embedSlug !== "string") {
    throw new ErrorResponse("Valid embed slug required", statusCode.Bad_Request);
  }
  const parsed = submitPublicLeadSchema.parse({ body: req.body });
  const result = await leadFunnelService.submitPublicEmbedLead(embedSlug, parsed.body);
  return SuccessResponse(res, "Inquiry submitted successfully", result, statusCode.Created);
});

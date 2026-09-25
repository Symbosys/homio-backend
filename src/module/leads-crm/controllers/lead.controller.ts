import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadService } from "../services/lead.service.js";
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  assignLeadSchema,
  convertLeadSchema,
  markLeadLostSchema,
  bulkActionLeadsSchema,
  leadIdParamSchema,
  getLeadsQuerySchema,
  updateLeadChannelPartnerSchema,
  getDistinctPropertiesQuerySchema,
} from "../validators/lead.validator.js";

/**
 * Controller: Create new Lead (with automatic Customer deduplication & recurring inquiry counter)
 */
export const createLead = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLeadSchema.parse({ body: req.body });
  const result = await leadService.createLead(organizationId, parsed.body, req.user?.id);
  return SuccessResponse(res, "Lead created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all Leads with stage filters, budget ranges, and pagination
 */
export const getLeads = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLeadsQuerySchema.parse({ query: req.query });
  const result = await leadService.getLeads(organizationId, parsed.query);
  return SuccessResponse(res, "Leads retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single Lead details by ID
 */
export const getLeadById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = leadIdParamSchema.parse({ params: req.params });
  const result = await leadService.getLeadById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Lead details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update Lead profile details
 */
export const updateLead = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLeadSchema.parse({ params: req.params, body: req.body });
  const result = await leadService.updateLead(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Lead updated successfully", result, statusCode.OK);
});

/**
 * Controller: Update Lead Pipeline Stage Status (with Stage History audit trail)
 */
export const updateLeadStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLeadStatusSchema.parse({ params: req.params, body: req.body });
  const result = await leadService.updateLeadStatus(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Lead status updated successfully", result, statusCode.OK);
});

/**
 * Controller: Assign Lead to representative / designer
 */
export const assignLead = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = assignLeadSchema.parse({ params: req.params, body: req.body });
  const result = await leadService.assignLead(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Lead assignment updated successfully", result, statusCode.OK);
});

/**
 * Controller: Convert Lead to Client (WON) & configure Client Portal
 */
export const convertLead = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = convertLeadSchema.parse({ params: req.params, body: req.body });
  const result = await leadService.convertLead(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Lead converted to Client successfully", result, statusCode.OK);
});

/**
 * Controller: Mark Lead as Lost
 */
export const markLeadLost = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = markLeadLostSchema.parse({ params: req.params, body: req.body });
  const result = await leadService.markLeadLost(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Lead marked as lost", result, statusCode.OK);
});

/**
 * Controller: Bulk actions on multiple leads (Assign, Stage Update, Delete)
 */
export const bulkActionLeads = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = bulkActionLeadsSchema.parse({ body: req.body });
  const result = await leadService.bulkActions(organizationId, parsed.body, req.user?.id);
  return SuccessResponse(res, "Bulk action executed successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete single Lead
 */
export const deleteLead = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = leadIdParamSchema.parse({ params: req.params });
  const result = await leadService.deleteLead(parsed.params.id, organizationId);
  return SuccessResponse(res, "Lead deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Update Channel Partner link and commission on Lead
 */
export const updateLeadChannelPartner = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLeadChannelPartnerSchema.parse({ params: req.params, body: req.body });
  const result = await leadService.updateLeadChannelPartner(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Channel partner link updated successfully", result, statusCode.OK);
});

/**
 * Controller: Get distinct property names for searchable dropdown
 */
export const getDistinctProperties = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getDistinctPropertiesQuerySchema.parse({ query: req.query });
  const result = await leadService.getDistinctProperties(organizationId, parsed.query);
  return SuccessResponse(res, "Distinct properties retrieved successfully", result, statusCode.OK);
});

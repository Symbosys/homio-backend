import { prisma } from "../../../lib/prisma.js";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { llmIntegrationService } from "../services/llm-integration.service.js";
import {
  listLlmModelsQuerySchema,
  llmCredentialAuditQuerySchema,
  llmModelIdParamsSchema,
  llmPagedQuerySchema,
  llmProviderParamsSchema,
  updateLlmSettingSchema,
  upsertLlmCredentialSchema,
} from "../validators/llm-integration.validator.js";

/**
 * Requires the authenticated user's organization. Platform users without a tenant are rejected.
 * @param organizationId Organization id from the JWT, when present
 */
function requireOrganizationId(organizationId: string | null | undefined): string {
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }
  return organizationId;
}

/**
 * Resolves the employee profile for audit columns. A user without an employee row is allowed.
 * @param userId Authenticated user id
 * @param organizationId Tenant id
 */
async function resolveEmployeeId(userId: string | undefined, organizationId: string) {
  if (!userId) {
    return null;
  }
  const employee = await prisma.employee.findFirst({
    where: { userId, organizationId, isDeleted: false },
    select: { id: true },
  });
  return employee?.id ?? null;
}

/**
 * @route GET /api/v1/integrations/llm/models
 * @desc List platform LLM models the organization can select
 */
export const listLlmModels = asyncHandler(async (req, res) => {
  requireOrganizationId(req.user?.organizationId);
  const parsed = listLlmModelsQuerySchema.parse({ query: req.query });
  const models = await llmIntegrationService.listModels(parsed.query);
  return SuccessResponse(res, "LLM models retrieved successfully", models, statusCode.OK);
});

/**
 * @route GET /api/v1/integrations/llm/models/:modelId
 * @desc Fetch one catalog model
 */
export const getLlmModel = asyncHandler(async (req, res) => {
  requireOrganizationId(req.user?.organizationId);
  const parsed = llmModelIdParamsSchema.parse({ params: req.params });
  const model = await llmIntegrationService.getModel(parsed.params.modelId);
  return SuccessResponse(res, "LLM model retrieved successfully", model, statusCode.OK);
});

/**
 * @route GET /api/v1/integrations/llm/credentials
 * @desc List the organization's saved provider credentials without API keys
 */
export const listLlmCredentials = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const credentials = await llmIntegrationService.listCredentials(organizationId);
  return SuccessResponse(res, "LLM credentials retrieved successfully", credentials, statusCode.OK);
});

/**
 * @route GET /api/v1/integrations/llm/credentials/:provider
 * @desc Fetch one provider credential. The response contains keyHint, not the raw key.
 */
export const getLlmCredential = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = llmProviderParamsSchema.parse({ params: req.params });
  const credential = await llmIntegrationService.getCredential(organizationId, parsed.params.provider);
  return SuccessResponse(res, "LLM credential retrieved successfully", credential, statusCode.OK);
});

/**
 * @route PUT /api/v1/integrations/llm/credentials/:provider
 * @desc Save or replace the raw API key for one provider
 */
export const saveLlmCredential = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = upsertLlmCredentialSchema.parse({ params: req.params, body: req.body });
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);
  const credential = await llmIntegrationService.saveCredential(
    organizationId,
    parsed.params.provider,
    parsed.body,
    employeeId,
  );
  return SuccessResponse(res, "LLM API key saved successfully", credential, statusCode.OK);
});

/**
 * @route POST /api/v1/integrations/llm/credentials/:provider/verify
 * @desc Verify the stored API key with the provider and mark it active when accepted
 */
export const verifyLlmCredential = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = llmProviderParamsSchema.parse({ params: req.params });
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);
  const credential = await llmIntegrationService.verifyCredential(
    organizationId,
    parsed.params.provider,
    employeeId,
  );
  return SuccessResponse(res, "LLM API key verified successfully", credential, statusCode.OK);
});

/**
 * @route PATCH /api/v1/integrations/llm/credentials/:provider/disable
 * @desc Disable a provider key without deleting it
 */
export const disableLlmCredential = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = llmProviderParamsSchema.parse({ params: req.params });
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);
  const credential = await llmIntegrationService.disableCredential(
    organizationId,
    parsed.params.provider,
    employeeId,
  );
  return SuccessResponse(res, "LLM credential disabled successfully", credential, statusCode.OK);
});

/**
 * @route DELETE /api/v1/integrations/llm/credentials/:provider
 * @desc Delete a provider key and clear it from the active reply setting
 */
export const deleteLlmCredential = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = llmProviderParamsSchema.parse({ params: req.params });
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);
  const result = await llmIntegrationService.deleteCredential(
    organizationId,
    parsed.params.provider,
    employeeId,
  );
  return SuccessResponse(res, "LLM credential deleted successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/integrations/llm/credentials/:provider/audits
 * @desc List append-only credential audit events for one provider
 */
export const listLlmCredentialAudits = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = llmCredentialAuditQuerySchema.parse({ params: req.params, query: req.query });
  const audits = await llmIntegrationService.listAudits(
    organizationId,
    parsed.params.provider,
    parsed.query.page,
    parsed.query.limit,
  );
  return SuccessResponse(res, "LLM credential audits retrieved successfully", audits, statusCode.OK);
});

/**
 * @route GET /api/v1/integrations/llm/settings
 * @desc Fetch the organization's active provider, model, and auto-reply options
 */
export const getLlmSetting = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const setting = await llmIntegrationService.getSetting(organizationId);
  return SuccessResponse(
    res,
    setting ? "LLM settings retrieved successfully" : "LLM settings are not configured",
    setting,
    statusCode.OK,
  );
});

/**
 * @route PUT /api/v1/integrations/llm/settings
 * @desc Update the active model and reply options. Send only fields that changed.
 */
export const updateLlmSetting = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = updateLlmSettingSchema.parse({ body: req.body });
  const employeeId = await resolveEmployeeId(req.user?.id, organizationId);
  const setting = await llmIntegrationService.updateSetting(organizationId, parsed.body, employeeId);
  return SuccessResponse(res, "LLM settings saved successfully", setting, statusCode.OK);
});

/**
 * @route GET /api/v1/integrations/llm/usages
 * @desc List recorded LLM calls for the organization
 */
export const listLlmUsages = asyncHandler(async (req, res) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const parsed = llmPagedQuerySchema.parse({ query: req.query });
  const usages = await llmIntegrationService.listUsages(
    organizationId,
    parsed.query.page,
    parsed.query.limit,
    parsed.query.provider,
  );
  return SuccessResponse(res, "LLM usage retrieved successfully", usages, statusCode.OK);
});

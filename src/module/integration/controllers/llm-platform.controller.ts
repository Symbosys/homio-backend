import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { llmIntegrationService } from "../services/llm-integration.service.js";
import {
  createLlmModelSchema,
  listLlmModelsQuerySchema,
  llmModelIdParamsSchema,
  updateLlmModelSchema,
} from "../validators/llm-integration.validator.js";

/**
 * @route GET /api/v1/platform/llm/models
 * @desc List every catalog model, including inactive and deprecated rows
 */
export const listPlatformLlmModels = asyncHandler(async (req, res) => {
  const parsed = listLlmModelsQuerySchema.parse({ query: req.query });
  const models = await llmIntegrationService.listModels({
    ...parsed.query,
    includeInactive: parsed.query.includeInactive || req.query.includeInactive === undefined,
  });
  return SuccessResponse(res, "LLM models retrieved successfully", models, statusCode.OK);
});

/**
 * @route GET /api/v1/platform/llm/models/:modelId
 * @desc Fetch one catalog model
 */
export const getPlatformLlmModel = asyncHandler(async (req, res) => {
  const parsed = llmModelIdParamsSchema.parse({ params: req.params });
  const model = await llmIntegrationService.getModel(parsed.params.modelId);
  return SuccessResponse(res, "LLM model retrieved successfully", model, statusCode.OK);
});

/**
 * @route POST /api/v1/platform/llm/models
 * @desc Add a model organizations can select for AI replies
 */
export const createPlatformLlmModel = asyncHandler(async (req, res) => {
  const parsed = createLlmModelSchema.parse({ body: req.body });
  const model = await llmIntegrationService.createModel(parsed.body);
  return SuccessResponse(res, "LLM model created successfully", model, statusCode.Created);
});

/**
 * @route PATCH /api/v1/platform/llm/models/:modelId
 * @desc Update catalog fields. Send only fields that changed.
 */
export const updatePlatformLlmModel = asyncHandler(async (req, res) => {
  const parsed = updateLlmModelSchema.parse({ params: req.params, body: req.body });
  const model = await llmIntegrationService.updateModel(parsed.params.modelId, parsed.body);
  return SuccessResponse(res, "LLM model updated successfully", model, statusCode.OK);
});

/**
 * @route DELETE /api/v1/platform/llm/models/:modelId
 * @desc Delete a model that no organization has selected
 */
export const deletePlatformLlmModel = asyncHandler(async (req, res) => {
  const parsed = llmModelIdParamsSchema.parse({ params: req.params });
  const result = await llmIntegrationService.deleteModel(parsed.params.modelId);
  return SuccessResponse(res, "LLM model deleted successfully", result, statusCode.OK);
});

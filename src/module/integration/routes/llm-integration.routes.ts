import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  deleteLlmCredential,
  disableLlmCredential,
  getLlmCredential,
  getLlmModel,
  getLlmSetting,
  listLlmCredentialAudits,
  listLlmCredentials,
  listLlmModels,
  listLlmUsages,
  saveLlmCredential,
  updateLlmSetting,
  verifyLlmCredential,
} from "../controllers/llm-integration.controller.js";

const router = Router();

/**
 * All LLM integration routes are tenant-scoped.
 */
router.use(authenticate);

/**
 * @route GET /api/v1/integrations/llm/models
 * @desc List selectable OpenAI, Gemini, and Anthropic models
 */
router.get("/models", listLlmModels);

/**
 * @route GET /api/v1/integrations/llm/models/:modelId
 * @desc Fetch one catalog model
 */
router.get("/models/:modelId", getLlmModel);

/**
 * @route GET /api/v1/integrations/llm/credentials
 * @desc List saved provider credentials for the organization
 */
router.get("/credentials", listLlmCredentials);

/**
 * @route PUT /api/v1/integrations/llm/credentials/:provider
 * @desc Save or replace the raw API key for OPENAI, GEMINI, or ANTHROPIC
 */
router.put("/credentials/:provider", saveLlmCredential);

/**
 * @route GET /api/v1/integrations/llm/credentials/:provider
 * @desc Fetch one provider credential. The raw API key is not returned.
 */
router.get("/credentials/:provider", getLlmCredential);

/**
 * @route POST /api/v1/integrations/llm/credentials/:provider/verify
 * @desc Verify the stored API key with the provider
 */
router.post("/credentials/:provider/verify", verifyLlmCredential);

/**
 * @route PATCH /api/v1/integrations/llm/credentials/:provider/disable
 * @desc Disable a provider key without deleting it
 */
router.patch("/credentials/:provider/disable", disableLlmCredential);

/**
 * @route DELETE /api/v1/integrations/llm/credentials/:provider
 * @desc Delete a provider key
 */
router.delete("/credentials/:provider", deleteLlmCredential);

/**
 * @route GET /api/v1/integrations/llm/credentials/:provider/audits
 * @desc List credential create, rotate, verify, disable, and delete events
 */
router.get("/credentials/:provider/audits", listLlmCredentialAudits);

/**
 * @route GET /api/v1/integrations/llm/settings
 * @desc Fetch the active model and auto-reply options
 */
router.get("/settings", getLlmSetting);

/**
 * @route PUT /api/v1/integrations/llm/settings
 * @desc Update the active model and auto-reply options
 */
router.put("/settings", updateLlmSetting);

/**
 * @route GET /api/v1/integrations/llm/usages
 * @desc List recorded LLM calls for the organization
 */
router.get("/usages", listLlmUsages);

export default router;

import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createPlatformLlmModel,
  deletePlatformLlmModel,
  getPlatformLlmModel,
  listPlatformLlmModels,
  updatePlatformLlmModel,
} from "../controllers/llm-platform.controller.js";

const router = Router();

/**
 * Catalog management is limited to platform admins.
 */
router.use(authenticate, authorize("PLATFORM_ADMIN"));

/**
 * @route GET /api/v1/platform/llm/models
 * @desc List catalog models, including inactive rows
 */
router.get("/models", listPlatformLlmModels);

/**
 * @route GET /api/v1/platform/llm/models/:modelId
 * @desc Fetch one catalog model
 */
router.get("/models/:modelId", getPlatformLlmModel);

/**
 * @route POST /api/v1/platform/llm/models
 * @desc Add a model to the catalog
 */
router.post("/models", createPlatformLlmModel);

/**
 * @route PATCH /api/v1/platform/llm/models/:modelId
 * @desc Update a catalog model
 */
router.patch("/models/:modelId", updatePlatformLlmModel);

/**
 * @route DELETE /api/v1/platform/llm/models/:modelId
 * @desc Delete an unused catalog model
 */
router.delete("/models/:modelId", deletePlatformLlmModel);

export default router;

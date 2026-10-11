import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourService } from "../services/labour.service.js";
import {
  platformCreateLabourSchema,
  updateLabourSchema,
  platformGetLaboursQuerySchema,
  labourIdParamSchema,
} from "../validators/labour.validator.js";

/**
 * @route   POST /api/v1/platform/labours
 * @desc    Platform Admin: Create a labour profile (independent or assigned to a tenant organization)
 * @access  Private (PLATFORM_ADMIN)
 */
export const createLabour = asyncHandler(async (req, res) => {
  const parsed = platformCreateLabourSchema.parse({ body: req.body });
  const result = await labourService.createPlatformLabour(parsed.body, req.file, req.user?.id);
  return SuccessResponse(res, "Labour onboarded successfully by platform admin", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/platform/labours
 * @desc    Platform Admin: Fetch labours with flexible scoping (ALL, PLATFORM_ONLY, ORG_ONLY)
 * @access  Private (PLATFORM_ADMIN)
 */
export const getLabours = asyncHandler(async (req, res) => {
  const parsed = platformGetLaboursQuerySchema.parse({ query: req.query });
  const result = await labourService.getPlatformLabours(parsed.query);
  return SuccessResponse(res, "Platform labours retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/platform/labours/:id
 * @desc    Platform Admin: Fetch single labour profile across any organization or platform direct
 * @access  Private (PLATFORM_ADMIN)
 */
export const getLabourById = asyncHandler(async (req, res) => {
  const parsed = labourIdParamSchema.parse({ params: req.params });
  const result = await labourService.getPlatformLabourById(parsed.params.id);
  return SuccessResponse(res, "Labour details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/platform/labours/:id
 * @desc    Platform Admin: Update labour profile symmetrically
 * @access  Private (PLATFORM_ADMIN)
 */
export const updateLabour = asyncHandler(async (req, res) => {
  const parsed = updateLabourSchema.parse({ params: req.params, body: req.body });
  const result = await labourService.updatePlatformLabour(parsed.params.id, parsed.body, req.file, req.user?.id);
  return SuccessResponse(res, "Labour profile updated successfully by platform admin", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/platform/labours/:id
 * @desc    Platform Admin: Soft delete labour profile
 * @access  Private (PLATFORM_ADMIN)
 */
export const deleteLabour = asyncHandler(async (req, res) => {
  const parsed = labourIdParamSchema.parse({ params: req.params });
  await labourService.deletePlatformLabour(parsed.params.id);
  return SuccessResponse(res, "Labour profile deleted successfully by platform admin", null, statusCode.OK);
});

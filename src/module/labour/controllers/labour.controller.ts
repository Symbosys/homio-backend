import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourService } from "../services/labour.service.js";
import {
  createLabourSchema,
  updateLabourSchema,
  getLaboursQuerySchema,
  labourIdParamSchema,
} from "../validators/labour.validator.js";

/**
 * @route   POST /api/v1/labour
 * @desc    Onboard a new labour profile with KYC & settlement details
 * @access  Private (Authenticated Tenant User)
 */
export const createLabour = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createLabourSchema.parse({ body: req.body });
  const result = await labourService.createLabour(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Labour onboarded successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/labour
 * @desc    Fetch paginated list of labours with search and filters
 * @access  Private (Authenticated Tenant User)
 */
export const getLabours = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getLaboursQuerySchema.parse({ query: req.query });
  const result = await labourService.getLabours(organizationId, parsed.query);
  return SuccessResponse(res, "Labours retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/:id
 * @desc    Fetch single labour profile with full KYC documents and project history
 * @access  Private (Authenticated Tenant User)
 */
export const getLabourById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = labourIdParamSchema.parse({ params: req.params });
  const result = await labourService.getLabourById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/:id / PUT /api/v1/labour/:id
 * @desc    Update labour profile (Symmetric: all creation fields editable)
 * @access  Private (Authenticated Tenant User)
 */
export const updateLabour = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateLabourSchema.parse({ params: req.params, body: req.body });
  const result = await labourService.updateLabour(parsed.params.id, organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Labour profile updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/:id
 * @desc    Soft delete a labour profile
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLabour = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = labourIdParamSchema.parse({ params: req.params });
  await labourService.deleteLabour(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour deleted successfully", null, statusCode.OK);
});

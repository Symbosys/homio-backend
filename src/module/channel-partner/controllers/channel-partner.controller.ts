import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { channelPartnerService } from "../services/channel-partner.service.js";
import {
  createChannelPartnerSchema,
  updateChannelPartnerSchema,
  getChannelPartnersQuerySchema,
  cpIdParamSchema,
} from "../validators/channel-partner.validator.js";

/**
 * Controller: Create new Channel Partner
 */
export const createChannelPartner = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createChannelPartnerSchema.parse({ body: req.body });
  const result = await channelPartnerService.createPartner(organizationId, parsed.body, req.user?.id);
  return SuccessResponse(res, "Channel Partner created successfully", result, statusCode.Created);
});

/**
 * Controller: Get paginated list of Channel Partners for tenant organization
 */
export const getChannelPartners = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getChannelPartnersQuerySchema.parse({ query: req.query });
  const result = await channelPartnerService.getPartners(organizationId, parsed.query);
  return SuccessResponse(res, "Channel Partners retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get Channel Partner by ID
 */
export const getChannelPartnerById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = cpIdParamSchema.parse({ params: req.params });
  const result = await channelPartnerService.getPartnerById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Channel Partner retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update Channel Partner details (including status and KYC status)
 */
export const updateChannelPartner = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateChannelPartnerSchema.parse({ params: req.params, body: req.body });
  const result = await channelPartnerService.updatePartner(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Channel Partner updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete Channel Partner
 */
export const deleteChannelPartner = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = cpIdParamSchema.parse({ params: req.params });
  const result = await channelPartnerService.deletePartner(parsed.params.id, organizationId);
  return SuccessResponse(res, "Channel Partner deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Upload profile avatar for Channel Partner
 */
export const uploadAvatar = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = cpIdParamSchema.parse({ params: req.params });

  if (!req.file) {
    throw new ErrorResponse("Avatar image file is required", statusCode.Bad_Request);
  }

  const result = await channelPartnerService.uploadAvatar(parsed.params.id, organizationId, req.file);
  return SuccessResponse(res, "Avatar uploaded successfully", result, statusCode.OK);
});

import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { channelPartnerPayoutService } from "../services/channel-partner-payout.service.js";
import {
  createCPPayoutSchema,
  getCPPayoutsQuerySchema,
  payoutIdParamSchema,
} from "../validators/channel-partner-payout.validator.js";
import { cpIdParamSchema } from "../validators/channel-partner.validator.js";

/**
 * Controller: Create commission payout disbursement
 */
export const createPayout = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createCPPayoutSchema.parse({ body: req.body });
  const result = await channelPartnerPayoutService.createPayout(
    organizationId,
    parsed.body,
    req.file,
    req.user?.id
  );
  return SuccessResponse(res, "Payout created successfully", result, statusCode.Created);
});

/**
 * Controller: Get paginated organization payouts ledger
 */
export const getPayouts = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getCPPayoutsQuerySchema.parse({ query: req.query });
  const result = await channelPartnerPayoutService.getPayouts(organizationId, parsed.query);
  return SuccessResponse(res, "Payouts retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get payout by ID
 */
export const getPayoutById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = payoutIdParamSchema.parse({ params: req.params });
  const result = await channelPartnerPayoutService.getPayoutById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Payout details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get all payouts for a specific partner
 */
export const getPayoutsByPartnerId = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = cpIdParamSchema.parse({ params: req.params });
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

  const result = await channelPartnerPayoutService.getPayoutsByPartnerId(
    parsed.params.id,
    organizationId,
    page,
    limit
  );
  return SuccessResponse(res, "Partner payouts retrieved successfully", result, statusCode.OK);
});

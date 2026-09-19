import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { noticePeriodService } from "../services/notice-period.service.js";
import {
  applyNoticePeriodSchema,
  getNoticePeriodsQuerySchema,
  noticePeriodIdParamSchema,
  approveNoticePeriodSchema,
  rejectNoticePeriodSchema,
  updateNoticeBuyoutSchema,
  updateHandoverSchema,
  completeSettlementSchema,
} from "../validators/notice-period.validator.js";

/**
 * Controller: Apply for resignation / start notice period
 */
export const applyNoticePeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const parsed = applyNoticePeriodSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await noticePeriodService.applyNoticePeriod(
    organizationId,
    userId,
    parsed.body,
    files
  );

  return SuccessResponse(res, "Resignation application submitted successfully", result, statusCode.Created);
});

/**
 * Controller: Get personal notice period / resignation status
 */
export const getMyNoticePeriods = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication and Organization context required", statusCode.Forbidden);
  }

  const result = await noticePeriodService.getMyNoticePeriods(organizationId, userId);
  return SuccessResponse(res, "Your notice period records retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get all notice periods (Admin / HR)
 */
export const getAllNoticePeriods = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getNoticePeriodsQuerySchema.parse({ query: req.query });
  const result = await noticePeriodService.getAllNoticePeriods(organizationId, parsed.query);

  return SuccessResponse(res, "Notice period records retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single notice period by ID
 */
export const getNoticePeriodById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = noticePeriodIdParamSchema.parse({ params: req.params });
  const result = await noticePeriodService.getNoticePeriodById(params.id, organizationId);

  return SuccessResponse(res, "Notice period details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Approve resignation & notice period
 */
export const approveNoticePeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = approveNoticePeriodSchema.parse({ params: req.params, body: req.body });
  const result = await noticePeriodService.approveNoticePeriod(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body
  );

  return SuccessResponse(res, "Notice period approved successfully", result, statusCode.OK);
});

/**
 * Controller: Reject resignation request
 */
export const rejectNoticePeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = rejectNoticePeriodSchema.parse({ params: req.params, body: req.body });
  const result = await noticePeriodService.rejectNoticePeriod(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body
  );

  return SuccessResponse(res, "Notice period request rejected", result, statusCode.OK);
});

/**
 * Controller: Withdraw resignation application
 */
export const withdrawNoticePeriod = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const { params } = noticePeriodIdParamSchema.parse({ params: req.params });
  const result = await noticePeriodService.withdrawNoticePeriod(params.id, organizationId, userId);

  return SuccessResponse(res, "Resignation withdrawn successfully", result, statusCode.OK);
});

/**
 * Controller: Configure / Approve notice buyout
 */
export const updateNoticeBuyout = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = updateNoticeBuyoutSchema.parse({ params: req.params, body: req.body });
  const result = await noticePeriodService.updateNoticeBuyout(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body
  );

  return SuccessResponse(res, "Notice buyout updated successfully", result, statusCode.OK);
});

/**
 * Controller: Update handover & clearance progress
 */
export const updateHandover = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = updateHandoverSchema.parse({ params: req.params, body: req.body });
  const result = await noticePeriodService.updateHandover(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body
  );

  return SuccessResponse(res, "Handover and clearance status updated successfully", result, statusCode.OK);
});

/**
 * Controller: Finalize Full & Final settlement and terminate employee
 */
export const completeSettlement = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const parsed = completeSettlementSchema.parse({ params: req.params, body: req.body });
  const result = await noticePeriodService.completeSettlement(
    parsed.params.id,
    organizationId,
    userId,
    parsed.body
  );

  return SuccessResponse(res, result.message, result.noticePeriod, statusCode.OK);
});

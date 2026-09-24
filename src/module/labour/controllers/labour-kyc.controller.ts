import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourKycService } from "../services/labour-kyc.service.js";
import {
  upsertLabourKycSchema,
  verifyLabourKycSchema,
  deleteKycDocParamSchema,
} from "../validators/labour-kyc.validator.js";
import { labourIdParamSchema } from "../validators/labour.validator.js";

/**
 * @route   GET /api/v1/labour/:id/kyc
 * @desc    Fetch KYC documents, bank details, and verification status for a worker
 * @access  Private (Authenticated Tenant User)
 */
export const getLabourKyc = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = labourIdParamSchema.parse({ params: req.params });
  const result = await labourKycService.getKycDetails(parsed.params.id, organizationId);
  return SuccessResponse(res, "Labour KYC details retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/:id/kyc
 * @desc    Upload / update KYC documents and bank details (automatically deletes old cloud files upon update)
 * @access  Private (Authenticated Tenant User)
 */
export const upsertLabourKyc = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = upsertLabourKycSchema.parse({ params: req.params, body: req.body });
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const result = await labourKycService.upsertKyc(
    parsed.params.id,
    organizationId,
    parsed.body,
    files
  );
  return SuccessResponse(res, "Labour KYC documents updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/:id/kyc/verify
 * @desc    Review and verify KYC status (Approved / Rejected / Under Review)
 * @access  Private (Authenticated Tenant User / Supervisor)
 */
export const verifyLabourKyc = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = verifyLabourKycSchema.parse({ params: req.params, body: req.body });
  const result = await labourKycService.verifyKyc(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Labour KYC status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/:id/kyc/documents/:docType
 * @desc    Delete a specific KYC document from cloud storage and database
 * @access  Private (Authenticated Tenant User)
 */
export const deleteLabourKycDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = deleteKycDocParamSchema.parse({ params: req.params });
  await labourKycService.deleteKycDocument(
    parsed.params.id,
    organizationId,
    parsed.params.docType
  );
  return SuccessResponse(
    res,
    `KYC document ${parsed.params.docType} deleted successfully from cloud storage and database`,
    null,
    statusCode.OK
  );
});

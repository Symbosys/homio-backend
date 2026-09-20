import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { leadDocumentService } from "../services/lead-document.service.js";
import {
  uploadLeadDocumentSchema,
  documentIdParamSchema,
} from "../validators/lead-document.validator.js";
import { leadIdParamSchema } from "../validators/lead.validator.js";

/**
 * Controller: Upload Document to Lead
 */
export const uploadLeadDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.file) {
    throw new ErrorResponse("Please attach a document file to upload", statusCode.Bad_Request);
  }

  const parsed = uploadLeadDocumentSchema.parse({ params: req.params, body: req.body });
  const result = await leadDocumentService.uploadDocument(
    organizationId,
    parsed.params.id,
    parsed.body,
    req.file,
    req.user?.id
  );
  return SuccessResponse(res, "Lead document uploaded successfully", result, statusCode.Created);
});

/**
 * Controller: Get all documents for a Lead
 */
export const getLeadDocuments = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = leadIdParamSchema.parse({ params: req.params });
  const result = await leadDocumentService.getDocumentsByLeadId(
    parsed.params.id,
    organizationId
  );
  return SuccessResponse(res, "Lead documents retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Delete Lead Document
 */
export const deleteLeadDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = documentIdParamSchema.parse({ params: req.params });
  const result = await leadDocumentService.deleteDocument(parsed.params.id, organizationId);
  return SuccessResponse(res, "Document deleted successfully", result, statusCode.OK);
});

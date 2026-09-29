import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { projectBillingService } from "../services/project-billing.service.js";
import {
  createProjectBillSchema,
  updateProjectBillSchema,
  updateProjectBillStatusSchema,
  getProjectBillsQuerySchema,
  billIdParamSchema,
  createProjectPaymentRecordSchema,
  updateProjectPaymentRecordSchema,
  getProjectPaymentRecordsQuerySchema,
  paymentRecordIdParamSchema,
  getProjectCommercialSummaryQuerySchema,
} from "../validators/project-billing.validator.js";

// =============================================================================
// 1. PROJECT BILL CONTROLLER ENDPOINTS
// =============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/bills or POST /api/v1/projects/bills
 * @desc    Create a new Project Bill (MATERIAL, LABOUR, DESIGN, SUPERVISION) with optional embedded file uploads
 * @access  Private (Authenticated Tenant User)
 */
export const createProjectBill = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createProjectBillSchema.parse({ params: req.params, body: req.body });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const payload = {
    ...parsed.body,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const result = await projectBillingService.createBill(organizationId, payload, files);
  return SuccessResponse(res, "Project bill created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/:projectId/bills or GET /api/v1/projects/bills
 * @desc    Fetch paginated list of Project Bills with search and filters
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectBills = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getProjectBillsQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await projectBillingService.getBills(organizationId, query);
  return SuccessResponse(res, "Project bills retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/bills/:id
 * @desc    Fetch single Project Bill details
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectBillById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { params } = billIdParamSchema.parse({ params: req.params });
  const result = await projectBillingService.getBillById(params.id, organizationId);
  return SuccessResponse(res, "Project bill retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/bills/:id
 * @desc    Update a Project Bill (Rule 5: Dirty updates & auto-prunes replaced media)
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectBill = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectBillSchema.parse({ params: req.params, body: req.body });
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const result = await projectBillingService.updateBill(
    parsed.params.id,
    organizationId,
    parsed.body,
    files
  );
  return SuccessResponse(res, "Project bill updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/bills/:id/status
 * @desc    Transition Project Bill Status
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectBillStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectBillStatusSchema.parse({ params: req.params, body: req.body });
  const result = await projectBillingService.updateBillStatus(
    parsed.params.id,
    organizationId,
    parsed.body.status,
    parsed.body.notes
  );
  return SuccessResponse(res, "Project bill status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/bills/:id
 * @desc    Soft delete a Project Bill (Auto-prunes cloud documents per Rule 4)
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProjectBill = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { params } = billIdParamSchema.parse({ params: req.params });
  const result = await projectBillingService.deleteBill(params.id, organizationId);
  return SuccessResponse(res, "Project bill deleted successfully", result, statusCode.OK);
});

// =============================================================================
// 2. PROJECT PAYMENT RECORD CONTROLLER ENDPOINTS
// =============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/payment-records or POST /api/v1/projects/payment-records
 * @desc    Record a new payment transaction against a project or bill with optional embedded receipt upload
 * @access  Private (Authenticated Tenant User)
 */
export const createProjectPaymentRecord = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createProjectPaymentRecordSchema.parse({ params: req.params, body: req.body });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const payload = {
    ...parsed.body,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const result = await projectBillingService.createPaymentRecord(organizationId, payload, files);
  return SuccessResponse(
    res,
    "Project payment record created successfully",
    result,
    statusCode.Created
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/payment-records or GET /api/v1/projects/payment-records
 * @desc    Fetch paginated list of Project Payment Records
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectPaymentRecords = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getProjectPaymentRecordsQuerySchema.parse({ query: req.query });
  const paramProjectId = typeof req.params?.projectId === "string" ? req.params.projectId : undefined;
  const query = {
    ...parsedQuery.query,
    ...(paramProjectId && { projectId: paramProjectId }),
  };

  const result = await projectBillingService.getPaymentRecords(organizationId, query);
  return SuccessResponse(
    res,
    "Project payment records retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   GET /api/v1/projects/payment-records/:id
 * @desc    Fetch details of a single Project Payment Record
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectPaymentRecordById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { params } = paymentRecordIdParamSchema.parse({ params: req.params });
  const result = await projectBillingService.getPaymentRecordById(params.id, organizationId);
  return SuccessResponse(
    res,
    "Project payment record retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   PATCH /api/v1/projects/payment-records/:id
 * @desc    Update a Project Payment Record (Auto-prunes replaced vouchers per Rule 4)
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectPaymentRecord = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectPaymentRecordSchema.parse({ params: req.params, body: req.body });
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  const result = await projectBillingService.updatePaymentRecord(
    parsed.params.id,
    organizationId,
    parsed.body,
    files
  );
  return SuccessResponse(
    res,
    "Project payment record updated successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   DELETE /api/v1/projects/payment-records/:id
 * @desc    Soft delete a Project Payment Record, rebalance linked bill dues, and prune vouchers
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProjectPaymentRecord = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { params } = paymentRecordIdParamSchema.parse({ params: req.params });
  const result = await projectBillingService.deletePaymentRecord(params.id, organizationId);
  return SuccessResponse(
    res,
    "Project payment record deleted and dues rebalanced successfully",
    result,
    statusCode.OK
  );
});

// =============================================================================
// 3. PROJECT COMMERCIAL SUMMARY
// =============================================================================

/**
 * @route   GET /api/v1/projects/:projectId/commercial-summary or GET /api/v1/projects/commercial-summary
 * @desc    Get commercial summary calculations across disciplines, margins, and commissions
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectCommercialSummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getProjectCommercialSummaryQuerySchema.parse({
    params: req.params,
    query: req.query,
  });

  const projectId = (req.params?.projectId || parsedQuery.query.projectId) as string;
  if (!projectId) {
    throw new ErrorResponse("Project ID parameter is required", statusCode.Bad_Request);
  }

  const result = await projectBillingService.getCommercialSummary(
    projectId,
    organizationId,
    parsedQuery.query
  );

  return SuccessResponse(
    res,
    "Project commercial summary calculated successfully",
    result,
    statusCode.OK
  );
});

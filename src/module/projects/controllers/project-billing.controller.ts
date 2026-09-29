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
 * @desc    Create a new Project Bill (MATERIAL, LABOUR, DESIGN, SUPERVISION)
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

  const result = await projectBillingService.createBill(organizationId, payload);
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
 * @desc    Update a Project Bill (Rule 5: Dirty updates & auto-prunes media)
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectBill = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectBillSchema.parse({ params: req.params, body: req.body });
  const result = await projectBillingService.updateBill(
    parsed.params.id,
    organizationId,
    parsed.body
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
 * @desc    Soft delete a Project Bill (Auto-prunes cloud documents)
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

/**
 * @route   POST /api/v1/projects/bills/upload
 * @desc    Upload bill invoice / attachment to cloud storage
 * @access  Private (Authenticated Tenant User)
 */
export const uploadProjectBillDocument = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ErrorResponse("No file uploaded", statusCode.Bad_Request);
  }

  const folder = `homio/organizations/${req.user?.organizationId || "shared"}/project-bills`;
  const result = await projectBillingService.uploadToCloud(file, folder, "auto");
  return SuccessResponse(res, "Bill document uploaded successfully", result, statusCode.OK);
});

// =============================================================================
// 2. PROJECT PAYMENT RECORD CONTROLLER ENDPOINTS
// =============================================================================

/**
 * @route   POST /api/v1/projects/:projectId/payment-records or POST /api/v1/projects/payment-records
 * @desc    Record a new payment transaction against a project or bill
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

  const result = await projectBillingService.createPaymentRecord(organizationId, payload);
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
 * @desc    Update a Project Payment Record and rebalance linked bill
 * @access  Private (Authenticated Tenant User)
 */
export const updateProjectPaymentRecord = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProjectPaymentRecordSchema.parse({ params: req.params, body: req.body });
  const result = await projectBillingService.updatePaymentRecord(
    parsed.params.id,
    organizationId,
    parsed.body
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
 * @desc    Soft delete a Project Payment Record and rebalance linked bill
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
    "Project payment record deleted successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   POST /api/v1/projects/payment-records/upload
 * @desc    Upload payment receipt / counterfoil to cloud storage
 * @access  Private (Authenticated Tenant User)
 */
export const uploadProjectPaymentReceipt = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new ErrorResponse("No file uploaded", statusCode.Bad_Request);
  }

  const folder = `homio/organizations/${req.user?.organizationId || "shared"}/project-payments`;
  const result = await projectBillingService.uploadToCloud(file, folder, "auto");
  return SuccessResponse(res, "Payment receipt uploaded successfully", result, statusCode.OK);
});

// =============================================================================
// 3. COMMERCIAL SUMMARY ANALYTICS CONTROLLER
// =============================================================================

/**
 * @route   GET /api/v1/projects/:projectId/commercials/summary
 * @desc    Fetch commercial summary analytics (Material, Labour, Design, Supervision totals)
 * @access  Private (Authenticated Tenant User)
 */
export const getProjectCommercialSummary = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const paramProjectId = req.params?.projectId;
  const paramId = req.params?.id;
  const projectId = typeof paramProjectId === "string" ? paramProjectId : typeof paramId === "string" ? paramId : "";
  if (!projectId) {
    throw new ErrorResponse("Project ID parameter required", statusCode.Bad_Request);
  }

  const parsedQuery = getProjectCommercialSummaryQuerySchema.parse({ query: req.query });
  const result = await projectBillingService.getCommercialSummary(
    organizationId,
    projectId,
    parsedQuery.query
  );
  return SuccessResponse(
    res,
    "Commercial summary retrieved successfully",
    result,
    statusCode.OK
  );
});

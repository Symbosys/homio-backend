import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { customerService } from "../services/customer.service.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  togglePortalAccessSchema,
  customerIdParamSchema,
  getCustomersQuerySchema,
} from "../validators/customer.validator.js";
import {
  createCustomerActivitySchema,
} from "../validators/lead-activity.validator.js";
import {
  uploadCustomerDocumentSchema,
  documentIdParamSchema,
} from "../validators/lead-document.validator.js";

/**
 * Controller: Create Customer (Tenant-Scoped)
 */
export const createCustomer = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createCustomerSchema.parse({ body: req.body });
  const result = await customerService.createCustomer(organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Customer created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all customers with pagination and filtering
 */
export const getCustomers = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getCustomersQuerySchema.parse({ query: req.query });
  const result = await customerService.getCustomers(organizationId, parsed.query);
  return SuccessResponse(res, "Customers retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get Customer by ID
 */
export const getCustomerById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = customerIdParamSchema.parse({ params: req.params });
  const result = await customerService.getCustomerById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Customer details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update Customer details
 */
export const updateCustomer = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateCustomerSchema.parse({ params: req.params, body: req.body });
  const result = await customerService.updateCustomer(parsed.params.id, organizationId, parsed.body, req.file);
  return SuccessResponse(res, "Customer updated successfully", result, statusCode.OK);
});

/**
 * Controller: Toggle Customer Portal Access
 */
export const toggleCustomerPortalAccess = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = togglePortalAccessSchema.parse({ params: req.params, body: req.body });
  const result = await customerService.togglePortalAccess(
    parsed.params.id,
    organizationId,
    parsed.body.portalAccessEnabled
  );
  return SuccessResponse(res, "Portal access updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete Customer
 */
export const deleteCustomer = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = customerIdParamSchema.parse({ params: req.params });
  const result = await customerService.deleteCustomer(parsed.params.id, organizationId);
  return SuccessResponse(res, "Customer deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Add Customer Activity log
 */
export const addCustomerActivity = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createCustomerActivitySchema.parse({ params: req.params, body: req.body });
  const result = await customerService.addCustomerActivity(
    organizationId,
    parsed.params.id,
    parsed.body
  );
  return SuccessResponse(res, "Customer activity logged successfully", result, statusCode.Created);
});

/**
 * Controller: Upload Customer Document
 */
export const uploadCustomerDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.file) {
    throw new ErrorResponse("Please attach a document file to upload", statusCode.Bad_Request);
  }

  const parsed = uploadCustomerDocumentSchema.parse({ params: req.params, body: req.body });
  const result = await customerService.uploadCustomerDocument(
    organizationId,
    parsed.params.id,
    parsed.body,
    req.file,
    req.user?.id
  );
  return SuccessResponse(res, "Customer document uploaded successfully", result, statusCode.Created);
});

/**
 * Controller: Delete Customer Document
 */
export const deleteCustomerDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = documentIdParamSchema.parse({ params: req.params });
  const result = await customerService.deleteCustomerDocument(parsed.params.id, organizationId);
  return SuccessResponse(res, "Customer document deleted successfully", result, statusCode.OK);
});

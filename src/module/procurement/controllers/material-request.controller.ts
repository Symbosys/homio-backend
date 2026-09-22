import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { materialRequestService } from "../services/material-request.service.js";
import {
  createMaterialRequestSchema,
  updateMaterialRequestSchema,
  getMaterialRequestsQuerySchema,
  materialRequestIdParamSchema,
  updateMaterialRequestStatusSchema,
  createMaterialRequestItemSchema,
  updateMaterialRequestItemSchema,
  materialRequestItemParamSchema,
} from "../validators/material-request.validator.js";

/**
 * @controller  createMaterialRequest
 * @desc        Create a new site material requisition (MR) with initial line items
 * @access      Private (Org Admin / PM)
 */
export const createMaterialRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const body = createMaterialRequestSchema.parse(req.body);
  const result = await materialRequestService.createMaterialRequest(organizationId, {
    ...body,
    requestedById: body.requestedById || req.user?.id,
  });

  return SuccessResponse(res, "Material request created successfully", result, statusCode.Created);
});

/**
 * @controller  getMaterialRequests
 * @desc        Fetch paginated list of material requests with filters
 * @access      Private
 */
export const getMaterialRequests = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const query = getMaterialRequestsQuerySchema.parse(req.query);
  const result = await materialRequestService.getMaterialRequests(organizationId, query);

  return SuccessResponse(res, "Material requests fetched successfully", result, statusCode.OK);
});

/**
 * @controller  getMaterialRequestById
 * @desc        Fetch single material request details including line items and stakeholders
 * @access      Private
 */
export const getMaterialRequestById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialRequestIdParamSchema.parse(req.params);
  const result = await materialRequestService.getMaterialRequestById(id, organizationId);

  return SuccessResponse(res, "Material request fetched successfully", result, statusCode.OK);
});

/**
 * @controller  updateMaterialRequest
 * @desc        Update material request header fields
 * @access      Private
 */
export const updateMaterialRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialRequestIdParamSchema.parse(req.params);
  const body = updateMaterialRequestSchema.parse(req.body);
  const result = await materialRequestService.updateMaterialRequest(id, organizationId, body);

  return SuccessResponse(res, "Material request updated successfully", result, statusCode.OK);
});

/**
 * @controller  deleteMaterialRequest
 * @desc        Soft-delete a material request
 * @access      Private
 */
export const deleteMaterialRequest = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialRequestIdParamSchema.parse(req.params);
  await materialRequestService.deleteMaterialRequest(id, organizationId);

  return SuccessResponse(res, "Material request deleted successfully", null, statusCode.OK);
});

/**
 * @controller  updateMaterialRequestStatus
 * @desc        Transition status of material request (e.g. APPROVED, REJECTED, IN_PROCUREMENT)
 * @access      Private
 */
export const updateMaterialRequestStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialRequestIdParamSchema.parse(req.params);
  const body = updateMaterialRequestStatusSchema.parse(req.body);
  const result = await materialRequestService.updateStatus(id, organizationId, body, req.user?.id);

  return SuccessResponse(res, `Material request status updated to ${body.status}`, result, statusCode.OK);
});

/**
 * @controller  addMaterialRequestItem
 * @desc        Add a line item to an existing material request
 * @access      Private
 */
export const addMaterialRequestItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id: requestId } = materialRequestIdParamSchema.parse(req.params);
  const body = createMaterialRequestItemSchema.parse(req.body);
  const result = await materialRequestService.addItem(requestId, organizationId, body);

  return SuccessResponse(res, "Item added to material request successfully", result, statusCode.Created);
});

/**
 * @controller  updateMaterialRequestItem
 * @desc        Update a line item in a material request
 * @access      Private
 */
export const updateMaterialRequestItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { requestId, itemId } = materialRequestItemParamSchema.parse(req.params);
  const body = updateMaterialRequestItemSchema.parse(req.body);
  const result = await materialRequestService.updateItem(itemId, requestId, organizationId, body);

  return SuccessResponse(res, "Material request item updated successfully", result, statusCode.OK);
});

/**
 * @controller  removeMaterialRequestItem
 * @desc        Remove a line item from a material request
 * @access      Private
 */
export const removeMaterialRequestItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { requestId, itemId } = materialRequestItemParamSchema.parse(req.params);
  await materialRequestService.removeItem(itemId, requestId, organizationId);

  return SuccessResponse(res, "Material request item removed successfully", null, statusCode.OK);
});

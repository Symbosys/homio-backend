import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { materialDispatchService } from "../services/material-dispatch.service.js";
import {
  createMaterialDispatchSchema,
  updateMaterialDispatchSchema,
  getMaterialDispatchesQuerySchema,
  materialDispatchIdParamSchema,
  updateMaterialDispatchStatusSchema,
  createDispatchItemSchema,
  updateDispatchItemSchema,
  dispatchItemParamSchema,
  bulkReceiveDispatchSchema,
} from "../validators/material-dispatch.validator.js";

/**
 * @controller  createMaterialDispatch
 * @desc        Create a new consignment dispatch record
 * @access      Private
 */
export const createMaterialDispatch = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const body = createMaterialDispatchSchema.parse(req.body);
  const result = await materialDispatchService.createMaterialDispatch(
    organizationId,
    body,
    req.user?.id
  );

  return SuccessResponse(res, "Material dispatch created successfully", result, statusCode.Created);
});

/**
 * @controller  getMaterialDispatches
 * @desc        Fetch paginated list of material dispatches with logistics filters
 * @access      Private
 */
export const getMaterialDispatches = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const query = getMaterialDispatchesQuerySchema.parse(req.query);
  const result = await materialDispatchService.getMaterialDispatches(organizationId, query);

  return SuccessResponse(res, "Material dispatches fetched successfully", result, statusCode.OK);
});

/**
 * @controller  getMaterialDispatchById
 * @desc        Fetch single dispatch details with all items and transporter info
 * @access      Private
 */
export const getMaterialDispatchById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialDispatchIdParamSchema.parse(req.params);
  const result = await materialDispatchService.getMaterialDispatchById(id, organizationId);

  return SuccessResponse(res, "Material dispatch fetched successfully", result, statusCode.OK);
});

/**
 * @controller  updateMaterialDispatch
 * @desc        Update dispatch header details
 * @access      Private
 */
export const updateMaterialDispatch = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialDispatchIdParamSchema.parse(req.params);
  const body = updateMaterialDispatchSchema.parse(req.body);
  const result = await materialDispatchService.updateMaterialDispatch(id, organizationId, body);

  return SuccessResponse(res, "Material dispatch updated successfully", result, statusCode.OK);
});

/**
 * @controller  deleteMaterialDispatch
 * @desc        Soft-delete a dispatch record
 * @access      Private
 */
export const deleteMaterialDispatch = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialDispatchIdParamSchema.parse(req.params);
  await materialDispatchService.deleteMaterialDispatch(id, organizationId);

  return SuccessResponse(res, "Material dispatch deleted successfully", null, statusCode.OK);
});

/**
 * @controller  updateMaterialDispatchStatus
 * @desc        Transition dispatch status (e.g. IN_TRANSIT, DELIVERED, RECEIVED, REJECTED)
 * @access      Private
 */
export const updateMaterialDispatchStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialDispatchIdParamSchema.parse(req.params);
  const body = updateMaterialDispatchStatusSchema.parse(req.body);
  const result = await materialDispatchService.updateStatus(id, organizationId, body);

  return SuccessResponse(res, `Dispatch status updated to ${body.status}`, result, statusCode.OK);
});

/**
 * @controller  bulkReceiveDispatch
 * @desc        Bulk site receipt: verify received/accepted/rejected quantities and QA condition
 * @access      Private
 */
export const bulkReceiveDispatch = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialDispatchIdParamSchema.parse(req.params);
  const body = bulkReceiveDispatchSchema.parse(req.body);
  const result = await materialDispatchService.bulkReceive(
    id,
    organizationId,
    body,
    req.user?.id
  );

  return SuccessResponse(res, "Consignment items verified and received successfully", result, statusCode.OK);
});

/**
 * @controller  uploadDispatchSignature
 * @desc        Upload site supervisor signature and proof of delivery images
 * @access      Private
 */
export const uploadDispatchSignature = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = materialDispatchIdParamSchema.parse(req.params);
  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

  const result = await materialDispatchService.uploadSignatureAndProof(
    id,
    organizationId,
    {
      signature: files?.["signature"],
      proof: files?.["proof"],
    },
    req.body?.notes
  );

  return SuccessResponse(res, "Signature and delivery proof uploaded successfully", result, statusCode.OK);
});

// ==========================================
// Dispatch Items
// ==========================================

/**
 * @controller  addDispatchItem
 * @desc        Add a line item to a dispatch
 * @access      Private
 */
export const addDispatchItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id: dispatchId } = materialDispatchIdParamSchema.parse(req.params);
  const body = createDispatchItemSchema.parse(req.body);
  const result = await materialDispatchService.addItem(dispatchId, organizationId, body);

  return SuccessResponse(res, "Item added to dispatch successfully", result, statusCode.Created);
});

/**
 * @controller  updateDispatchItem
 * @desc        Update an individual dispatch item
 * @access      Private
 */
export const updateDispatchItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { dispatchId, itemId } = dispatchItemParamSchema.parse(req.params);
  const body = updateDispatchItemSchema.parse(req.body);
  const result = await materialDispatchService.updateItem(itemId, dispatchId, organizationId, body);

  return SuccessResponse(res, "Dispatch item updated successfully", result, statusCode.OK);
});

/**
 * @controller  removeDispatchItem
 * @desc        Remove an item from a dispatch
 * @access      Private
 */
export const removeDispatchItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { dispatchId, itemId } = dispatchItemParamSchema.parse(req.params);
  await materialDispatchService.removeItem(itemId, dispatchId, organizationId);

  return SuccessResponse(res, "Dispatch item removed successfully", null, statusCode.OK);
});

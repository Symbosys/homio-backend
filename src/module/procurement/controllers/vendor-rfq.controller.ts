import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { vendorRfqService } from "../services/vendor-rfq.service.js";
import {
  createVendorRfqSchema,
  updateVendorRfqSchema,
  getVendorRfqsQuerySchema,
  vendorRfqIdParamSchema,
  updateVendorRfqStatusSchema,
  createRfqItemSchema,
  updateRfqItemSchema,
  rfqItemParamSchema,
  createRfqInviteSchema,
  updateRfqInviteSchema,
  rfqInviteParamSchema,
} from "../validators/vendor-rfq.validator.js";

/**
 * @controller  createVendorRfq
 * @desc        Create a new RFQ with items and vendor invites for a project
 * @access      Private
 */
export const createVendorRfq = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const body = createVendorRfqSchema.parse(req.body);
  const result = await vendorRfqService.createVendorRfq(organizationId, body, req.user?.id);

  return SuccessResponse(res, "Vendor RFQ created successfully", result, statusCode.Created);
});

/**
 * @controller  getVendorRfqs
 * @desc        Fetch paginated list of RFQs with filters
 * @access      Private
 */
export const getVendorRfqs = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const query = getVendorRfqsQuerySchema.parse(req.query);
  const result = await vendorRfqService.getVendorRfqs(organizationId, query);

  return SuccessResponse(res, "Vendor RFQs fetched successfully", result, statusCode.OK);
});

/**
 * @controller  getVendorRfqById
 * @desc        Fetch single RFQ with items, invites, and bids
 * @access      Private
 */
export const getVendorRfqById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorRfqIdParamSchema.parse(req.params);
  const result = await vendorRfqService.getVendorRfqById(id, organizationId);

  return SuccessResponse(res, "Vendor RFQ fetched successfully", result, statusCode.OK);
});

/**
 * @controller  updateVendorRfq
 * @desc        Update RFQ header details
 * @access      Private
 */
export const updateVendorRfq = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorRfqIdParamSchema.parse(req.params);
  const body = updateVendorRfqSchema.parse(req.body);
  const result = await vendorRfqService.updateVendorRfq(id, organizationId, body);

  return SuccessResponse(res, "Vendor RFQ updated successfully", result, statusCode.OK);
});

/**
 * @controller  deleteVendorRfq
 * @desc        Soft-delete an RFQ
 * @access      Private
 */
export const deleteVendorRfq = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorRfqIdParamSchema.parse(req.params);
  await vendorRfqService.deleteVendorRfq(id, organizationId);

  return SuccessResponse(res, "Vendor RFQ deleted successfully", null, statusCode.OK);
});

/**
 * @controller  updateVendorRfqStatus
 * @desc        Transition RFQ status (e.g. SENT, RESPONSES_RECEIVED, CLOSED)
 * @access      Private
 */
export const updateVendorRfqStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorRfqIdParamSchema.parse(req.params);
  const body = updateVendorRfqStatusSchema.parse(req.body);
  const result = await vendorRfqService.updateStatus(id, organizationId, body);

  return SuccessResponse(res, `RFQ status updated to ${body.status}`, result, statusCode.OK);
});

// ==========================================
// RFQ Items
// ==========================================

/**
 * @controller  addRfqItem
 * @desc        Add a requested item to an RFQ
 * @access      Private
 */
export const addRfqItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id: rfqId } = vendorRfqIdParamSchema.parse(req.params);
  const body = createRfqItemSchema.parse(req.body);
  const result = await vendorRfqService.addItem(rfqId, organizationId, body);

  return SuccessResponse(res, "Item added to RFQ successfully", result, statusCode.Created);
});

/**
 * @controller  updateRfqItem
 * @desc        Update an RFQ item
 * @access      Private
 */
export const updateRfqItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { rfqId, itemId } = rfqItemParamSchema.parse(req.params);
  const body = updateRfqItemSchema.parse(req.body);
  const result = await vendorRfqService.updateItem(itemId, rfqId, organizationId, body);

  return SuccessResponse(res, "RFQ item updated successfully", result, statusCode.OK);
});

/**
 * @controller  removeRfqItem
 * @desc        Remove an item from an RFQ
 * @access      Private
 */
export const removeRfqItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { rfqId, itemId } = rfqItemParamSchema.parse(req.params);
  await vendorRfqService.removeItem(itemId, rfqId, organizationId);

  return SuccessResponse(res, "RFQ item removed successfully", null, statusCode.OK);
});

// ==========================================
// RFQ Invites
// ==========================================

/**
 * @controller  inviteVendor
 * @desc        Invite a vendor to submit a bid for the RFQ
 * @access      Private
 */
export const inviteVendor = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id: rfqId } = vendorRfqIdParamSchema.parse(req.params);
  const body = createRfqInviteSchema.parse(req.body);
  const result = await vendorRfqService.inviteVendor(rfqId, organizationId, body);

  return SuccessResponse(res, "Vendor invited to RFQ successfully", result, statusCode.Created);
});

/**
 * @controller  getRfqInvites
 * @desc        List all invited vendors for an RFQ
 * @access      Private
 */
export const getRfqInvites = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id: rfqId } = vendorRfqIdParamSchema.parse(req.params);
  const result = await vendorRfqService.getInvites(rfqId, organizationId);

  return SuccessResponse(res, "RFQ invites fetched successfully", result, statusCode.OK);
});

/**
 * @controller  updateRfqInvite
 * @desc        Update vendor invite status (e.g. VIEWED, RESPONDED, DECLINED)
 * @access      Private
 */
export const updateRfqInvite = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { rfqId, inviteId } = rfqInviteParamSchema.parse(req.params);
  const body = updateRfqInviteSchema.parse(req.body);
  const result = await vendorRfqService.updateInvite(inviteId, rfqId, organizationId, body);

  return SuccessResponse(res, "RFQ invite updated successfully", result, statusCode.OK);
});

/**
 * @controller  removeRfqInvite
 * @desc        Remove a vendor invite from an RFQ
 * @access      Private
 */
export const removeRfqInvite = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { rfqId, inviteId } = rfqInviteParamSchema.parse(req.params);
  await vendorRfqService.removeInvite(inviteId, rfqId, organizationId);

  return SuccessResponse(res, "RFQ invite removed successfully", null, statusCode.OK);
});

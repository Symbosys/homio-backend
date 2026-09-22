import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { vendorQuotationService } from "../services/vendor-quotation.service.js";
import {
  createVendorQuotationSchema,
  updateVendorQuotationSchema,
  getVendorQuotationsQuerySchema,
  vendorQuotationIdParamSchema,
  updateVendorQuotationStatusSchema,
  createQuotationItemSchema,
  updateQuotationItemSchema,
  quotationItemParamSchema,
  compareQuotationsQuerySchema,
} from "../validators/vendor-quotation.validator.js";

/**
 * @controller  createVendorQuotation
 * @desc        Create/record a vendor quote or bid for a project / RFQ
 * @access      Private
 */
export const createVendorQuotation = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const body = createVendorQuotationSchema.parse(req.body);
  const result = await vendorQuotationService.createVendorQuotation(
    organizationId,
    body,
    req.file,
    req.user?.id
  );

  return SuccessResponse(res, "Vendor quotation created successfully", result, statusCode.Created);
});

/**
 * @controller  getVendorQuotations
 * @desc        Fetch paginated list of vendor quotations with filters
 * @access      Private
 */
export const getVendorQuotations = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const query = getVendorQuotationsQuerySchema.parse(req.query);
  const result = await vendorQuotationService.getVendorQuotations(organizationId, query);

  return SuccessResponse(res, "Vendor quotations fetched successfully", result, statusCode.OK);
});

/**
 * @controller  getVendorQuotationById
 * @desc        Fetch single quotation details including line items and vendor info
 * @access      Private
 */
export const getVendorQuotationById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorQuotationIdParamSchema.parse(req.params);
  const result = await vendorQuotationService.getVendorQuotationById(id, organizationId);

  return SuccessResponse(res, "Vendor quotation fetched successfully", result, statusCode.OK);
});

/**
 * @controller  compareQuotations
 * @desc        Compare quotations side-by-side for a specific RFQ
 * @access      Private
 */
export const compareQuotations = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { rfqId } = compareQuotationsQuerySchema.parse(req.query);
  const result = await vendorQuotationService.compareQuotations(rfqId, organizationId);

  return SuccessResponse(res, "Quotation comparison data fetched successfully", result, statusCode.OK);
});

/**
 * @controller  updateVendorQuotation
 * @desc        Update quotation header details
 * @access      Private
 */
export const updateVendorQuotation = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorQuotationIdParamSchema.parse(req.params);
  const body = updateVendorQuotationSchema.parse(req.body);
  const result = await vendorQuotationService.updateVendorQuotation(
    id,
    organizationId,
    body,
    req.file
  );

  return SuccessResponse(res, "Vendor quotation updated successfully", result, statusCode.OK);
});

/**
 * @controller  deleteVendorQuotation
 * @desc        Soft-delete a quotation
 * @access      Private
 */
export const deleteVendorQuotation = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorQuotationIdParamSchema.parse(req.params);
  await vendorQuotationService.deleteVendorQuotation(id, organizationId);

  return SuccessResponse(res, "Vendor quotation deleted successfully", null, statusCode.OK);
});

/**
 * @controller  updateVendorQuotationStatus
 * @desc        Transition quotation status (e.g. ACCEPTED, REJECTED, SHORTLISTED)
 * @access      Private
 */
export const updateVendorQuotationStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id } = vendorQuotationIdParamSchema.parse(req.params);
  const body = updateVendorQuotationStatusSchema.parse(req.body);
  const result = await vendorQuotationService.updateStatus(
    id,
    organizationId,
    body,
    req.user?.id
  );

  return SuccessResponse(res, `Quotation status updated to ${body.status}`, result, statusCode.OK);
});

// ==========================================
// Quotation Items
// ==========================================

/**
 * @controller  addQuotationItem
 * @desc        Add a line item to a quotation
 * @access      Private
 */
export const addQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { id: quotationId } = vendorQuotationIdParamSchema.parse(req.params);
  const body = createQuotationItemSchema.parse(req.body);
  const result = await vendorQuotationService.addItem(quotationId, organizationId, body);

  return SuccessResponse(res, "Item added to quotation successfully", result, statusCode.Created);
});

/**
 * @controller  updateQuotationItem
 * @desc        Update a line item in a quotation
 * @access      Private
 */
export const updateQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { quotationId, itemId } = quotationItemParamSchema.parse(req.params);
  const body = updateQuotationItemSchema.parse(req.body);
  const result = await vendorQuotationService.updateItem(itemId, quotationId, organizationId, body);

  return SuccessResponse(res, "Quotation item updated successfully", result, statusCode.OK);
});

/**
 * @controller  removeQuotationItem
 * @desc        Remove a line item from a quotation
 * @access      Private
 */
export const removeQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context is required", statusCode.Forbidden);
  }

  const { quotationId, itemId } = quotationItemParamSchema.parse(req.params);
  await vendorQuotationService.removeItem(itemId, quotationId, organizationId);

  return SuccessResponse(res, "Quotation item removed successfully", null, statusCode.OK);
});

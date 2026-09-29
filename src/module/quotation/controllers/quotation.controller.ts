import { asyncHandler } from "../../../middlewares/error.middleware.js";
import {
  SuccessResponse,
  ErrorResponse,
} from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { quotationService } from "../services/quotation.service.js";
import {
  CreateQuotationSchema,
  UpdateQuotationSchema,
  GetQuotationsQuerySchema,
  AdjustQuotationExpirySchema,
} from "../validators/quotation.validator.js";

/**
 * @route   POST /api/v1/quotations
 * @desc    Create a new Quotation proposal with nested rooms, line items, payment milestones, and PDF page assets
 * @access  Private (Authenticated Tenant User)
 */
export const createQuotation = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request
    );
  }

  const validatedInput = CreateQuotationSchema.parse(req.body);
  const result = await quotationService.createQuotation(
    organizationId,
    validatedInput
  );

  return SuccessResponse(
    res,
    "Quotation created successfully",
    result,
    statusCode.Created
  );
});

/**
 * @route   GET /api/v1/quotations
 * @desc    Fetch paginated list of quotations with comprehensive multi-criteria filters (search, status, type, lead, customer, discount expiry, totals)
 * @access  Private (Authenticated Tenant User)
 */
export const getQuotations = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request
    );
  }

  const validatedQuery = GetQuotationsQuerySchema.parse(req.query);
  const result = await quotationService.getQuotations(
    organizationId,
    validatedQuery
  );

  return SuccessResponse(
    res,
    "Quotations fetched successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   GET /api/v1/quotations/:id
 * @desc    Fetch a single quotation by ID with full nested spatial rooms, line items, milestones, and PDF presentation pages
 * @access  Private (Authenticated Tenant User)
 */
export const getQuotationById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request
    );
  }

  const quotationId = req.params.id as string;
  if (!quotationId || typeof quotationId !== "string") {
    throw new ErrorResponse(
      "Quotation ID parameter is required",
      statusCode.Bad_Request
    );
  }

  const result = await quotationService.getQuotationById(
    organizationId,
    quotationId
  );

  return SuccessResponse(
    res,
    "Quotation retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   PUT /api/v1/quotations/:id
 * @desc    Update an existing quotation proposal (all fields, rooms, line items, payment milestones, and PDF presentation pages)
 * @access  Private (Authenticated Tenant User)
 */
export const updateQuotation = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request
    );
  }

  const quotationId = req.params.id as string;
  if (!quotationId || typeof quotationId !== "string") {
    throw new ErrorResponse(
      "Quotation ID parameter is required",
      statusCode.Bad_Request
    );
  }

  const validatedInput = UpdateQuotationSchema.parse(req.body);
  const result = await quotationService.updateQuotation(
    organizationId,
    quotationId,
    validatedInput
  );

  return SuccessResponse(
    res,
    "Quotation updated successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   PATCH /api/v1/quotations/:id/expiry
 * @desc    Adjust or extend quotation discount expiry date (by +/- days or custom ISO date)
 * @access  Private (Authenticated Tenant User)
 */
export const adjustQuotationExpiry = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request
    );
  }

  const quotationId = req.params.id as string;
  if (!quotationId || typeof quotationId !== "string") {
    throw new ErrorResponse(
      "Quotation ID parameter is required",
      statusCode.Bad_Request
    );
  }

  const validatedInput = AdjustQuotationExpirySchema.parse(req.body);
  const result = await quotationService.adjustDiscountExpiry(
    organizationId,
    quotationId,
    validatedInput
  );

  return SuccessResponse(
    res,
    "Quotation discount expiry updated successfully",
    result,
    statusCode.OK
  );
});



import { asyncHandler } from "../../../middlewares/error.middleware.js";
import {
  SuccessResponse,
  ErrorResponse,
} from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { quotationItemMasterService } from "../services/quotation-item-master.service.js";
import {
  createQuotationItemSchema,
  updateQuotationItemSchema,
  getQuotationItemsQuerySchema,
  quotationItemIdParamSchema,
  quotationItemGalleryParamSchema,
  bulkCreateQuotationItemsSchema,
} from "../validators/quotation-item-master.validator.js";

/**
 * @route   POST /api/v1/quotation-master/items
 * @desc    Create a new item master record in the tenant catalog
 * @access  Private (Authenticated Tenant User)
 */
export const createQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = createQuotationItemSchema.parse({ body: req.body });
  const result = await quotationItemMasterService.createItem(
    organizationId,
    parsed.body,
  );
  return SuccessResponse(
    res,
    "Quotation item master created successfully",
    result,
    statusCode.Created,
  );
});

/**
 * @route   POST /api/v1/quotation-master/items/bulk-create
 * @desc    Bulk create/import catalog items
 * @access  Private (Authenticated Tenant User)
 */
export const bulkCreateQuotationItems = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = bulkCreateQuotationItemsSchema.parse({ body: req.body });
  const result = await quotationItemMasterService.bulkCreateItems(
    organizationId,
    parsed.body,
  );
  return SuccessResponse(
    res,
    "Bulk items created successfully",
    result,
    statusCode.Created,
  );
});

/**
 * @route   GET /api/v1/quotation-master/items
 * @desc    Fetch paginated list of catalog items with multi-criteria filters
 * @access  Private (Authenticated Tenant User)
 */
export const getQuotationItems = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedQuery = getQuotationItemsQuerySchema.parse({ query: req.query });
  const result = await quotationItemMasterService.getItems(
    organizationId,
    parsedQuery.query,
  );
  return SuccessResponse(
    res,
    "Quotation items retrieved successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   GET /api/v1/quotation-master/items/categories/summary
 * @desc    Fetch summary count of items grouped by category
 * @access  Private (Authenticated Tenant User)
 */
export const getQuotationItemCategorySummary = asyncHandler(
  async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new ErrorResponse(
        "Organization context required",
        statusCode.Bad_Request,
      );
    }

    const result =
      await quotationItemMasterService.getCategorySummary(organizationId);
    return SuccessResponse(
      res,
      "Category summary retrieved successfully",
      result,
      statusCode.OK,
    );
  },
);

/**
 * @route   GET /api/v1/quotation-master/items/:id
 * @desc    Fetch single catalog item by ID
 * @access  Private (Authenticated Tenant User)
 */
export const getQuotationItemById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedParams = quotationItemIdParamSchema.parse({ params: req.params });
  const result = await quotationItemMasterService.getItemById(
    parsedParams.params.id,
    organizationId,
  );
  return SuccessResponse(
    res,
    "Quotation item retrieved successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   PATCH /api/v1/quotation-master/items/:id
 * @desc    Update catalog item (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
export const updateQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsed = updateQuotationItemSchema.parse({
    params: req.params,
    body: req.body,
  });
  const result = await quotationItemMasterService.updateItem(
    parsed.params.id,
    organizationId,
    parsed.body,
  );
  return SuccessResponse(
    res,
    "Quotation item updated successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   DELETE /api/v1/quotation-master/items/:id
 * @desc    Soft delete a catalog item
 * @access  Private (Authenticated Tenant User)
 */
export const deleteQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedParams = quotationItemIdParamSchema.parse({ params: req.params });
  const result = await quotationItemMasterService.deleteItem(
    parsedParams.params.id,
    organizationId,
  );
  return SuccessResponse(
    res,
    "Quotation item deleted successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   PATCH /api/v1/quotation-master/items/:id/toggle-active
 * @desc    Toggle active state of a catalog item
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveQuotationItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedParams = quotationItemIdParamSchema.parse({ params: req.params });
  const result = await quotationItemMasterService.toggleActive(
    parsedParams.params.id,
    organizationId,
  );
  return SuccessResponse(
    res,
    "Quotation item status updated successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   POST /api/v1/quotation-master/items/:id/image
 * @desc    Upload primary image for an item
 * @access  Private (Authenticated Tenant User)
 */
export const uploadQuotationItemImage = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedParams = quotationItemIdParamSchema.parse({ params: req.params });
  if (!req.file) {
    throw new ErrorResponse("No image file uploaded", statusCode.Bad_Request);
  }

  const result = await quotationItemMasterService.uploadPrimaryImage(
    parsedParams.params.id,
    organizationId,
    req.file,
  );
  return SuccessResponse(
    res,
    "Primary image uploaded successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   POST /api/v1/quotation-master/items/:id/gallery
 * @desc    Upload multiple gallery images for an item
 * @access  Private (Authenticated Tenant User)
 */
export const uploadQuotationItemGallery = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse(
      "Organization context required",
      statusCode.Bad_Request,
    );
  }

  const parsedParams = quotationItemIdParamSchema.parse({ params: req.params });
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) {
    throw new ErrorResponse(
      "No gallery files uploaded",
      statusCode.Bad_Request,
    );
  }

  const result = await quotationItemMasterService.uploadGalleryImages(
    parsedParams.params.id,
    organizationId,
    files,
  );
  return SuccessResponse(
    res,
    "Gallery images uploaded successfully",
    result,
    statusCode.OK,
  );
});

/**
 * @route   DELETE /api/v1/quotation-master/items/:id/gallery/:imageId
 * @desc    Delete a specific gallery image from an item
 * @access  Private (Authenticated Tenant User)
 */
export const deleteQuotationItemGalleryImage = asyncHandler(
  async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      throw new ErrorResponse(
        "Organization context required",
        statusCode.Bad_Request,
      );
    }

    const parsedParams = quotationItemGalleryParamSchema.parse({
      params: req.params,
    });
    const result = await quotationItemMasterService.deleteGalleryImage(
      parsedParams.params.id,
      parsedParams.params.imageId,
      organizationId,
    );
    return SuccessResponse(
      res,
      "Gallery image removed successfully",
      result,
      statusCode.OK,
    );
  },
);

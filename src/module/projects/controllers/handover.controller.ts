import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { handoverService } from "../services/handover.service.js";
import {
  createHandoverSchema,
  updateHandoverSchema,
  updateHandoverStatusSchema,
  commercialClearanceSchema,
  handoverSignoffSchema,
  createHandoverItemSchema,
  updateHandoverItemSchema,
  updateHandoverItemStatusSchema,
  bulkHandoverItemsSchema,
  createHandoverSnagSchema,
  updateHandoverSnagSchema,
  resolveHandoverSnagSchema,
  verifyHandoverSnagSchema,
  getHandoversQuerySchema,
  getHandoverItemsQuerySchema,
  getHandoverSnagsQuerySchema,
  handoverIdParamSchema,
  handoverItemParamSchema,
  handoverSnagParamSchema,
} from "../validators/handover.validator.js";

// ==========================================
// 1. ROOT PROJECT HANDOVER CONTROLLERS
// ==========================================

/**
 * @route   POST /api/v1/projects/handovers or POST /api/v1/projects/:projectId/handovers
 * @desc    Create a new project handover docket with warranties, initial items, snags, and cloud documents
 * @access  Private (Tenant Scoped: PLATFORM_ADMIN, ADMIN, USER)
 * @param   req Express request containing validated body and uploaded files
 * @param   res Express response
 * @returns SuccessResponse with created ProjectHandover
 */
export const createHandover = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  // Support route param fallback if mounted under /:projectId/handovers
  if (!req.body.projectId && req.params.projectId) {
    req.body.projectId = req.params.projectId;
  }

  const validatedBody = createHandoverSchema.parse(req.body);
  const files = req.files as
    | {
        warrantyDoc?: Express.Multer.File[];
        certificate?: Express.Multer.File[];
        signature?: Express.Multer.File[];
        sitePhotos?: Express.Multer.File[];
      }
    | undefined;

  const handover = await handoverService.createHandover(organizationId, validatedBody, files);
  return SuccessResponse(res, "Project handover created successfully", handover, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/handovers or GET /api/v1/projects/:projectId/handovers
 * @desc    Fetch paginated list of project handovers with search, status, and commercial filters
 * @access  Private (Tenant Scoped)
 * @param   req Express request with query filters
 * @param   res Express response
 * @returns SuccessResponse with paginated handovers and meta
 */
export const getHandovers = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const queryPayload = { ...req.query };
  if (!queryPayload.projectId && req.params.projectId) {
    queryPayload.projectId = req.params.projectId;
  }

  const validatedQuery = getHandoversQuerySchema.parse(queryPayload);
  const result = await handoverService.getHandovers(organizationId, validatedQuery);

  return SuccessResponse(res, "Project handovers retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/handovers/:id
 * @desc    Fetch single project handover by ID with deliverable checklist and snag items
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handover ID in params
 * @param   res Express response
 * @returns SuccessResponse with complete ProjectHandover details
 */
export const getHandoverById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const handover = await handoverService.getHandoverById(id, organizationId);

  return SuccessResponse(res, "Project handover details retrieved successfully", handover, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/handovers/:id/readiness
 * @desc    Compute comprehensive pre-handover readiness audit (commercial status, open snags, pending items)
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handover ID in params
 * @param   res Express response
 * @returns SuccessResponse with readiness summary and pass/fail audit score
 */
export const getHandoverReadiness = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const readiness = await handoverService.getHandoverReadiness(id, organizationId);

  return SuccessResponse(res, "Handover readiness audit calculated successfully", readiness, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:id
 * @desc    Update project handover details, dates, warranty terms, and documents
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handover ID and dirty update fields
 * @param   res Express response
 * @returns SuccessResponse with updated ProjectHandover
 */
export const updateHandover = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = updateHandoverSchema.parse(req.body);
  const files = req.files as
    | {
        warrantyDoc?: Express.Multer.File[];
        certificate?: Express.Multer.File[];
        signature?: Express.Multer.File[];
        sitePhotos?: Express.Multer.File[];
      }
    | undefined;

  const updated = await handoverService.updateHandover(id, organizationId, validatedBody, files);
  return SuccessResponse(res, "Project handover updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:id/status
 * @desc    Transition handover status across lifecycle states and cascade to parent project
 * @access  Private (Tenant Scoped)
 * @param   req Express request with new status and transition remarks
 * @param   res Express response
 * @returns SuccessResponse with updated ProjectHandover
 */
export const updateHandoverStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = updateHandoverStatusSchema.parse(req.body);

  const updated = await handoverService.updateHandoverStatus(id, organizationId, validatedBody);
  return SuccessResponse(res, "Handover status updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:id/commercial-clearance
 * @desc    Approve commercial clearance, final settlement, and outstanding balance
 * @access  Private (Tenant Scoped)
 * @param   req Express request with settlement details and remarks
 * @param   res Express response
 * @returns SuccessResponse with updated ProjectHandover
 */
export const updateCommercialClearance = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = commercialClearanceSchema.parse(req.body);

  const updated = await handoverService.updateCommercialClearance(id, organizationId, validatedBody);
  return SuccessResponse(res, "Commercial clearance updated successfully", updated, statusCode.OK);
});

/**
 * @route   POST /api/v1/projects/handovers/:id/client-signoff
 * @desc    Record client digital touch signature, rating, feedback, and site walkthrough verification photos
 * @access  Private (Tenant Scoped)
 * @param   req Express request with signoff metadata and uploaded files
 * @param   res Express response
 * @returns SuccessResponse with completed ProjectHandover
 */
export const clientSignoff = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = handoverSignoffSchema.parse(req.body);
  const files = req.files as
    | {
        signature?: Express.Multer.File[];
        certificate?: Express.Multer.File[];
        sitePhotos?: Express.Multer.File[];
      }
    | undefined;

  const result = await handoverService.clientSignoff(id, organizationId, validatedBody, files);
  return SuccessResponse(res, "Client handover signoff completed successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/handovers/:id
 * @desc    Permanently delete a handover docket (only allowed if DRAFT, REJECTED, or CANCELLED)
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handover ID
 * @param   res Express response
 * @returns SuccessResponse confirming deletion
 */
export const deleteHandover = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  await handoverService.deleteHandover(id, organizationId);

  return SuccessResponse(res, "Project handover deleted successfully", null, statusCode.OK);
});

// ==========================================
// 2. DELIVERABLE ITEMS CONTROLLERS
// ==========================================

/**
 * @route   POST /api/v1/projects/handovers/:id/items
 * @desc    Add a physical or digital deliverable item (keys, warranty docs, manuals) to the handover docket
 * @access  Private (Tenant Scoped)
 * @param   req Express request with item metadata and optional document upload
 * @param   res Express response
 * @returns SuccessResponse with created ProjectHandoverItem
 */
export const addItem = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = createHandoverItemSchema.parse(req.body);
  const files = req.files as { document?: Express.Multer.File[] } | undefined;

  const item = await handoverService.addItem(id, organizationId, validatedBody, files);
  return SuccessResponse(res, "Handover item added successfully", item, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/handovers/:id/items
 * @desc    Fetch all deliverable items for a handover docket with category and status filters
 * @access  Private (Tenant Scoped)
 * @param   req Express request with query filters
 * @param   res Express response
 * @returns SuccessResponse with array of ProjectHandoverItem
 */
export const getItems = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedQuery = getHandoverItemsQuerySchema.parse(req.query);

  const items = await handoverService.getItems(id, organizationId, validatedQuery);
  return SuccessResponse(res, "Handover items retrieved successfully", items, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/handovers/:handoverId/items/:itemId
 * @desc    Fetch single deliverable item details by ID
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handoverId and itemId
 * @param   res Express response
 * @returns SuccessResponse with ProjectHandoverItem
 */
export const getItemById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, itemId } = handoverItemParamSchema.parse(req.params);
  const item = await handoverService.getItemById(handoverId, itemId, organizationId);

  return SuccessResponse(res, "Handover item details retrieved successfully", item, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/items/:itemId
 * @desc    Update deliverable item information, recipient name, or uploaded document
 * @access  Private (Tenant Scoped)
 * @param   req Express request with partial updates
 * @param   res Express response
 * @returns SuccessResponse with updated ProjectHandoverItem
 */
export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, itemId } = handoverItemParamSchema.parse(req.params);
  const validatedBody = updateHandoverItemSchema.parse(req.body);
  const files = req.files as { document?: Express.Multer.File[] } | undefined;

  const updated = await handoverService.updateItem(handoverId, itemId, organizationId, validatedBody, files);
  return SuccessResponse(res, "Handover item updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/items/:itemId/status
 * @desc    Update single deliverable item status (VERIFIED, HANDED_OVER, etc.)
 * @access  Private (Tenant Scoped)
 * @param   req Express request with status payload
 * @param   res Express response
 * @returns SuccessResponse with updated ProjectHandoverItem
 */
export const updateItemStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, itemId } = handoverItemParamSchema.parse(req.params);
  const validatedBody = updateHandoverItemStatusSchema.parse(req.body);

  const updated = await handoverService.updateItemStatus(handoverId, itemId, organizationId, validatedBody);
  return SuccessResponse(res, "Handover item status updated successfully", updated, statusCode.OK);
});

/**
 * @route   POST /api/v1/projects/handovers/:id/items/bulk-handover
 * @desc    Hand over multiple checklist items in bulk to the client / recipient
 * @access  Private (Tenant Scoped)
 * @param   req Express request with array of item IDs, recipient name, and notes
 * @param   res Express response
 * @returns SuccessResponse with batch update count
 */
export const bulkHandoverItems = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = bulkHandoverItemsSchema.parse(req.body);

  const result = await handoverService.bulkHandoverItems(id, organizationId, validatedBody);
  return SuccessResponse(res, "Bulk handover items processed successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/handovers/:handoverId/items/:itemId
 * @desc    Delete a deliverable item from the handover checklist
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handoverId and itemId
 * @param   res Express response
 * @returns SuccessResponse confirming deletion
 */
export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, itemId } = handoverItemParamSchema.parse(req.params);
  await handoverService.deleteItem(handoverId, itemId, organizationId);

  return SuccessResponse(res, "Handover item deleted successfully", null, statusCode.OK);
});

// ==========================================
// 3. PRE-HANDOVER SNAGS / PUNCH-LIST CONTROLLERS
// ==========================================

/**
 * @route   POST /api/v1/projects/handovers/:id/snags
 * @desc    Report a pre-handover defect / snag ticket with severity and cloud before photo
 * @access  Private (Tenant Scoped)
 * @param   req Express request with snag details and optional photo
 * @param   res Express response
 * @returns SuccessResponse with created ProjectHandoverSnag
 */
export const addSnag = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedBody = createHandoverSnagSchema.parse(req.body);
  const files = req.files as { beforePhoto?: Express.Multer.File[] } | undefined;

  const snag = await handoverService.addSnag(id, organizationId, validatedBody, files);
  return SuccessResponse(res, "Pre-handover snag reported successfully", snag, statusCode.Created);
});

/**
 * @route   GET /api/v1/projects/handovers/:id/snags
 * @desc    Fetch punch-list snags for a handover docket with severity, status, and room filters
 * @access  Private (Tenant Scoped)
 * @param   req Express request with query filters
 * @param   res Express response
 * @returns SuccessResponse with array of ProjectHandoverSnag
 */
export const getSnags = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = handoverIdParamSchema.parse(req.params);
  const validatedQuery = getHandoverSnagsQuerySchema.parse(req.query);

  const snags = await handoverService.getSnags(id, organizationId, validatedQuery);
  return SuccessResponse(res, "Handover snags retrieved successfully", snags, statusCode.OK);
});

/**
 * @route   GET /api/v1/projects/handovers/:handoverId/snags/:snagId
 * @desc    Fetch single punch-list snag details by ID
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handoverId and snagId
 * @param   res Express response
 * @returns SuccessResponse with ProjectHandoverSnag
 */
export const getSnagById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, snagId } = handoverSnagParamSchema.parse(req.params);
  const snag = await handoverService.getSnagById(handoverId, snagId, organizationId);

  return SuccessResponse(res, "Handover snag details retrieved successfully", snag, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/snags/:snagId
 * @desc    Update snag details, assigned technician, severity, or before photo
 * @access  Private (Tenant Scoped)
 * @param   req Express request with partial snag updates
 * @param   res Express response
 * @returns SuccessResponse with updated ProjectHandoverSnag
 */
export const updateSnag = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, snagId } = handoverSnagParamSchema.parse(req.params);
  const validatedBody = updateHandoverSnagSchema.parse(req.body);
  const files = req.files as { beforePhoto?: Express.Multer.File[] } | undefined;

  const updated = await handoverService.updateSnag(handoverId, snagId, organizationId, validatedBody, files);
  return SuccessResponse(res, "Handover snag updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/snags/:snagId/resolve
 * @desc    Mark snag as resolved with rectification notes and cloud after photo proof
 * @access  Private (Tenant Scoped)
 * @param   req Express request with resolution notes and after photo file
 * @param   res Express response
 * @returns SuccessResponse with resolved ProjectHandoverSnag
 */
export const resolveSnag = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, snagId } = handoverSnagParamSchema.parse(req.params);
  const validatedBody = resolveHandoverSnagSchema.parse(req.body);
  const files = req.files as { afterPhoto?: Express.Multer.File[] } | undefined;

  const updated = await handoverService.resolveSnag(handoverId, snagId, organizationId, validatedBody, files);
  return SuccessResponse(res, "Handover snag resolved successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/projects/handovers/:handoverId/snags/:snagId/verify
 * @desc    Verify resolved snag by client or supervisor (ACCEPTED_BY_CLIENT or WAIVED)
 * @access  Private (Tenant Scoped)
 * @param   req Express request with verification status and remarks
 * @param   res Express response
 * @returns SuccessResponse with verified ProjectHandoverSnag
 */
export const verifySnag = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, snagId } = handoverSnagParamSchema.parse(req.params);
  const validatedBody = verifyHandoverSnagSchema.parse(req.body);

  const updated = await handoverService.verifySnag(handoverId, snagId, organizationId, validatedBody);
  return SuccessResponse(res, "Handover snag verified successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/projects/handovers/:handoverId/snags/:snagId
 * @desc    Delete a snag ticket from the punch-list
 * @access  Private (Tenant Scoped)
 * @param   req Express request with handoverId and snagId
 * @param   res Express response
 * @returns SuccessResponse confirming deletion
 */
export const deleteSnag = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { handoverId, snagId } = handoverSnagParamSchema.parse(req.params);
  await handoverService.deleteSnag(handoverId, snagId, organizationId);

  return SuccessResponse(res, "Handover snag deleted successfully", null, statusCode.OK);
});

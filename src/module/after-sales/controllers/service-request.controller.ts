import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { serviceRequestService } from "../services/service-request.service.js";
import {
  createServiceRequestSchema,
  updateServiceRequestSchema,
  assignServiceRequestSchema,
  updateServiceRequestStatusSchema,
  resolveServiceRequestSchema,
  reopenServiceRequestSchema,
  getServiceRequestsQuerySchema,
  serviceRequestIdParamSchema,
} from "../validators/service-request.validator.js";

/**
 * @route   POST /api/v1/after-sales/requests
 * @desc    Create a new service request work order with attachments
 * @access  Private
 */
export const createServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.body.projectId && req.params.projectId) {
    req.body.projectId = req.params.projectId;
  }

  const validatedBody = createServiceRequestSchema.parse(req.body);

  const files = req.files as { attachments?: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  const attachmentFiles = Array.isArray(files) ? files : files?.attachments;

  const request = await serviceRequestService.createServiceRequest(
    organizationId,
    validatedBody,
    attachmentFiles
  );

  return SuccessResponse(res, "Service request ticket created successfully", request, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/requests
 * @desc    List service requests with filters & pagination
 * @access  Private
 */
export const getServiceRequests = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.query.projectId && req.params.projectId) {
    req.query.projectId = req.params.projectId;
  }

  const query = getServiceRequestsQuerySchema.parse(req.query);
  const result = await serviceRequestService.getServiceRequests(organizationId, query);

  return SuccessResponse(res, "Service requests fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/requests/:id
 * @desc    Get detailed service request docket with visits & claims
 * @access  Private
 */
export const getServiceRequestById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const request = await serviceRequestService.getServiceRequestById(organizationId, id);

  return SuccessResponse(res, "Service request fetched successfully", request, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/requests/:id
 * @desc    Partial update service request details & attachments
 * @access  Private
 */
export const updateServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const validatedBody = updateServiceRequestSchema.parse(req.body);

  const files = req.files as { attachments?: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  const attachmentFiles = Array.isArray(files) ? files : files?.attachments;

  const updated = await serviceRequestService.updateServiceRequest(
    organizationId,
    id,
    validatedBody,
    attachmentFiles
  );

  return SuccessResponse(res, "Service request updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/assign
 * @desc    Assign or re-assign technician to service request
 * @access  Private (Admin)
 */
export const assignServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const validatedBody = assignServiceRequestSchema.parse(req.body);

  const updated = await serviceRequestService.assignServiceRequest(
    organizationId,
    id,
    validatedBody
  );

  return SuccessResponse(res, "Service request assigned successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/status
 * @desc    Transition service request lifecycle status
 * @access  Private
 */
export const updateServiceRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const { status } = updateServiceRequestStatusSchema.parse(req.body);

  const updated = await serviceRequestService.updateStatus(organizationId, id, status);

  return SuccessResponse(res, "Service request status updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/resolve
 * @desc    Mark service request resolved with resolution notes & final cost
 * @access  Private
 */
export const resolveServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const validatedBody = resolveServiceRequestSchema.parse(req.body);

  const updated = await serviceRequestService.resolveServiceRequest(
    organizationId,
    id,
    validatedBody
  );

  return SuccessResponse(res, "Service request marked as resolved", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/close
 * @desc    Formally close a resolved service request
 * @access  Private (Admin)
 */
export const closeServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const updated = await serviceRequestService.closeServiceRequest(organizationId, id);

  return SuccessResponse(res, "Service request closed successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/requests/:id/reopen
 * @desc    Reopen a resolved or closed service request
 * @access  Private (Admin)
 */
export const reopenServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  const validatedBody = reopenServiceRequestSchema.parse(req.body);

  const updated = await serviceRequestService.reopenServiceRequest(
    organizationId,
    id,
    validatedBody
  );

  return SuccessResponse(res, "Service request reopened successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/after-sales/requests/:id
 * @desc    Soft delete service request
 * @access  Private (Admin)
 */
export const deleteServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = serviceRequestIdParamSchema.parse(req.params);
  await serviceRequestService.deleteServiceRequest(organizationId, id);

  return SuccessResponse(res, "Service request deleted successfully", null, statusCode.OK);
});

import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { serviceVisitService } from "../services/service-visit.service.js";
import { resolveAfterSalesOrgId } from "../utils/resolve-org.util.js";
import {
  createServiceVisitSchema,
  updateServiceVisitSchema,
  checkInServiceVisitSchema,
  submitWorkReportSchema,
  signOffServiceVisitSchema,
  updateServiceVisitStatusSchema,
  getServiceVisitsQuerySchema,
  serviceVisitIdParamSchema,
} from "../validators/service-visit.validator.js";

/**
 * @route   POST /api/v1/after-sales/visits
 * @desc    Schedule technician service visit
 * @access  Private (Admin)
 */
export const createVisit = asyncHandler(async (req: Request, res: Response) => {
  if (!req.body.projectId && req.params.projectId) {
    req.body.projectId = req.params.projectId;
  }

  const organizationId = await resolveAfterSalesOrgId(req);
  const validatedBody = createServiceVisitSchema.parse(req.body);
  const visit = await serviceVisitService.createVisit(organizationId, validatedBody);

  return SuccessResponse(res, "Service visit scheduled successfully", visit, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/visits
 * @desc    List service visits with filters & pagination
 * @access  Private
 */
export const getVisits = asyncHandler(async (req: Request, res: Response) => {
  if (!req.query.projectId && req.params.projectId) {
    req.query.projectId = req.params.projectId;
  }

  const organizationId = await resolveAfterSalesOrgId(req);
  const query = getServiceVisitsQuerySchema.parse(req.query);
  const result = await serviceVisitService.getVisits(organizationId, query);

  return SuccessResponse(res, "Service visits fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/visits/:id
 * @desc    Get detailed service visit docket with telemetry & proof photos
 * @access  Private
 */
export const getVisitById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  const visit = await serviceVisitService.getVisitById(organizationId, id);

  return SuccessResponse(res, "Service visit fetched successfully", visit, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/visits/:id
 * @desc    Partial update visit details
 * @access  Private
 */
export const updateVisit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  const validatedBody = updateServiceVisitSchema.parse(req.body);

  const updated = await serviceVisitService.updateVisit(organizationId, id, validatedBody);

  return SuccessResponse(res, "Service visit updated successfully", updated, statusCode.OK);
});

/**
 * @route   POST /api/v1/after-sales/visits/:id/check-in
 * @desc    Technician mobile check-in with GPS coordinates & selfie/site photo
 * @access  Private
 */
export const checkInVisit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  const validatedBody = checkInServiceVisitSchema.parse(req.body);

  const files = req.files as { checkInPhoto?: Express.Multer.File[] } | undefined;
  const photoFile = files?.checkInPhoto?.[0] || req.file;

  const updated = await serviceVisitService.checkIn(
    organizationId,
    id,
    validatedBody,
    photoFile
  );

  return SuccessResponse(res, "Technician checked in successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/visits/:id/work-report
 * @desc    Submit field work report with before/after photos
 * @access  Private
 */
export const submitWorkReport = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  const validatedBody = submitWorkReportSchema.parse(req.body);

  const files = req.files as
    | {
        beforePhotos?: Express.Multer.File[];
        afterPhotos?: Express.Multer.File[];
      }
    | undefined;

  const updated = await serviceVisitService.submitWorkReport(
    organizationId,
    id,
    validatedBody,
    files?.beforePhotos,
    files?.afterPhotos
  );

  return SuccessResponse(res, "Work report submitted successfully", updated, statusCode.OK);
});

/**
 * @route   POST /api/v1/after-sales/visits/:id/sign-off
 * @desc    Client digital touch signature & on-site CSAT rating
 * @access  Private
 */
export const signOffVisit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  const validatedBody = signOffServiceVisitSchema.parse(req.body);

  const files = req.files as { signature?: Express.Multer.File[] } | undefined;
  const signatureFile = files?.signature?.[0] || req.file;

  const updated = await serviceVisitService.signOff(
    organizationId,
    id,
    validatedBody,
    signatureFile
  );

  return SuccessResponse(res, "Customer sign-off recorded successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/visits/:id/status
 * @desc    Transition service visit lifecycle status
 * @access  Private
 */
export const updateVisitStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  const { status } = updateServiceVisitStatusSchema.parse(req.body);

  const updated = await serviceVisitService.updateStatus(organizationId, id, status);

  return SuccessResponse(res, "Service visit status updated successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/after-sales/visits/:id
 * @desc    Soft delete service visit
 * @access  Private (Admin)
 */
export const deleteVisit = asyncHandler(async (req: Request, res: Response) => {
  const { id } = serviceVisitIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { visitId: id });
  await serviceVisitService.deleteVisit(organizationId, id);

  return SuccessResponse(res, "Service visit deleted successfully", null, statusCode.OK);
});

import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { warrantyService } from "../services/warranty.service.js";
import { resolveAfterSalesOrgId } from "../utils/resolve-org.util.js";
import {
  createProjectWarrantySchema,
  updateProjectWarrantySchema,
  updateWarrantyStatusSchema,
  getProjectWarrantiesQuerySchema,
  warrantyIdParamSchema,
} from "../validators/warranty.validator.js";

/**
 * @route   POST /api/v1/after-sales/warranties
 * @desc    Create a project warranty docket with policy document
 * @access  Private (Admin)
 */
export const createWarranty = asyncHandler(async (req: Request, res: Response) => {
  // Fallback if mounted under /projects/:projectId/after-sales/warranties
  if (!req.body.projectId && req.params.projectId) {
    req.body.projectId = req.params.projectId;
  }

  const organizationId = await resolveAfterSalesOrgId(req);
  const validatedBody = createProjectWarrantySchema.parse(req.body);

  const files = req.files as { policyDoc?: Express.Multer.File[] } | undefined;
  const policyDocFile = files?.policyDoc?.[0] || req.file;

  const warranty = await warrantyService.createWarranty(
    organizationId,
    validatedBody,
    policyDocFile
  );

  return SuccessResponse(res, "Project warranty created successfully", warranty, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/warranties
 * @desc    List project warranties with filters & pagination
 * @access  Private
 */
export const getWarranties = asyncHandler(async (req: Request, res: Response) => {
  if (!req.query.projectId && req.params.projectId) {
    req.query.projectId = req.params.projectId;
  }

  const organizationId = await resolveAfterSalesOrgId(req);
  const query = getProjectWarrantiesQuerySchema.parse(req.query);
  const result = await warrantyService.getWarranties(organizationId, query);

  return SuccessResponse(res, "Project warranties fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/warranties/:id
 * @desc    Get detailed warranty record with claims & requests
 * @access  Private
 */
export const getWarrantyById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = warrantyIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { warrantyId: id });
  const warranty = await warrantyService.getWarrantyById(organizationId, id);

  return SuccessResponse(res, "Project warranty fetched successfully", warranty, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/warranties/:id
 * @desc    Partial update warranty details & replace policy document
 * @access  Private (Admin)
 */
export const updateWarranty = asyncHandler(async (req: Request, res: Response) => {
  const { id } = warrantyIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { warrantyId: id });
  const validatedBody = updateProjectWarrantySchema.parse(req.body);

  const files = req.files as { policyDoc?: Express.Multer.File[] } | undefined;
  const policyDocFile = files?.policyDoc?.[0] || req.file;

  const updated = await warrantyService.updateWarranty(
    organizationId,
    id,
    validatedBody,
    policyDocFile
  );

  return SuccessResponse(res, "Project warranty updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/warranties/:id/status
 * @desc    Transition warranty status (ACTIVE, EXPIRED, CLAIMED, VOIDED)
 * @access  Private (Admin)
 */
export const updateWarrantyStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = warrantyIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { warrantyId: id });
  const { status } = updateWarrantyStatusSchema.parse(req.body);

  const updated = await warrantyService.updateWarrantyStatus(organizationId, id, status);

  return SuccessResponse(res, "Warranty status updated successfully", updated, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/after-sales/warranties/:id
 * @desc    Soft delete project warranty
 * @access  Private (Admin)
 */
export const deleteWarranty = asyncHandler(async (req: Request, res: Response) => {
  const { id } = warrantyIdParamSchema.parse(req.params);
  const organizationId = await resolveAfterSalesOrgId(req, { warrantyId: id });
  await warrantyService.deleteWarranty(organizationId, id);

  return SuccessResponse(res, "Project warranty deleted successfully", null, statusCode.OK);
});

import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { claimService } from "../services/claim.service.js";
import {
  createWarrantyClaimSchema,
  updateWarrantyClaimSchema,
  reviewWarrantyClaimSchema,
  getWarrantyClaimsQuerySchema,
  claimIdParamSchema,
} from "../validators/claim.validator.js";

/**
 * @route   POST /api/v1/after-sales/claims
 * @desc    File a new warranty claim with evidence photos
 * @access  Private
 */
export const createClaim = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const validatedBody = createWarrantyClaimSchema.parse(req.body);

  const files = req.files as { evidencePhotos?: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  const photoFiles = Array.isArray(files) ? files : files?.evidencePhotos;

  const claim = await claimService.createClaim(organizationId, validatedBody, photoFiles);

  return SuccessResponse(res, "Warranty claim submitted successfully", claim, statusCode.Created);
});

/**
 * @route   GET /api/v1/after-sales/claims
 * @desc    List warranty claims with filters & pagination
 * @access  Private
 */
export const getClaims = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const query = getWarrantyClaimsQuerySchema.parse(req.query);
  const result = await claimService.getClaims(organizationId, query);

  return SuccessResponse(res, "Warranty claims fetched successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/after-sales/claims/:id
 * @desc    Get single claim record by ID
 * @access  Private
 */
export const getClaimById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = claimIdParamSchema.parse(req.params);
  const claim = await claimService.getClaimById(organizationId, id);

  return SuccessResponse(res, "Warranty claim fetched successfully", claim, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/claims/:id
 * @desc    Update warranty claim details & additional evidence photos
 * @access  Private
 */
export const updateClaim = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = claimIdParamSchema.parse(req.params);
  const validatedBody = updateWarrantyClaimSchema.parse(req.body);

  const files = req.files as { evidencePhotos?: Express.Multer.File[] } | Express.Multer.File[] | undefined;
  const photoFiles = Array.isArray(files) ? files : files?.evidencePhotos;

  const updated = await claimService.updateClaim(
    organizationId,
    id,
    validatedBody,
    photoFiles
  );

  return SuccessResponse(res, "Warranty claim updated successfully", updated, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/after-sales/claims/:id/review
 * @desc    Review warranty claim (Approve / Reject)
 * @access  Private (Admin / Reviewer)
 */
export const reviewClaim = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("User & Organization context required", statusCode.Bad_Request);
  }

  const { id } = claimIdParamSchema.parse(req.params);
  const validatedBody = reviewWarrantyClaimSchema.parse(req.body);

  const updated = await claimService.reviewClaim(
    organizationId,
    id,
    userId,
    validatedBody
  );

  return SuccessResponse(res, "Warranty claim reviewed successfully", updated, statusCode.OK);
});

/**
 * @route   POST /api/v1/after-sales/claims/:id/spawn-service-request
 * @desc    Convert an approved claim to a Service Request ticket
 * @access  Private (Admin)
 */
export const spawnServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = claimIdParamSchema.parse(req.params);
  const serviceRequest = await claimService.spawnServiceRequestFromClaim(organizationId, id);

  return SuccessResponse(res, "Service request ticket generated from warranty claim", serviceRequest, statusCode.Created);
});

/**
 * @route   DELETE /api/v1/after-sales/claims/:id
 * @desc    Soft delete warranty claim
 * @access  Private (Admin)
 */
export const deleteClaim = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const { id } = claimIdParamSchema.parse(req.params);
  await claimService.deleteClaim(organizationId, id);

  return SuccessResponse(res, "Warranty claim deleted successfully", null, statusCode.OK);
});

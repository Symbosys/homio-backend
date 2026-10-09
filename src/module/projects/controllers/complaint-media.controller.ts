import { asyncHandler } from "../../../middlewares/error.middleware.js";
import {
  SuccessResponse,
  ErrorResponse,
} from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { prisma } from "../../../lib/prisma.js";
import { complaintMediaService } from "../services/complaint-media.service.js";
import {
  getPresignedComplaintMediaUrlSchema,
  confirmComplaintMediaUploadSchema,
  createDirectComplaintMediaSchema,
  updateComplaintMediaSchema,
  getComplaintMediaQuerySchema,
  singleComplaintMediaParamsSchema,
} from "../validators/complaint-media.validator.js";

/**
 * Helper: Resolve organization ID from authenticated user or active project record
 */
async function resolveOrgId(req: any, projectId: string): Promise<string> {
  if (req.user?.organizationId) {
    return req.user.organizationId;
  }
  const project = await prisma.project.findFirst({
    where: { id: projectId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!project) {
    throw new ErrorResponse("Project not found", statusCode.Not_Found);
  }
  return project.organizationId;
}

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/media/presigned-url
 * @desc    Generate AWS S3 Presigned PUT URL for direct client-to-cloud complaint video/image streaming
 * @access  Private (Authenticated Tenant / Client User)
 */
export const getPresignedComplaintMediaUrl = asyncHandler(async (req, res) => {
  const parsed = getPresignedComplaintMediaUrlSchema.parse({
    params: req.params,
    body: req.body,
  });
  const organizationId = await resolveOrgId(req, parsed.params.projectId);

  const result = await complaintMediaService.getPresignedUploadUrl(
    parsed.params.projectId,
    parsed.params.complaintId,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(
    res,
    "S3 Presigned upload URL generated successfully",
    result,
    statusCode.Created
  );
});

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/media/confirm
 * @desc    Confirm direct S3 upload completion and activate complaint media record
 * @access  Private (Authenticated Tenant / Client User)
 */
export const confirmComplaintMediaUpload = asyncHandler(async (req, res) => {
  const mediaId = (req.body?.mediaId || req.params?.mediaId) as string;
  if (!mediaId) {
    throw new ErrorResponse("mediaId is required", statusCode.Bad_Request);
  }

  const parsed = confirmComplaintMediaUploadSchema.parse({
    params: { ...req.params, mediaId },
    body: req.body,
  });
  const organizationId = await resolveOrgId(req, parsed.params.projectId);

  const result = await complaintMediaService.confirmMediaUpload(
    parsed.params.projectId,
    parsed.params.complaintId,
    mediaId,
    organizationId,
    parsed.body
  );

  return SuccessResponse(
    res,
    "Complaint media upload confirmed successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/media
 * @desc    Direct multipart file upload for Before defect / After rectification media
 * @access  Private (Authenticated Tenant / Client User)
 */
export const createDirectComplaintMedia = asyncHandler(async (req, res) => {
  req.setTimeout?.(0);

  if (!req.file) {
    throw new ErrorResponse("Please attach a media file (image, video, document)", statusCode.Bad_Request);
  }

  const parsed = createDirectComplaintMediaSchema.parse({
    params: req.params,
    body: req.body,
  });
  const organizationId = await resolveOrgId(req, parsed.params.projectId);

  const result = await complaintMediaService.uploadDirectMedia(
    parsed.params.projectId,
    parsed.params.complaintId,
    organizationId,
    req.file,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(
    res,
    "Complaint media uploaded successfully",
    result,
    statusCode.Created
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/complaints/:complaintId/media or GET /api/v1/projects/:projectId/complaints-media
 * @desc    Fetch paginated list of media assets for a complaint or project
 * @access  Private (Authenticated Tenant / Client User)
 */
export const getComplaintMediaList = asyncHandler(async (req, res) => {
  const projectId = req.params?.projectId as string;
  if (!projectId) {
    throw new ErrorResponse("Project ID parameter is required", statusCode.Bad_Request);
  }
  const organizationId = await resolveOrgId(req, projectId);

  const complaintId = (req.params?.complaintId || req.query?.complaintId) as string | undefined;

  const parsed = getComplaintMediaQuerySchema.parse({
    params: { projectId, complaintId },
    query: req.query,
  });

  const result = await complaintMediaService.getMediaList(
    parsed.params.projectId,
    organizationId,
    parsed.query
  );

  return SuccessResponse(
    res,
    "Complaint media assets retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/complaints/media/:id
 * @desc    Fetch single complaint media record by ID
 * @access  Private (Authenticated Tenant / Client User)
 */
export const getComplaintMediaById = asyncHandler(async (req, res) => {
  const parsed = singleComplaintMediaParamsSchema.parse({
    params: req.params,
  });
  const organizationId = await resolveOrgId(req, parsed.params.projectId);

  const result = await complaintMediaService.getMediaById(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );

  return SuccessResponse(
    res,
    "Complaint media asset retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   PATCH /api/v1/projects/:projectId/complaints/media/:id
 * @desc    Update complaint media metadata (Rule 5: Partial / Dirty update)
 * @access  Private (Authenticated Tenant / Client User)
 */
export const updateComplaintMedia = asyncHandler(async (req, res) => {
  const parsed = updateComplaintMediaSchema.parse({
    params: req.params,
    body: req.body,
  });
  const organizationId = await resolveOrgId(req, parsed.params.projectId);

  const result = await complaintMediaService.updateMedia(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );

  return SuccessResponse(
    res,
    "Complaint media details updated successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   DELETE /api/v1/projects/:projectId/complaints/media/:id
 * @desc    Delete complaint media asset and prune from cloud storage (Rule 4)
 * @access  Private (Authenticated Tenant User)
 */
export const deleteComplaintMedia = asyncHandler(async (req, res) => {
  const parsed = singleComplaintMediaParamsSchema.parse({
    params: req.params,
  });
  const organizationId = await resolveOrgId(req, parsed.params.projectId);

  await complaintMediaService.deleteMedia(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );

  return SuccessResponse(
    res,
    "Complaint media asset deleted and pruned from cloud storage",
    null,
    statusCode.OK
  );
});

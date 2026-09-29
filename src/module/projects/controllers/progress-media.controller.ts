import { asyncHandler } from "../../../middlewares/error.middleware.js";
import {
  SuccessResponse,
  ErrorResponse,
} from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { progressMediaService } from "../services/progress-media.service.js";
import {
  getPresignedProgressMediaUrlSchema,
  confirmProgressMediaUploadSchema,
  createDirectProgressMediaSchema,
  updateProgressMediaSchema,
  getProgressMediaQuerySchema,
  progressMediaParamsSchema,
  singleProgressMediaParamsSchema,
} from "../validators/progress-media.validator.js";

/**
 * @route   POST /api/v1/projects/:projectId/progress/:progressId/media/presigned-url
 * @desc    Generate AWS S3 Presigned PUT URL for direct client-to-cloud video/image streaming
 * @access  Private (Authenticated Tenant User)
 */
export const getPresignedProgressMediaUrl = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getPresignedProgressMediaUrlSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await progressMediaService.getPresignedUploadUrl(
    parsed.params.projectId,
    parsed.params.progressId,
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
 * @route   POST /api/v1/projects/:projectId/progress/:progressId/media/confirm
 * @desc    Confirm direct S3 upload completion and activate media record
 * @access  Private (Authenticated Tenant User)
 */
export const confirmProgressMediaUpload = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const mediaId = (req.body?.mediaId || req.params?.mediaId) as string;
  if (!mediaId) {
    throw new ErrorResponse("mediaId is required", statusCode.Bad_Request);
  }

  const parsed = confirmProgressMediaUploadSchema.parse({
    params: { ...req.params, mediaId },
    body: req.body,
  });

  const result = await progressMediaService.confirmMediaUpload(
    parsed.params.projectId,
    parsed.params.progressId,
    mediaId,
    organizationId,
    parsed.body
  );

  return SuccessResponse(
    res,
    "Progress media upload confirmed successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   POST /api/v1/projects/:projectId/progress/:progressId/media
 * @desc    Direct multipart file upload for photos, documents, and videos
 * @access  Private (Authenticated Tenant User)
 */
export const createDirectProgressMedia = asyncHandler(async (req, res) => {
  req.setTimeout?.(0);
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.file) {
    throw new ErrorResponse("Please attach a media file (image, video, document)", statusCode.Bad_Request);
  }

  const parsed = createDirectProgressMediaSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await progressMediaService.uploadDirectMedia(
    parsed.params.projectId,
    parsed.params.progressId,
    organizationId,
    req.file,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(
    res,
    "Progress media uploaded successfully",
    result,
    statusCode.Created
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/progress/:progressId/media or GET /api/v1/projects/:projectId/progress-media
 * @desc    Fetch paginated list of media assets for a progress entry or whole project
 * @access  Private (Authenticated Tenant User)
 */
export const getProgressMediaList = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const projectId = req.params?.projectId as string;
  if (!projectId) {
    throw new ErrorResponse("Project ID parameter is required", statusCode.Bad_Request);
  }

  const progressId = (req.params?.progressId || req.query?.progressId) as string | undefined;
  const parsedQuery = getProgressMediaQuerySchema.parse({
    query: {
      ...req.query,
      ...(progressId && { progressId }),
    },
  });

  const result = await progressMediaService.getMediaList(
    projectId,
    organizationId,
    parsedQuery.query
  );

  return SuccessResponse(
    res,
    "Progress media entries retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   GET /api/v1/projects/:projectId/progress/media/:id
 * @desc    Fetch single progress media item details
 * @access  Private (Authenticated Tenant User)
 */
export const getProgressMediaById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = singleProgressMediaParamsSchema.parse({ params: req.params });
  const result = await progressMediaService.getMediaById(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );

  return SuccessResponse(
    res,
    "Progress media details retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   PATCH /api/v1/projects/:projectId/progress/media/:id
 * @desc    Update progress media metadata, caption, tags, cover status (Rule 5: Partial / Dirty update)
 * @access  Private (Authenticated Tenant User)
 */
export const updateProgressMedia = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateProgressMediaSchema.parse({
    params: req.params,
    body: req.body,
  });

  const result = await progressMediaService.updateMedia(
    parsed.params.id,
    parsed.params.projectId,
    organizationId,
    parsed.body
  );

  return SuccessResponse(
    res,
    "Progress media metadata updated successfully",
    result,
    statusCode.OK
  );
});

/**
 * @route   DELETE /api/v1/projects/:projectId/progress/media/:id
 * @desc    Soft delete a progress media asset and prune from cloud storage (Rule 4)
 * @access  Private (Authenticated Tenant User)
 */
export const deleteProgressMedia = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = singleProgressMediaParamsSchema.parse({ params: req.params });
  const result = await progressMediaService.deleteMedia(
    parsed.params.id,
    parsed.params.projectId,
    organizationId
  );

  return SuccessResponse(
    res,
    "Progress media asset deleted and pruned from cloud storage successfully",
    result,
    statusCode.OK
  );
});

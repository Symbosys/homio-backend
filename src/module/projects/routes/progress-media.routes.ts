import { Router } from "express";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  getPresignedProgressMediaUrl,
  confirmProgressMediaUpload,
  createDirectProgressMedia,
  getProgressMediaList,
  getProgressMediaById,
  updateProgressMedia,
  deleteProgressMedia,
} from "../controllers/progress-media.controller.js";

export const progressMediaRouter = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/progress/:progressId/media/presigned-url
 * @desc    Generate S3 presigned PUT URL for direct client-to-cloud upload
 */
progressMediaRouter.post("/presigned-url", getPresignedProgressMediaUrl);

/**
 * @route   POST /api/v1/projects/:projectId/progress/:progressId/media/confirm
 * @desc    Confirm direct S3 upload completion
 */
progressMediaRouter.post("/confirm", confirmProgressMediaUpload);

/**
 * @route   POST /api/v1/projects/:projectId/progress/:progressId/media
 * @desc    Direct multipart file upload for photo, video, or inspection doc
 */
progressMediaRouter.post(
  "/",
  upload.single("file", { category: "all", maxFileSize: 5 * 1024 * 1024 * 1024 }),
  createDirectProgressMedia
);

/**
 * @route   GET /api/v1/projects/:projectId/progress/:progressId/media
 * @desc    Fetch paginated media assets for a progress log
 */
progressMediaRouter.get("/", getProgressMediaList);

/**
 * @route   GET /api/v1/projects/:projectId/progress/media/:id
 * @desc    Fetch single media asset by ID
 */
progressMediaRouter.get("/:id", getProgressMediaById);

/**
 * @route   PATCH /api/v1/projects/:projectId/progress/media/:id
 * @desc    Update progress media metadata
 */
progressMediaRouter.patch("/:id", updateProgressMedia);

/**
 * @route   DELETE /api/v1/projects/:projectId/progress/media/:id
 * @desc    Delete media asset and prune from cloud storage (Rule 4)
 */
progressMediaRouter.delete("/:id", deleteProgressMedia);

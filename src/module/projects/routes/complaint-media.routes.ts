import { Router } from "express";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  getPresignedComplaintMediaUrl,
  confirmComplaintMediaUpload,
  createDirectComplaintMedia,
  getComplaintMediaList,
  getComplaintMediaById,
  updateComplaintMedia,
  deleteComplaintMedia,
} from "../controllers/complaint-media.controller.js";

export const complaintMediaRouter = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/media/presigned-url
 * @desc    Generate S3 presigned PUT URL for direct client-to-cloud upload
 */
complaintMediaRouter.post("/presigned-url", getPresignedComplaintMediaUrl);

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/media/confirm
 * @desc    Confirm direct S3 upload completion
 */
complaintMediaRouter.post("/confirm", confirmComplaintMediaUpload);

/**
 * @route   POST /api/v1/projects/:projectId/complaints/:complaintId/media
 * @desc    Direct multipart file upload for defect/rectification photos and videos (up to 5GB)
 */
complaintMediaRouter.post(
  "/",
  upload.single("file", { category: "all", maxFileSize: 5 * 1024 * 1024 * 1024 }),
  createDirectComplaintMedia
);

/**
 * @route   GET /api/v1/projects/:projectId/complaints/:complaintId/media
 * @desc    Fetch paginated media assets for a complaint log
 */
complaintMediaRouter.get("/", getComplaintMediaList);

/**
 * @route   GET /api/v1/projects/:projectId/complaints/media/:id
 * @desc    Fetch single media asset by ID
 */
complaintMediaRouter.get("/:id", getComplaintMediaById);

/**
 * @route   PATCH /api/v1/projects/:projectId/complaints/media/:id
 * @desc    Update complaint media metadata
 */
complaintMediaRouter.patch("/:id", updateComplaintMedia);

/**
 * @route   DELETE /api/v1/projects/:projectId/complaints/media/:id
 * @desc    Delete media asset and prune from cloud storage (Rule 4)
 */
complaintMediaRouter.delete("/:id", deleteComplaintMedia);

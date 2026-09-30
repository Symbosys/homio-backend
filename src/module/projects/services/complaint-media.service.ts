import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, ProgressMediaType, ProgressMediaUploadStatus, ComplaintMediaStage } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { complaintMediaRepo } from "../repos/complaint-media.repo.js";
import type {
  GetPresignedComplaintMediaUrlInput,
  ConfirmComplaintMediaUploadInput,
  CreateDirectComplaintMediaInput,
  UpdateComplaintMediaInput,
  GetComplaintMediaQueryInput,
} from "../validators/complaint-media.validator.js";

/**
 * Service orchestrating Project Complaint Media (Dual Before/After photos/videos, direct & S3 presigned uploads, pruning)
 */
export class ComplaintMediaService {
  /**
   * Request an S3 presigned PUT URL for direct client-to-cloud streaming & pre-register pending media record
   */
  async getPresignedUploadUrl(
    projectId: string,
    complaintId: string,
    organizationId: string,
    data: GetPresignedComplaintMediaUrlInput,
    userId?: string
  ) {
    // 1. Verify Project & Complaint Context
    const complaint = await prisma.projectComplaint.findFirst({
      where: {
        id: complaintId,
        projectId,
        isDeleted: false,
        project: { organizationId, isDeleted: false },
      },
    });
    if (!complaint) {
      throw new ErrorResponse(
        "Project complaint entry not found in this organization",
        statusCode.Not_Found
      );
    }

    // 2. Resolve Uploading Employee if supplied or from User context
    let uploadedById = data.uploadedById;
    if (!uploadedById && userId) {
      const employee = await prisma.employee.findFirst({
        where: { userId, organizationId, isDeleted: false },
        select: { id: true },
      });
      if (employee) {
        uploadedById = employee.id;
      }
    }

    // 3. Generate structured S3 key
    const stagePrefix = (data.stageType || ComplaintMediaStage.BEFORE).toLowerCase();
    const sanitizedFileName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `organizations/${organizationId}/projects/${projectId}/complaints/${complaintId}/${stagePrefix}/${Date.now()}-${sanitizedFileName}`;

    // 4. Generate S3 presigned PUT URL (valid for 30 minutes for large media files)
    const presignedResult = await storageService.getPresignedPutUrl(
      s3Key,
      data.mimeType,
      1800
    );

    // 5. Pre-register ProjectComplaintMedia record with PENDING status
    const media = await complaintMediaRepo.create(organizationId, projectId, complaintId, {
      stageType: data.stageType || ComplaintMediaStage.BEFORE,
      mediaType: data.mediaType || ProgressMediaType.IMAGE,
      title: data.title || data.fileName,
      description: data.description,
      url: presignedResult.publicUrl,
      storageKey: s3Key,
      storageProvider: presignedResult.provider as any,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      takenAt: data.takenAt ? new Date(data.takenAt) : new Date(),
      geoLatitude: data.geoLatitude,
      geoLongitude: data.geoLongitude,
      tags: data.tags || [],
      isCover: data.isCover || false,
      orderIndex: data.orderIndex || 0,
      uploadStatus: ProgressMediaUploadStatus.PENDING,
      uploadedById,
      additionalInformation: data.additionalInformation,
    });

    return {
      uploadUrl: presignedResult.uploadUrl,
      publicUrl: presignedResult.publicUrl,
      key: s3Key,
      expiresInSeconds: presignedResult.expiresInSeconds,
      media,
    };
  }

  /**
   * Confirm direct S3 upload completion and activate media asset
   */
  async confirmMediaUpload(
    projectId: string,
    complaintId: string,
    mediaId: string,
    organizationId: string,
    data: ConfirmComplaintMediaUploadInput
  ) {
    const existing = await complaintMediaRepo.findById(mediaId, organizationId);
    if (!existing || existing.projectId !== projectId || existing.complaintId !== complaintId) {
      throw new ErrorResponse("Complaint media asset not found", statusCode.Not_Found);
    }

    return complaintMediaRepo.confirmUpload(mediaId, organizationId, {
      ...data,
      uploadStatus: ProgressMediaUploadStatus.COMPLETED,
    });
  }

  /**
   * Upload media directly via server multipart upload (for defect / rectification photos & videos)
   */
  async uploadDirectMedia(
    projectId: string,
    complaintId: string,
    organizationId: string,
    file: Express.Multer.File,
    body: CreateDirectComplaintMediaInput,
    userId?: string
  ) {
    // 1. Verify Project & Complaint
    const complaint = await prisma.projectComplaint.findFirst({
      where: {
        id: complaintId,
        projectId,
        isDeleted: false,
        project: { organizationId, isDeleted: false },
      },
    });
    if (!complaint) {
      throw new ErrorResponse(
        "Project complaint entry not found in this organization",
        statusCode.Not_Found
      );
    }

    // 2. Resolve Uploading Employee
    let uploadedById = body.uploadedById;
    if (!uploadedById && userId) {
      const employee = await prisma.employee.findFirst({
        where: { userId, organizationId, isDeleted: false },
        select: { id: true },
      });
      if (employee) {
        uploadedById = employee.id;
      }
    }

    // 3. Determine media type from mimeType if not explicitly passed
    let determinedType: ProgressMediaType = body.mediaType || ProgressMediaType.IMAGE;
    if (file.mimetype.startsWith("video/")) {
      determinedType = ProgressMediaType.VIDEO;
    } else if (file.mimetype.startsWith("audio/")) {
      determinedType = ProgressMediaType.AUDIO_NOTE;
    } else if (file.mimetype === "application/pdf" || file.mimetype.includes("document")) {
      determinedType = ProgressMediaType.DOCUMENT;
    }

    const stagePrefix = (body.stageType || ComplaintMediaStage.BEFORE).toLowerCase();

    // 4. Upload file via StorageService (parallel S3 multi-part streaming)
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `organizations/${organizationId}/projects/${projectId}/complaints/${complaintId}/${stagePrefix}`,
        resourceType: file.mimetype.startsWith("video/") ? "video" : "auto",
      }
    );

    // 5. Create media record
    return complaintMediaRepo.create(organizationId, projectId, complaintId, {
      stageType: body.stageType || ComplaintMediaStage.BEFORE,
      mediaType: determinedType,
      title: body.title || file.originalname,
      description: body.description,
      url: uploadResult.secureUrl || uploadResult.url,
      storageKey: uploadResult.publicId,
      storageProvider: uploadResult.provider as any,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      width: uploadResult.width || null,
      height: uploadResult.height || null,
      takenAt: body.takenAt ? new Date(body.takenAt) : new Date(),
      geoLatitude: body.geoLatitude,
      geoLongitude: body.geoLongitude,
      tags: Array.isArray(body.tags) ? body.tags : [],
      isCover: Boolean(body.isCover),
      orderIndex: Number(body.orderIndex) || 0,
      uploadStatus: ProgressMediaUploadStatus.COMPLETED,
      uploadedById,
      additionalInformation: body.additionalInformation,
    });
  }

  /**
   * List paginated media entries for a project or complaint (filterable by BEFORE / AFTER)
   */
  async getMediaList(
    projectId: string,
    organizationId: string,
    query: GetComplaintMediaQueryInput
  ) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    return complaintMediaRepo.findAll(organizationId, projectId, query);
  }

  /**
   * Get single media record by ID
   */
  async getMediaById(id: string, projectId: string, organizationId: string) {
    const media = await complaintMediaRepo.findById(id, organizationId);
    if (!media || media.projectId !== projectId) {
      throw new ErrorResponse("Complaint media asset not found", statusCode.Not_Found);
    }
    return media;
  }

  /**
   * Update media metadata (Rule 5: Partial / Dirty update)
   */
  async updateMedia(
    id: string,
    projectId: string,
    organizationId: string,
    data: UpdateComplaintMediaInput
  ) {
    await this.getMediaById(id, projectId, organizationId);
    return complaintMediaRepo.update(id, organizationId, data);
  }

  /**
   * Delete media asset and prune from cloud storage (Rule 4)
   */
  async deleteMedia(id: string, projectId: string, organizationId: string) {
    const media = await this.getMediaById(id, projectId, organizationId);

    // Prune cloud storage asset per Rule 4
    if (media.storageKey) {
      await storageService.delete(media.storageKey).catch((err) => {
        console.warn(`[ComplaintMediaService] Failed to delete cloud asset ${media.storageKey}:`, err);
      });
    }

    return complaintMediaRepo.softDelete(id, organizationId);
  }
}

export const complaintMediaService = new ComplaintMediaService();

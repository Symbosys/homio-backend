import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  ConfirmComplaintMediaUploadInput,
  UpdateComplaintMediaInput,
  GetComplaintMediaQueryInput,
} from "../validators/complaint-media.validator.js";

/**
 * Repository for managing Project Complaint Media (Before defect & After rectification photos/videos)
 */
export class ComplaintMediaRepository {
  private readonly defaultIncludes: Prisma.ProjectComplaintMediaInclude = {
    uploadedBy: {
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
        designation: true,
      },
    },
    complaint: {
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        priority: true,
        type: true,
      },
    },
  };

  /**
   * Helper to serialize BigInt fileSizeBytes to safe JS Number
   */
  private serializeItem(item: any) {
    if (!item) return null;
    return {
      ...item,
      fileSizeBytes: item.fileSizeBytes !== undefined && item.fileSizeBytes !== null
        ? Number(item.fileSizeBytes)
        : null,
    };
  }

  /**
   * Create a new complaint media record
   */
  async create(
    organizationId: string,
    projectId: string,
    complaintId: string,
    data: {
      stageType?: any;
      mediaType: any;
      title?: string | null;
      description?: string | null;
      url: string;
      thumbnailUrl?: string | null;
      storageKey: string;
      storageProvider?: any;
      mimeType: string;
      fileSizeBytes?: bigint | number | null;
      durationSeconds?: number | null;
      width?: number | null;
      height?: number | null;
      takenAt?: Date | null;
      geoLatitude?: number | null;
      geoLongitude?: number | null;
      tags?: string[];
      isCover?: boolean;
      orderIndex?: number;
      uploadStatus?: any;
      uploadedById?: string | null;
      additionalInformation?: any;
    },
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      fileSizeBytes,
      takenAt,
      additionalInformation,
      ...rest
    } = data;

    const created = await db.projectComplaintMedia.create({
      data: {
        ...rest,
        organizationId,
        projectId,
        complaintId,
        ...(fileSizeBytes !== undefined && fileSizeBytes !== null && {
          fileSizeBytes: typeof fileSizeBytes === "bigint" ? fileSizeBytes : BigInt(Math.floor(fileSizeBytes)),
        }),
        ...(takenAt !== undefined && { takenAt }),
        ...(additionalInformation !== undefined && {
          additionalInformation: additionalInformation ? (additionalInformation as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
      },
      include: this.defaultIncludes,
    });

    return this.serializeItem(created);
  }

  /**
   * Confirm direct S3 upload completion
   */
  async confirmUpload(
    id: string,
    organizationId: string,
    data: ConfirmComplaintMediaUploadInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { fileSizeBytes, ...rest } = data;

    const updated = await db.projectComplaintMedia.update({
      where: { id, organizationId },
      data: {
        ...rest,
        ...(fileSizeBytes !== undefined && fileSizeBytes !== null && {
          fileSizeBytes: typeof fileSizeBytes === "bigint" ? fileSizeBytes : BigInt(Math.floor(fileSizeBytes)),
        }),
        updatedAt: new Date(),
      },
      include: this.defaultIncludes,
    });

    return this.serializeItem(updated);
  }

  /**
   * Find single complaint media asset by ID
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const item = await db.projectComplaintMedia.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: this.defaultIncludes,
    });

    return this.serializeItem(item);
  }

  /**
   * Find paginated list of media items with stageType (BEFORE / AFTER) filters
   */
  async findAll(
    organizationId: string,
    projectId: string,
    query: GetComplaintMediaQueryInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      complaintId,
      stageType,
      mediaType,
      uploadStatus = "COMPLETED",
      uploadedById,
      isCover,
      page = 1,
      limit = 50,
      sortBy = "orderIndex",
      sortOrder = "asc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectComplaintMediaWhereInput = {
      organizationId,
      projectId,
      isDeleted: false,
      ...(complaintId ? { complaintId } : {}),
      ...(stageType ? { stageType } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(uploadStatus ? { uploadStatus: uploadStatus as any } : {}),
      ...(uploadedById ? { uploadedById } : {}),
      ...(isCover !== undefined ? { isCover } : {}),
    };

    const [total, data] = await Promise.all([
      db.projectComplaintMedia.count({ where }),
      db.projectComplaintMedia.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: this.defaultIncludes,
      }),
    ]);

    return {
      data: data.map((item) => this.serializeItem(item)),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Partial update on media asset metadata
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateComplaintMediaInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { takenAt, additionalInformation, ...rest } = data;

    const updated = await db.projectComplaintMedia.update({
      where: { id, organizationId },
      data: {
        ...rest,
        ...(takenAt !== undefined && {
          takenAt: takenAt ? new Date(takenAt) : null,
        }),
        ...(additionalInformation !== undefined && {
          additionalInformation: additionalInformation
            ? (additionalInformation as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
        updatedAt: new Date(),
      },
      include: this.defaultIncludes,
    });

    return this.serializeItem(updated);
  }

  /**
   * Soft delete a complaint media asset
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    await db.projectComplaintMedia.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    return true;
  }
}

export const complaintMediaRepo = new ComplaintMediaRepository();

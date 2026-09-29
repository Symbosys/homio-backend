import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  ConfirmProgressMediaUploadInput,
  UpdateProgressMediaInput,
  GetProgressMediaQueryInput,
} from "../validators/progress-media.validator.js";

/**
 * Repository for managing Project Progress Media (images, videos, 360 panoramas, documents)
 */
export class ProgressMediaRepository {
  private readonly defaultIncludes: Prisma.ProjectProgressMediaInclude = {
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
    progress: {
      select: {
        id: true,
        progressDate: true,
        workStage: true,
        areaRoom: true,
        progressPercent: true,
        approvalStatus: true,
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
   * Create a new progress media record (used during S3 presigned generation or direct upload)
   */
  async create(
    organizationId: string,
    projectId: string,
    progressId: string,
    data: {
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

    const created = await db.projectProgressMedia.create({
      data: {
        ...rest,
        organizationId,
        projectId,
        progressId,
        ...(fileSizeBytes !== undefined && fileSizeBytes !== null && {
          fileSizeBytes: typeof fileSizeBytes === "bigint" ? fileSizeBytes : BigInt(Math.floor(fileSizeBytes)),
        }),
        ...(takenAt !== undefined && { takenAt }),
        ...(additionalInformation !== undefined && {
          additionalInformation: additionalInformation
            ? (additionalInformation as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
      },
      include: this.defaultIncludes,
    });

    return this.serializeItem(created);
  }

  /**
   * Confirm direct S3 upload completion and update technical specs
   */
  async confirmUpload(
    id: string,
    organizationId: string,
    data: ConfirmProgressMediaUploadInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { fileSizeBytes, ...rest } = data;

    const updated = await db.projectProgressMedia.update({
      where: { id, organizationId },
      data: {
        ...rest,
        ...(fileSizeBytes !== undefined && fileSizeBytes !== null && {
          fileSizeBytes: BigInt(Math.floor(fileSizeBytes)),
        }),
        uploadStatus: data.uploadStatus || "COMPLETED",
        updatedAt: new Date(),
      },
      include: this.defaultIncludes,
    });

    return this.serializeItem(updated);
  }

  /**
   * Find single progress media record by ID
   */
  async findById(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const item = await db.projectProgressMedia.findFirst({
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
   * List paginated media assets with multi-parameter filtering
   */
  async findAll(
    organizationId: string,
    projectId: string,
    query: GetProgressMediaQueryInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 50,
      progressId,
      mediaType,
      uploadStatus,
      isCover,
      search,
      startDate,
      endDate,
      sortBy = "orderIndex",
      sortOrder = "asc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectProgressMediaWhereInput = {
      organizationId,
      projectId,
      isDeleted: false,
      ...(progressId && { progressId }),
      ...(mediaType && { mediaType }),
      uploadStatus: uploadStatus || "COMPLETED",
      ...(isCover !== undefined && { isCover }),
      ...(startDate || endDate
        ? {
            takenAt: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { tags: { has: search } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      db.projectProgressMedia.count({ where }),
      db.projectProgressMedia.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: this.defaultIncludes,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    // Convert BigInt fileSizeBytes to Number safely for JSON transport
    const serializedItems = items.map((item) => this.serializeItem(item));

    return {
      data: serializedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Update progress media (Rule 5: Partial / Dirty update)
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateProgressMediaInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { takenAt, additionalInformation, ...directFields } = data;

    const updated = await db.projectProgressMedia.update({
      where: { id, organizationId },
      data: {
        ...directFields,
        ...(takenAt !== undefined && { takenAt: takenAt ? new Date(takenAt) : null }),
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
   * Soft delete a progress media record
   */
  async softDelete(
    id: string,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const updated = await db.projectProgressMedia.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    return this.serializeItem(updated);
  }

  /**
   * Find all active media assets for a progress entry (used for cascade cleanup)
   */
  async findByProgressId(
    progressId: string,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const items = await db.projectProgressMedia.findMany({
      where: {
        progressId,
        organizationId,
        isDeleted: false,
      },
    });

    return items.map((item) => this.serializeItem(item));
  }
}

export const progressMediaRepo = new ProgressMediaRepository();

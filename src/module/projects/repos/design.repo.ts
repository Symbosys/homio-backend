import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { z } from "zod";
import type {
  createDesignFolderSchema,
  updateDesignFolderSchema,
  getDesignFoldersQuerySchema,
  createProjectDesignSchema,
  updateProjectDesignSchema,
  getProjectDesignsQuerySchema,
  createDesignVersionSchema,
  updateDesignVersionSchema,
  createDesignAttachmentSchema,
  updateDesignAttachmentSchema,
  createDesignApprovalSchema,
  createDesignChangeRequestSchema,
  respondDesignChangeRequestSchema,
  getDesignChangeRequestsQuerySchema,
} from "../validators/design.validator.js";

type CreateFolderInput = z.infer<typeof createDesignFolderSchema>["body"];
type UpdateFolderInput = z.infer<typeof updateDesignFolderSchema>["body"];
type GetFoldersQueryInput = z.infer<typeof getDesignFoldersQuerySchema>["query"];

type CreateDesignInput = z.infer<typeof createProjectDesignSchema>["body"];
type UpdateDesignInput = z.infer<typeof updateProjectDesignSchema>["body"];
type GetDesignsQueryInput = z.infer<typeof getProjectDesignsQuerySchema>["query"];

type CreateVersionInput = z.infer<typeof createDesignVersionSchema>["body"];
type UpdateVersionInput = z.infer<typeof updateDesignVersionSchema>["body"];

type CreateAttachmentInput = z.infer<typeof createDesignAttachmentSchema>["body"];
type UpdateAttachmentInput = z.infer<typeof updateDesignAttachmentSchema>["body"];

type CreateApprovalInput = z.infer<typeof createDesignApprovalSchema>["body"];

type CreateChangeRequestInput = z.infer<typeof createDesignChangeRequestSchema>["body"];
type RespondChangeRequestInput = z.infer<typeof respondDesignChangeRequestSchema>["body"];
type GetChangeRequestsQueryInput = z.infer<typeof getDesignChangeRequestsQuerySchema>["query"];

export class DesignRepository {
  // ==========================================================================
  // 1. DESIGN FOLDERS
  // ==========================================================================

  async createFolder(organizationId: string, projectId: string, data: CreateFolderInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { coverImageUrl, metadata, ...directFields } = data;

    return db.projectDesignFolder.create({
      data: {
        ...directFields,
        organizationId,
        projectId,
        coverImageUrl: coverImageUrl ? (coverImageUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        parent: {
          select: { id: true, name: true, stage: true, roomType: true },
        },
        _count: {
          select: { children: true, designs: true },
        },
      },
    });
  }

  async findFolders(organizationId: string, projectId: string, query: GetFoldersQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { parentId, roomType, stage, search, tree } = query;

    const where: Prisma.ProjectDesignFolderWhereInput = {
      organizationId,
      projectId,
      isDeleted: false,
      ...(parentId !== undefined ? { parentId: parentId || null } : {}),
      ...(roomType ? { roomType: { contains: roomType, mode: "insensitive" } } : {}),
      ...(stage ? { stage } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { folderCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const folders = await db.projectDesignFolder.findMany({
      where,
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      include: {
        parent: {
          select: { id: true, name: true, stage: true, roomType: true },
        },
        children: tree === "true" ? {
          where: { isDeleted: false },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
          include: {
            _count: { select: { children: true, designs: true } },
          },
        } : false,
        _count: {
          select: { children: true, designs: true },
        },
      },
    });

    return folders;
  }

  async findFolderById(organizationId: string, projectId: string, id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectDesignFolder.findFirst({
      where: { id, projectId, organizationId, isDeleted: false },
      include: {
        parent: { select: { id: true, name: true, stage: true, roomType: true } },
        children: {
          where: { isDeleted: false },
          orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
          include: {
            _count: { select: { designs: true } },
          },
        },
        designs: {
          where: { isDeleted: false },
          take: 20,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            designCode: true,
            title: true,
            designType: true,
            status: true,
            currentVersionNumber: true,
            coverImageUrl: true,
            updatedAt: true,
          },
        },
        _count: {
          select: { children: true, designs: true },
        },
      },
    });
  }

  async updateFolder(organizationId: string, projectId: string, id: string, data: UpdateFolderInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { coverImageUrl, metadata, ...directFields } = data;

    return db.projectDesignFolder.update({
      where: { id },
      data: {
        ...directFields,
        ...(coverImageUrl !== undefined
          ? { coverImageUrl: coverImageUrl ? (coverImageUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(metadata !== undefined
          ? { metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { children: true, designs: true } },
      },
    });
  }

  async deleteFolder(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectDesignFolder.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  // ==========================================================================
  // 2. MASTER DESIGNS
  // ==========================================================================

  async createDesign(organizationId: string, projectId: string, data: CreateDesignInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { specifications, coverImageUrl, initialVersion, ...directFields } = data;

    return db.projectDesign.create({
      data: {
        ...directFields,
        organizationId,
        projectId,
        currentVersionNumber: 1,
        specifications: specifications ? (specifications as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        coverImageUrl: coverImageUrl ? (coverImageUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        versions: {
          create: {
            versionNumber: 1,
            versionCode: "v1.0",
            versionName: initialVersion?.versionName || "Initial Concept",
            changelog: initialVersion?.changelog || "Initial design upload",
            renderingEngine: initialVersion?.renderingEngine || null,
            resolution: initialVersion?.resolution || null,
            submissionNotes: initialVersion?.submissionNotes || null,
            status: "DRAFT",
            attachments: initialVersion?.attachments?.length
              ? {
                  create: initialVersion.attachments.map((att, idx) => ({
                    attachmentType: att.attachmentType,
                    title: att.title,
                    caption: att.caption || null,
                    description: att.description || null,
                    file: att.file ? (att.file as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                    externalUrl: att.externalUrl || null,
                    embedCode: att.embedCode || null,
                    thumbnail: att.thumbnail ? (att.thumbnail as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                    mimeType: att.mimeType || null,
                    fileSizeBytes: att.fileSizeBytes ? BigInt(att.fileSizeBytes) : null,
                    width: att.width || null,
                    height: att.height || null,
                    durationSeconds: att.durationSeconds || null,
                    isPrimary: att.isPrimary || idx === 0,
                    orderIndex: att.orderIndex ?? idx,
                    isClientVisible: att.isClientVisible ?? true,
                    metadata: att.metadata ? (att.metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                  })),
                }
              : undefined,
          },
        },
      },
      include: {
        folder: { select: { id: true, name: true, stage: true, roomType: true } },
        milestone: { select: { id: true, milestoneCode: true, name: true } },
        createdBy: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, avatarUrl: true },
        },
        versions: {
          include: {
            attachments: true,
          },
        },
      },
    });
  }

  async findDesigns(organizationId: string, projectId: string, query: GetDesignsQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      folderId,
      milestoneId,
      roomArea,
      designType,
      designStyle,
      status,
      priority,
      search,
      page = "1",
      limit = "20",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ProjectDesignWhereInput = {
      organizationId,
      projectId,
      isDeleted: false,
      ...(folderId ? { folderId } : {}),
      ...(milestoneId ? { milestoneId } : {}),
      ...(roomArea ? { roomArea: { contains: roomArea, mode: "insensitive" } } : {}),
      ...(designType ? { designType } : {}),
      ...(designStyle ? { designStyle: { contains: designStyle, mode: "insensitive" } } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { designCode: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { roomArea: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      db.projectDesign.count({ where }),
      db.projectDesign.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: sortOrder },
        include: {
          folder: { select: { id: true, name: true, stage: true, roomType: true } },
          milestone: { select: { id: true, milestoneCode: true, name: true } },
          createdBy: {
            select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, avatarUrl: true },
          },
          versions: {
            where: { isLocked: false },
            take: 1,
            orderBy: { versionNumber: "desc" },
            include: {
              attachments: { take: 3 },
            },
          },
          _count: {
            select: { versions: true },
          },
        },
      }),
    ]);

    return {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      data,
    };
  }

  async findDesignById(organizationId: string, projectId: string, id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectDesign.findFirst({
      where: { id, projectId, organizationId, isDeleted: false },
      include: {
        folder: { select: { id: true, name: true, stage: true, roomType: true, color: true } },
        milestone: { select: { id: true, milestoneCode: true, name: true, stage: true, status: true } },
        createdBy: {
          select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true, avatarUrl: true },
        },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            attachments: {
              orderBy: [{ isPrimary: "desc" }, { orderIndex: "asc" }],
            },
            approvals: {
              orderBy: { decidedAt: "desc" },
              include: {
                approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                customer: { select: { id: true, customerCode: true, displayName: true } },
              },
            },
            changeRequests: {
              orderBy: { createdAt: "desc" },
              include: {
                requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
                respondedBy: { select: { id: true, displayName: true, employeeCode: true } },
              },
            },
            submittedBy: {
              select: { id: true, displayName: true, employeeCode: true, avatarUrl: true },
            },
          },
        },
      },
    });
  }

  async updateDesign(id: string, data: UpdateDesignInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { specifications, coverImageUrl, ...directFields } = data;

    return db.projectDesign.update({
      where: { id },
      data: {
        ...directFields,
        ...(specifications !== undefined
          ? { specifications: specifications ? (specifications as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(coverImageUrl !== undefined
          ? { coverImageUrl: coverImageUrl ? (coverImageUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
      include: {
        folder: { select: { id: true, name: true } },
        milestone: { select: { id: true, name: true } },
      },
    });
  }

  async deleteDesign(id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectDesign.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  // ==========================================================================
  // 3. DESIGN VERSIONS
  // ==========================================================================

  async createVersion(
    designId: string,
    data: CreateVersionInput,
    nextVersionNumber: number,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { autoSubmit, attachments, ...directFields } = data;
    const versionCode = `v${nextVersionNumber}.0`;

    const version = await db.designVersion.create({
      data: {
        ...directFields,
        designId,
        versionNumber: nextVersionNumber,
        versionCode,
        status: autoSubmit ? "SUBMITTED" : "DRAFT",
        submittedAt: autoSubmit ? new Date() : null,
        attachments: attachments?.length
          ? {
              create: attachments.map((att, idx) => ({
                attachmentType: att.attachmentType,
                title: att.title,
                caption: att.caption || null,
                description: att.description || null,
                file: att.file ? (att.file as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                externalUrl: att.externalUrl || null,
                embedCode: att.embedCode || null,
                thumbnail: att.thumbnail ? (att.thumbnail as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                mimeType: att.mimeType || null,
                fileSizeBytes: att.fileSizeBytes ? BigInt(att.fileSizeBytes) : null,
                width: att.width || null,
                height: att.height || null,
                durationSeconds: att.durationSeconds || null,
                isPrimary: att.isPrimary || idx === 0,
                orderIndex: att.orderIndex ?? idx,
                isClientVisible: att.isClientVisible ?? true,
                metadata: att.metadata ? (att.metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              })),
            }
          : undefined,
      },
      include: {
        attachments: true,
        submittedBy: { select: { id: true, displayName: true, employeeCode: true } },
      },
    });

    // Update parent design's currentVersionNumber & status
    await db.projectDesign.update({
      where: { id: designId },
      data: {
        currentVersionNumber: nextVersionNumber,
        status: autoSubmit ? "SUBMITTED" : "DRAFT",
      },
    });

    return version;
  }

  async findVersions(designId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersion.findMany({
      where: { designId },
      orderBy: { versionNumber: "desc" },
      include: {
        attachments: {
          orderBy: [{ isPrimary: "desc" }, { orderIndex: "asc" }],
        },
        approvals: {
          orderBy: { decidedAt: "desc" },
          include: {
            approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: {
          select: { attachments: true, approvals: true, changeRequests: true },
        },
      },
    });
  }

  async findVersionById(designId: string, versionId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersion.findFirst({
      where: { id: versionId, designId },
      include: {
        attachments: {
          orderBy: [{ isPrimary: "desc" }, { orderIndex: "asc" }],
        },
        approvals: {
          orderBy: { decidedAt: "desc" },
          include: {
            approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            customer: { select: { id: true, customerCode: true, displayName: true } },
          },
        },
        changeRequests: {
          orderBy: { createdAt: "desc" },
          include: {
            requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
            respondedBy: { select: { id: true, displayName: true, employeeCode: true } },
          },
        },
        submittedBy: {
          select: { id: true, displayName: true, employeeCode: true, avatarUrl: true },
        },
      },
    });
  }

  async updateVersion(versionId: string, data: UpdateVersionInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersion.update({
      where: { id: versionId },
      data,
      include: {
        attachments: true,
      },
    });
  }

  async submitVersion(versionId: string, designId: string, submittedById?: string | null, submissionNotes?: string | null, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const now = new Date();

    const version = await db.designVersion.update({
      where: { id: versionId },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        submittedById: submittedById || undefined,
        submissionNotes: submissionNotes || undefined,
      },
    });

    await db.projectDesign.update({
      where: { id: designId },
      data: { status: "SUBMITTED" },
    });

    return version;
  }

  // ==========================================================================
  // 4. ATTACHMENTS
  // ==========================================================================

  async createAttachment(designVersionId: string, data: CreateAttachmentInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { file, thumbnail, metadata, fileSizeBytes, ...directFields } = data;

    return db.designVersionAttachment.create({
      data: {
        ...directFields,
        designVersionId,
        file: file ? (file as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        thumbnail: thumbnail ? (thumbnail as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        fileSizeBytes: fileSizeBytes ? BigInt(fileSizeBytes) : null,
      },
    });
  }

  async findAttachments(designVersionId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersionAttachment.findMany({
      where: { designVersionId },
      orderBy: [{ isPrimary: "desc" }, { orderIndex: "asc" }, { createdAt: "asc" }],
    });
  }

  async findAttachmentById(designVersionId: string, attachmentId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersionAttachment.findFirst({
      where: { id: attachmentId, designVersionId },
    });
  }

  async updateAttachment(designVersionId: string, attachmentId: string, data: UpdateAttachmentInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { thumbnail, metadata, ...directFields } = data;

    return db.designVersionAttachment.update({
      where: { id: attachmentId },
      data: {
        ...directFields,
        ...(thumbnail !== undefined
          ? { thumbnail: thumbnail ? (thumbnail as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
        ...(metadata !== undefined
          ? { metadata: metadata ? (metadata as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
          : {}),
      },
    });
  }

  async deleteAttachment(attachmentId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersionAttachment.delete({
      where: { id: attachmentId },
    });
  }

  // ==========================================================================
  // 5. CLIENT APPROVALS
  // ==========================================================================

  async createApproval(
    organizationId: string,
    projectId: string,
    designVersionId: string,
    approvedByUserId: string,
    data: CreateApprovalInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { scopeChecklist, digitalSignature, signedDocumentUrl, decision, ...directFields } = data;

    const approval = await db.designVersionApproval.create({
      data: {
        ...directFields,
        decision,
        organizationId,
        projectId,
        designVersionId,
        approvedByUserId,
        scopeChecklist: scopeChecklist ? (scopeChecklist as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        digitalSignature: digitalSignature ? (digitalSignature as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        signedDocumentUrl: signedDocumentUrl ? (signedDocumentUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        customer: { select: { id: true, customerCode: true, displayName: true } },
      },
    });

    // If APPROVED or APPROVED_WITH_CONDITIONS, lock version & update master design
    if (decision === "APPROVED" || decision === "APPROVED_WITH_CONDITIONS") {
      await db.designVersion.update({
        where: { id: designVersionId },
        data: {
          status: "APPROVED",
          isLocked: true,
          lockedAt: new Date(),
        },
      });

      // Find design to update its master status
      const version = await db.designVersion.findUnique({
        where: { id: designVersionId },
        select: { designId: true },
      });

      if (version) {
        await db.projectDesign.update({
          where: { id: version.designId },
          data: { status: "APPROVED" },
        });
      }
    } else if (decision === "REJECTED") {
      await db.designVersion.update({
        where: { id: designVersionId },
        data: { status: "REJECTED" },
      });

      const version = await db.designVersion.findUnique({
        where: { id: designVersionId },
        select: { designId: true },
      });

      if (version) {
        await db.projectDesign.update({
          where: { id: version.designId },
          data: { status: "REJECTED" },
        });
      }
    } else if (decision === "CHANGES_REQUESTED") {
      await db.designVersion.update({
        where: { id: designVersionId },
        data: { status: "CHANGES_REQUESTED" },
      });

      const version = await db.designVersion.findUnique({
        where: { id: designVersionId },
        select: { designId: true },
      });

      if (version) {
        await db.projectDesign.update({
          where: { id: version.designId },
          data: { status: "CHANGES_REQUESTED" },
        });
      }
    }

    return approval;
  }

  async findApprovals(designVersionId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designVersionApproval.findMany({
      where: { designVersionId },
      orderBy: { decidedAt: "desc" },
      include: {
        approvedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        customer: { select: { id: true, customerCode: true, displayName: true } },
      },
    });
  }

  // ==========================================================================
  // 6. CHANGE REQUESTS
  // ==========================================================================

  async createChangeRequest(
    designVersionId: string,
    requestedByUserId: string | null,
    data: CreateChangeRequestInput,
    nextRequestNumber: number,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { pinAnnotations, referenceAttachments, ...directFields } = data;

    const changeRequest = await db.designChangeRequest.create({
      data: {
        ...directFields,
        designVersionId,
        requestedByUserId,
        requestNumber: nextRequestNumber,
        status: "PENDING",
        pinAnnotations: pinAnnotations ? (pinAnnotations as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        referenceAttachments: referenceAttachments
          ? (referenceAttachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Update version & design status to CHANGES_REQUESTED
    await db.designVersion.update({
      where: { id: designVersionId },
      data: { status: "CHANGES_REQUESTED" },
    });

    const version = await db.designVersion.findUnique({
      where: { id: designVersionId },
      select: { designId: true },
    });

    if (version) {
      await db.projectDesign.update({
        where: { id: version.designId },
        data: { status: "CHANGES_REQUESTED" },
      });
    }

    return changeRequest;
  }

  async findChangeRequests(designVersionId: string, query: GetChangeRequestsQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { status, category } = query;

    return db.designChangeRequest.findMany({
      where: {
        designVersionId,
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: [{ requestNumber: "desc" }, { createdAt: "desc" }],
      include: {
        requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        respondedBy: { select: { id: true, displayName: true, employeeCode: true } },
      },
    });
  }

  async findChangeRequestById(designVersionId: string, changeRequestId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.designChangeRequest.findFirst({
      where: { id: changeRequestId, designVersionId },
      include: {
        requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        respondedBy: { select: { id: true, displayName: true, employeeCode: true } },
      },
    });
  }

  async respondChangeRequest(
    changeRequestId: string,
    data: RespondChangeRequestInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.designChangeRequest.update({
      where: { id: changeRequestId },
      data: {
        ...data,
        respondedAt: new Date(),
      },
      include: {
        requestedByUser: { select: { id: true, firstName: true, lastName: true, email: true } },
        respondedBy: { select: { id: true, displayName: true, employeeCode: true } },
      },
    });
  }
}

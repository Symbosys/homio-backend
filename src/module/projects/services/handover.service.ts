import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType, Prisma } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { handoverRepository, HandoverRepository } from "../repos/handover.repo.js";
import type {
  CreateHandoverInput,
  UpdateHandoverInput,
  UpdateHandoverStatusInput,
  CommercialClearanceInput,
  HandoverSignoffInput,
  CreateHandoverItemInput,
  UpdateHandoverItemInput,
  UpdateHandoverItemStatusInput,
  BulkHandoverItemsInput,
  CreateHandoverSnagInput,
  UpdateHandoverSnagInput,
  ResolveHandoverSnagInput,
  VerifyHandoverSnagInput,
  GetHandoversQueryInput,
  GetHandoverItemsQueryInput,
  GetHandoverSnagsQueryInput,
} from "../validators/handover.validator.js";

interface HandoverFiles {
  warrantyDoc?: Express.Multer.File[];
  certificate?: Express.Multer.File[];
  signature?: Express.Multer.File[];
  sitePhotos?: Express.Multer.File[];
}

interface ItemFiles {
  document?: Express.Multer.File[];
}

interface SnagFiles {
  beforePhoto?: Express.Multer.File[];
  afterPhoto?: Express.Multer.File[];
}

export class HandoverService {
  constructor(private readonly repo: HandoverRepository = handoverRepository) {}

  /**
   * Helper to upload file buffer through cloud StorageService
   */
  private async uploadToCloud(
    file: Express.Multer.File,
    folder: string,
    resourceType: "image" | "raw" | "auto" = "auto"
  ): Promise<ImageType> {
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder, resourceType }
    );

    return {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };
  }

  /**
   * Create a new Project Handover with multi-cloud file uploads
   */
  async createHandover(
    organizationId: string,
    input: CreateHandoverInput,
    files?: HandoverFiles
  ) {
    // 1. Verify Project belongs to Tenant
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found in this organization", statusCode.Not_Found);
    }

    // 2. Resolve Customer ID (fallback to project customer)
    const customerId = input.customerId || project.customerId;

    // 3. Generate sequential Handover Number if not provided
    const handoverNumber =
      input.handoverNumber || (await this.repo.generateNextHandoverNumber(organizationId));

    // 4. Process Cloud File Uploads (Frontend never sends raw URLs)
    let warrantyDocumentUrl: ImageType | undefined = undefined;
    let handoverCertificateUrl: ImageType | undefined = undefined;
    let clientSignatureUrl: ImageType | undefined = undefined;
    let sitePhotos: ImageType[] = [];

    if (files?.warrantyDoc?.[0]) {
      warrantyDocumentUrl = await this.uploadToCloud(
        files.warrantyDoc[0],
        "homio/projects/handovers/warranties",
        "raw"
      );
    }

    if (files?.certificate?.[0]) {
      handoverCertificateUrl = await this.uploadToCloud(
        files.certificate[0],
        "homio/projects/handovers/certificates",
        "raw"
      );
    }

    if (files?.signature?.[0]) {
      clientSignatureUrl = await this.uploadToCloud(
        files.signature[0],
        "homio/projects/handovers/signatures",
        "image"
      );
    }

    if (files?.sitePhotos && files.sitePhotos.length > 0) {
      for (const photo of files.sitePhotos) {
        const uploaded = await this.uploadToCloud(
          photo,
          "homio/projects/handovers/photos",
          "image"
        );
        sitePhotos.push(uploaded);
      }
    }

    // 5. Construct UncheckedCreateInput
    const createData: Prisma.ProjectHandoverUncheckedCreateInput = {
      organizationId,
      projectId: input.projectId,
      customerId,
      handoverNumber,
      title: input.title,
      description: input.description ?? null,
      status: input.status,
      scheduledDate: input.scheduledDate ? new Date(input.scheduledDate) : null,
      inspectedDate: input.inspectedDate ? new Date(input.inspectedDate) : null,
      handoverDate: input.handoverDate ? new Date(input.handoverDate) : null,
      isCommercialCleared: input.isCommercialCleared,
      finalSettlementAmount: input.finalSettlementAmount !== null && input.finalSettlementAmount !== undefined
        ? new Prisma.Decimal(input.finalSettlementAmount)
        : null,
      pendingAmount: input.pendingAmount !== null && input.pendingAmount !== undefined
        ? new Prisma.Decimal(input.pendingAmount)
        : new Prisma.Decimal(0),
      commercialRemarks: input.commercialRemarks ?? null,
      warrantyPeriodMonths: input.warrantyPeriodMonths,
      warrantyStartDate: input.warrantyStartDate ? new Date(input.warrantyStartDate) : null,
      warrantyEndDate: input.warrantyEndDate ? new Date(input.warrantyEndDate) : null,
      warrantyTerms: input.warrantyTerms ?? null,
      warrantyDocumentUrl: warrantyDocumentUrl
        ? (warrantyDocumentUrl as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      handedOverById: input.handedOverById ?? null,
      handoverCertificateUrl: handoverCertificateUrl
        ? (handoverCertificateUrl as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      clientSignatureUrl: clientSignatureUrl
        ? (clientSignatureUrl as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      sitePhotos: sitePhotos.length > 0
        ? (sitePhotos as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      additionalInformation: input.additionalInformation
        ? (input.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    };

    // 6. Map optional batch initial items and snags
    const initialItems: Prisma.ProjectHandoverItemUncheckedCreateWithoutHandoverInput[] = (
      input.items || []
    ).map((item) => ({
      category: item.category,
      name: item.name,
      description: item.description ?? null,
      quantity: item.quantity,
      unit: item.unit,
      status: item.status,
      handedOverAt: item.handedOverAt ? new Date(item.handedOverAt) : null,
      recipientName: item.recipientName ?? null,
      notes: item.notes ?? null,
      additionalInformation: item.additionalInformation
        ? (item.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    }));

    const initialSnags: Prisma.ProjectHandoverSnagUncheckedCreateWithoutHandoverInput[] = (
      input.snags || []
    ).map((snag) => ({
      complaintId: snag.complaintId ?? null,
      areaRoom: snag.areaRoom ?? null,
      title: snag.title,
      description: snag.description ?? null,
      severity: snag.severity,
      status: snag.status,
      assignedToId: snag.assignedToId ?? null,
      targetResolutionDate: snag.targetResolutionDate ? new Date(snag.targetResolutionDate) : null,
      additionalInformation: snag.additionalInformation
        ? (snag.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    }));

    return this.repo.createHandover(createData, initialItems, initialSnags);
  }

  /**
   * Fetch paginated list of handovers
   */
  async getHandovers(organizationId: string, filter: GetHandoversQueryInput) {
    return this.repo.findHandovers(organizationId, filter);
  }

  /**
   * Fetch single Handover details by ID
   */
  async getHandoverById(id: string, organizationId: string) {
    const handover = await this.repo.findHandoverById(id, organizationId);
    if (!handover) {
      throw new ErrorResponse("Project handover record not found", statusCode.Not_Found);
    }
    return handover;
  }

  /**
   * Partial update of Handover record with optional file replacements
   */
  async updateHandover(
    id: string,
    organizationId: string,
    input: UpdateHandoverInput,
    files?: HandoverFiles
  ) {
    await this.getHandoverById(id, organizationId);

    const updateData: Prisma.ProjectHandoverUncheckedUpdateInput = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.scheduledDate !== undefined) {
      updateData.scheduledDate = input.scheduledDate ? new Date(input.scheduledDate) : null;
    }
    if (input.inspectedDate !== undefined) {
      updateData.inspectedDate = input.inspectedDate ? new Date(input.inspectedDate) : null;
    }
    if (input.handoverDate !== undefined) {
      updateData.handoverDate = input.handoverDate ? new Date(input.handoverDate) : null;
    }
    if (input.isCommercialCleared !== undefined) {
      updateData.isCommercialCleared = input.isCommercialCleared;
    }
    if (input.finalSettlementAmount !== undefined) {
      updateData.finalSettlementAmount = input.finalSettlementAmount !== null
        ? new Prisma.Decimal(input.finalSettlementAmount)
        : null;
    }
    if (input.pendingAmount !== undefined) {
      updateData.pendingAmount = input.pendingAmount !== null
        ? new Prisma.Decimal(input.pendingAmount)
        : null;
    }
    if (input.commercialRemarks !== undefined) updateData.commercialRemarks = input.commercialRemarks;
    if (input.warrantyPeriodMonths !== undefined) updateData.warrantyPeriodMonths = input.warrantyPeriodMonths;
    if (input.warrantyStartDate !== undefined) {
      updateData.warrantyStartDate = input.warrantyStartDate ? new Date(input.warrantyStartDate) : null;
    }
    if (input.warrantyEndDate !== undefined) {
      updateData.warrantyEndDate = input.warrantyEndDate ? new Date(input.warrantyEndDate) : null;
    }
    if (input.warrantyTerms !== undefined) updateData.warrantyTerms = input.warrantyTerms;
    if (input.handedOverById !== undefined) updateData.handedOverById = input.handedOverById;
    if (input.additionalInformation !== undefined) {
      updateData.additionalInformation = input.additionalInformation
        ? (input.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    // Process file replacements
    if (files?.warrantyDoc?.[0]) {
      const uploaded = await this.uploadToCloud(
        files.warrantyDoc[0],
        "homio/projects/handovers/warranties",
        "raw"
      );
      updateData.warrantyDocumentUrl = uploaded as unknown as Prisma.InputJsonValue;
    }

    if (files?.certificate?.[0]) {
      const uploaded = await this.uploadToCloud(
        files.certificate[0],
        "homio/projects/handovers/certificates",
        "raw"
      );
      updateData.handoverCertificateUrl = uploaded as unknown as Prisma.InputJsonValue;
    }

    return this.repo.updateHandover(id, organizationId, updateData);
  }

  /**
   * Compute comprehensive pre-handover readiness audit and metrics
   */
  async getHandoverReadiness(id: string, organizationId: string) {
    await this.getHandoverById(id, organizationId);
    const summary = await this.repo.getHandoverSummary(id, organizationId);
    if (!summary) {
      throw new ErrorResponse("Failed to compute handover readiness metrics", statusCode.Internal_Server_Error);
    }
    return summary;
  }

  /**
   * Transition Handover Status (and cascade project status)
   */
  async updateHandoverStatus(
    id: string,
    organizationId: string,
    input: UpdateHandoverStatusInput
  ) {
    const handover = await this.getHandoverById(id, organizationId);

    const updateData: Prisma.ProjectHandoverUncheckedUpdateInput = {
      status: input.status,
    };

    // Cascade update to parent Project when handover reaches final states
    if (input.status === "ACCEPTED" || input.status === "COMPLETED") {
      updateData.handoverDate = new Date();
      await prisma.project.update({
        where: { id: handover.projectId },
        data: {
          status: input.status === "COMPLETED" ? "COMPLETED" : "HANDOVER",
          currentStage: input.status === "COMPLETED" ? "AFTER_SALES" : "HANDOVER",
        },
      });
    }

    return this.repo.updateHandover(id, organizationId, updateData);
  }

  // Alias for backward compatibility
  async updateStatus(
    id: string,
    organizationId: string,
    input: UpdateHandoverStatusInput
  ) {
    return this.updateHandoverStatus(id, organizationId, input);
  }

  /**
   * Update Commercial Clearance
   */
  async updateCommercialClearance(
    id: string,
    organizationId: string,
    input: CommercialClearanceInput
  ) {
    await this.getHandoverById(id, organizationId);

    return this.repo.updateHandover(id, organizationId, {
      isCommercialCleared: input.isCommercialCleared,
      ...(input.finalSettlementAmount !== undefined && {
        finalSettlementAmount: new Prisma.Decimal(input.finalSettlementAmount),
      }),
      ...(input.pendingAmount !== undefined && {
        pendingAmount: new Prisma.Decimal(input.pendingAmount),
      }),
      ...(input.commercialRemarks !== undefined && {
        commercialRemarks: input.commercialRemarks,
      }),
    });
  }

  /**
   * Formal Client Sign-off & Digital Touch Signature
   */
  async clientSignoff(
    id: string,
    organizationId: string,
    input: HandoverSignoffInput,
    files?: HandoverFiles
  ) {
    const handover = await this.getHandoverById(id, organizationId);

    let clientSignatureUrl: ImageType | undefined = undefined;
    let handoverCertificateUrl: ImageType | undefined = undefined;
    const sitePhotos: ImageType[] = [];

    if (files?.signature?.[0]) {
      clientSignatureUrl = await this.uploadToCloud(
        files.signature[0],
        "homio/projects/handovers/signatures",
        "image"
      );
    }

    if (files?.certificate?.[0]) {
      handoverCertificateUrl = await this.uploadToCloud(
        files.certificate[0],
        "homio/projects/handovers/certificates",
        "raw"
      );
    }

    if (files?.sitePhotos && files.sitePhotos.length > 0) {
      for (const photo of files.sitePhotos) {
        const uploaded = await this.uploadToCloud(
          photo,
          "homio/projects/handovers/photos",
          "image"
        );
        sitePhotos.push(uploaded);
      }
    }

    const existingPhotos = Array.isArray(handover.sitePhotos)
      ? (handover.sitePhotos as unknown as ImageType[])
      : [];

    const mergedPhotos = [...existingPhotos, ...sitePhotos];

    const updateData: Prisma.ProjectHandoverUncheckedUpdateInput = {
      clientSignoffName: input.clientSignoffName,
      clientSignedAt: input.clientSignedAt ? new Date(input.clientSignedAt) : new Date(),
      clientFeedback: input.clientFeedback ?? null,
      clientRating: input.clientRating ?? null,
      status: "ACCEPTED",
      handoverDate: new Date(),
      ...(clientSignatureUrl && {
        clientSignatureUrl: clientSignatureUrl as unknown as Prisma.InputJsonValue,
      }),
      ...(handoverCertificateUrl && {
        handoverCertificateUrl: handoverCertificateUrl as unknown as Prisma.InputJsonValue,
      }),
      ...(mergedPhotos.length > 0 && {
        sitePhotos: mergedPhotos as unknown as Prisma.InputJsonValue,
      }),
      ...(input.additionalInformation && {
        additionalInformation: input.additionalInformation as unknown as Prisma.InputJsonValue,
      }),
    };

    // Cascade update to parent Project
    await prisma.project.update({
      where: { id: handover.projectId },
      data: {
        status: "HANDOVER",
        currentStage: "HANDOVER",
        clientRating: input.clientRating ?? undefined,
        clientFeedback: input.clientFeedback ?? undefined,
      },
    });

    return this.repo.updateHandover(id, organizationId, updateData);
  }

  /**
   * Bulk upload additional site handover photos
   */
  async uploadPhotos(
    id: string,
    organizationId: string,
    photos: Express.Multer.File[]
  ) {
    const handover = await this.getHandoverById(id, organizationId);
    if (!photos || photos.length === 0) {
      throw new ErrorResponse("At least one photo file is required", statusCode.Bad_Request);
    }

    const newPhotos: ImageType[] = [];
    for (const photo of photos) {
      const uploaded = await this.uploadToCloud(
        photo,
        "homio/projects/handovers/photos",
        "image"
      );
      newPhotos.push(uploaded);
    }

    const existingPhotos = Array.isArray(handover.sitePhotos)
      ? (handover.sitePhotos as unknown as ImageType[])
      : [];

    const merged = [...existingPhotos, ...newPhotos];

    return this.repo.updateHandover(id, organizationId, {
      sitePhotos: merged as unknown as Prisma.InputJsonValue,
    });
  }

  /**
   * Soft delete a handover record
   */
  async deleteHandover(id: string, organizationId: string) {
    await this.getHandoverById(id, organizationId);
    return this.repo.deleteHandover(id, organizationId);
  }

  /**
   * Get Handover Summary & Readiness Analytics
   */
  async getHandoverSummary(id: string, organizationId: string) {
    const summary = await this.repo.getHandoverSummary(id, organizationId);
    if (!summary) {
      throw new ErrorResponse("Handover not found", statusCode.Not_Found);
    }
    return summary;
  }

  // ==========================================
  // DELIVERABLES / ITEMS SERVICE METHODS
  // ==========================================

  async getItems(handoverId: string, organizationId: string, filter?: GetHandoverItemsQueryInput) {
    await this.getHandoverById(handoverId, organizationId);
    return this.repo.findItems(handoverId, filter);
  }

  async getItemById(handoverId: string, itemId: string, organizationId: string) {
    await this.getHandoverById(handoverId, organizationId);
    const item = await this.repo.findItemById(itemId, handoverId);
    if (!item) {
      throw new ErrorResponse("Handover item not found", statusCode.Not_Found);
    }
    return item;
  }

  async addItem(
    handoverId: string,
    organizationId: string,
    input: CreateHandoverItemInput,
    files?: ItemFiles
  ) {
    await this.getHandoverById(handoverId, organizationId);

    let documentUrl: ImageType | undefined = undefined;
    if (files?.document?.[0]) {
      documentUrl = await this.uploadToCloud(
        files.document[0],
        "homio/projects/handovers/items",
        "raw"
      );
    }

    return this.repo.createItem({
      handoverId,
      category: input.category,
      name: input.name,
      description: input.description ?? null,
      quantity: input.quantity,
      unit: input.unit,
      status: input.status,
      handedOverAt: input.handedOverAt ? new Date(input.handedOverAt) : null,
      recipientName: input.recipientName ?? null,
      documentUrl: documentUrl
        ? (documentUrl as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      notes: input.notes ?? null,
      additionalInformation: input.additionalInformation
        ? (input.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    });
  }

  async updateItem(
    handoverId: string,
    itemId: string,
    organizationId: string,
    input: UpdateHandoverItemInput,
    files?: ItemFiles
  ) {
    await this.getItemById(handoverId, itemId, organizationId);

    const updateData: Prisma.ProjectHandoverItemUncheckedUpdateInput = {};

    if (input.category !== undefined) updateData.category = input.category;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.quantity !== undefined) updateData.quantity = input.quantity;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.handedOverAt !== undefined) {
      updateData.handedOverAt = input.handedOverAt ? new Date(input.handedOverAt) : null;
    }
    if (input.recipientName !== undefined) updateData.recipientName = input.recipientName;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.additionalInformation !== undefined) {
      updateData.additionalInformation = input.additionalInformation
        ? (input.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    if (files?.document?.[0]) {
      const uploaded = await this.uploadToCloud(
        files.document[0],
        "homio/projects/handovers/items",
        "raw"
      );
      updateData.documentUrl = uploaded as unknown as Prisma.InputJsonValue;
    }

    return this.repo.updateItem(itemId, updateData);
  }

  async updateItemStatus(
    handoverId: string,
    itemId: string,
    organizationId: string,
    input: UpdateHandoverItemStatusInput
  ) {
    await this.getItemById(handoverId, itemId, organizationId);

    return this.repo.updateItem(itemId, {
      status: input.status,
      handedOverAt: input.handedOverAt
        ? new Date(input.handedOverAt)
        : input.status === "HANDED_OVER"
        ? new Date()
        : null,
      ...(input.recipientName !== undefined && { recipientName: input.recipientName }),
      ...(input.notes !== undefined && { notes: input.notes }),
    });
  }

  async bulkHandoverItems(
    handoverId: string,
    organizationId: string,
    input: BulkHandoverItemsInput
  ) {
    await this.getHandoverById(handoverId, organizationId);

    await this.repo.bulkUpdateItems(handoverId, input.itemIds, {
      status: "HANDED_OVER",
      handedOverAt: new Date(),
      recipientName: input.recipientName,
      ...(input.notes && { notes: input.notes }),
    });

    return { success: true, count: input.itemIds.length };
  }

  async deleteItem(handoverId: string, itemId: string, organizationId: string) {
    await this.getItemById(handoverId, itemId, organizationId);
    return this.repo.deleteItem(itemId);
  }

  // ==========================================
  // PRE-HANDOVER SNAG SERVICE METHODS
  // ==========================================

  async getSnags(handoverId: string, organizationId: string, filter?: GetHandoverSnagsQueryInput) {
    await this.getHandoverById(handoverId, organizationId);
    return this.repo.findSnags(handoverId, filter);
  }

  async getSnagById(handoverId: string, snagId: string, organizationId: string) {
    await this.getHandoverById(handoverId, organizationId);
    const snag = await this.repo.findSnagById(snagId, handoverId);
    if (!snag) {
      throw new ErrorResponse("Handover snag not found", statusCode.Not_Found);
    }
    return snag;
  }

  async addSnag(
    handoverId: string,
    organizationId: string,
    input: CreateHandoverSnagInput,
    files?: SnagFiles
  ) {
    await this.getHandoverById(handoverId, organizationId);

    let beforePhotoUrl: ImageType | undefined = undefined;
    if (files?.beforePhoto?.[0]) {
      beforePhotoUrl = await this.uploadToCloud(
        files.beforePhoto[0],
        "homio/projects/handovers/snags/before",
        "image"
      );
    }

    return this.repo.createSnag({
      handoverId,
      complaintId: input.complaintId ?? null,
      areaRoom: input.areaRoom ?? null,
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      status: input.status,
      assignedToId: input.assignedToId ?? null,
      targetResolutionDate: input.targetResolutionDate ? new Date(input.targetResolutionDate) : null,
      beforePhotoUrl: beforePhotoUrl
        ? (beforePhotoUrl as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      additionalInformation: input.additionalInformation
        ? (input.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
    });
  }

  async updateSnag(
    handoverId: string,
    snagId: string,
    organizationId: string,
    input: UpdateHandoverSnagInput,
    files?: SnagFiles
  ) {
    await this.getSnagById(handoverId, snagId, organizationId);

    const updateData: Prisma.ProjectHandoverSnagUncheckedUpdateInput = {};

    if (input.complaintId !== undefined) updateData.complaintId = input.complaintId;
    if (input.areaRoom !== undefined) updateData.areaRoom = input.areaRoom;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.severity !== undefined) updateData.severity = input.severity;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.assignedToId !== undefined) updateData.assignedToId = input.assignedToId;
    if (input.targetResolutionDate !== undefined) {
      updateData.targetResolutionDate = input.targetResolutionDate
        ? new Date(input.targetResolutionDate)
        : null;
    }
    if (input.additionalInformation !== undefined) {
      updateData.additionalInformation = input.additionalInformation
        ? (input.additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    if (files?.beforePhoto?.[0]) {
      const uploaded = await this.uploadToCloud(
        files.beforePhoto[0],
        "homio/projects/handovers/snags/before",
        "image"
      );
      updateData.beforePhotoUrl = uploaded as unknown as Prisma.InputJsonValue;
    }

    return this.repo.updateSnag(snagId, updateData);
  }

  async resolveSnag(
    handoverId: string,
    snagId: string,
    organizationId: string,
    input: ResolveHandoverSnagInput,
    files?: SnagFiles
  ) {
    await this.getSnagById(handoverId, snagId, organizationId);

    let afterPhotoUrl: ImageType | undefined = undefined;
    if (files?.afterPhoto?.[0]) {
      afterPhotoUrl = await this.uploadToCloud(
        files.afterPhoto[0],
        "homio/projects/handovers/snags/after",
        "image"
      );
    }

    const updateData: Prisma.ProjectHandoverSnagUncheckedUpdateInput = {
      status: "RESOLVED",
      resolvedNotes: input.resolvedNotes,
      resolvedAt: input.resolvedAt ? new Date(input.resolvedAt) : new Date(),
      ...(afterPhotoUrl && {
        afterPhotoUrl: afterPhotoUrl as unknown as Prisma.InputJsonValue,
      }),
    };

    return this.repo.updateSnag(snagId, updateData);
  }

  async verifySnag(
    handoverId: string,
    snagId: string,
    organizationId: string,
    input: VerifyHandoverSnagInput
  ) {
    await this.getSnagById(handoverId, snagId, organizationId);

    return this.repo.updateSnag(snagId, {
      status: input.status,
      ...(input.verificationNotes && {
        resolvedNotes: input.verificationNotes,
      }),
    });
  }

  async deleteSnag(handoverId: string, snagId: string, organizationId: string) {
    await this.getSnagById(handoverId, snagId, organizationId);
    return this.repo.deleteSnag(snagId);
  }
}

export const handoverService = new HandoverService();

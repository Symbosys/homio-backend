import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateMaterialRequestInput,
  UpdateMaterialRequestInput,
  CreateMaterialRequestItemInput,
  UpdateMaterialRequestItemInput,
  GetMaterialRequestsQueryInput,
} from "../validators/material-request.validator.js";

const materialRequestItemInclude = {
  materialProduct: {
    select: {
      id: true,
      name: true,
      sku: true,
      unitOfMeasure: true,
      coverImageUrl: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

const materialRequestDetailInclude = {
  project: {
    select: {
      id: true,
      name: true,
      projectCode: true,
      status: true,
      site: {
        select: {
          siteName: true,
          address: true,
          city: true,
          state: true,
          pincode: true,
        },
      },
    },
  },
  requestedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  items: {
    include: materialRequestItemInclude,
    orderBy: { createdAt: "asc" as const },
  },
  _count: {
    select: {
      rfqs: true,
      quotations: true,
      dispatches: true,
    },
  },
};

/**
 * Repository handling database operations for Material Requests and line items
 */
export class MaterialRequestRepository {
  /**
   * Auto-generate sequential, tenant-scoped Request Number e.g. "MR-2026-0001"
   */
  async generateRequestNumber(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `MR-${currentYear}-`;

    const latest = await db.materialRequest.findFirst({
      where: {
        organizationId,
        requestNumber: { startsWith: prefix },
      },
      orderBy: { requestNumber: "desc" },
      select: { requestNumber: true },
    });

    let nextNumber = 1;
    if (latest?.requestNumber) {
      const parts = latest.requestNumber.split("-");
      const seqStr = parts[2];
      if (seqStr) {
        const lastSeq = parseInt(seqStr, 10);
        if (!isNaN(lastSeq)) {
          nextNumber = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }

  /**
   * Safely resolve User ID from either a User ID or an Employee ID
   */
  private async resolveUserId(
    id: string | null | undefined,
    organizationId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string | null> {
    if (!id) return null;
    const db = tx || prisma;

    // 1. Direct User lookup
    const user = await db.user.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: { id: true },
    });
    if (user) return user.id;

    // 2. Employee with linked User lookup
    const emp = await db.employee.findFirst({
      where: { id, organizationId, isDeleted: false },
      select: { userId: true },
    });
    if (emp && emp.userId) {
      const linkedUser = await db.user.findFirst({
        where: { id: emp.userId, organizationId, isDeleted: false },
        select: { id: true },
      });
      if (linkedUser) return linkedUser.id;
    }

    return null;
  }

  /**
   * Create a new Material Request with line items in an atomic transaction
   */
  async create(organizationId: string, data: CreateMaterialRequestInput) {
    return prisma.$transaction(async (tx) => {
      const requestNumber =
        data.requestNumber || (await this.generateRequestNumber(organizationId, tx));

      const { items, ...headerData } = data;

      // Calculate total estimated cost if not manually provided
      let totalEstimatedCost = Number(headerData.estimatedCost || 0);
      if (totalEstimatedCost === 0 && items && items.length > 0) {
        totalEstimatedCost = items.reduce((acc, item) => {
          const qty = Number(item.quantity || 0);
          const rate = Number(item.estimatedRate || 0);
          const amount = item.estimatedAmount !== undefined ? Number(item.estimatedAmount) : qty * rate;
          return acc + amount;
        }, 0);
      }

      const requestedById = await this.resolveUserId(headerData.requestedById, organizationId, tx);
      const approvedById = await this.resolveUserId(headerData.approvedById, organizationId, tx);

      const createData: Prisma.MaterialRequestUncheckedCreateInput = {
        organizationId,
        projectId: headerData.projectId,
        requestNumber,
        requestDate: headerData.requestDate ? new Date(headerData.requestDate) : new Date(),
        requiredByDate: new Date(headerData.requiredByDate),
        priority: headerData.priority,
        status: headerData.status,
        siteLocation: headerData.siteLocation || null,
        category: headerData.category || null,
        reason: headerData.reason || null,
        notes: headerData.notes || null,
        estimatedCost: totalEstimatedCost,
        approvedCost: headerData.approvedCost || 0,
        requestedById,
        approvedById,
        additionalInformation: (headerData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        items: items && items.length > 0
          ? {
              create: items.map((item) => ({
                organizationId,
                materialProductId: item.materialProductId || null,
                name: item.name,
                sku: item.sku || null,
                brand: item.brand || null,
                specifications: item.specifications || null,
                dimensions: item.dimensions || null,
                quantity: item.quantity,
                unit: item.unit,
                estimatedRate: item.estimatedRate || 0,
                estimatedAmount:
                  item.estimatedAmount !== undefined
                    ? item.estimatedAmount
                    : Number(item.quantity) * Number(item.estimatedRate || 0),
                approvedQuantity: item.approvedQuantity || null,
                requiredDate: new Date(item.requiredDate),
                notes: item.notes || null,
                attachmentUrl: (item.attachmentUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                additionalInformation: (item.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              })),
            }
          : undefined,
      };

      const created = await tx.materialRequest.create({
        data: createData,
        include: materialRequestDetailInclude,
      });

      return created;
    });
  }

  /**
   * Find a single Material Request by ID and Organization ID
   */
  async findById(id: string, organizationId: string) {
    return prisma.materialRequest.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: materialRequestDetailInclude,
    });
  }

  /**
   * Find paginated Material Requests with multi-tenant filtering
   */
  async findMany(organizationId: string, query: GetMaterialRequestsQueryInput) {
    const {
      page = 1,
      limit = 10,
      search,
      projectId,
      status,
      priority,
      requestedById,
      approvedById,
      category,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.MaterialRequestWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(requestedById ? { requestedById } : {}),
      ...(approvedById ? { approvedById } : {}),
      ...(category ? { category: { contains: category, mode: "insensitive" } } : {}),
      ...(startDate || endDate
        ? {
            requestDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { requestNumber: { contains: search, mode: "insensitive" } },
              { siteLocation: { contains: search, mode: "insensitive" } },
              { reason: { contains: search, mode: "insensitive" } },
              { category: { contains: search, mode: "insensitive" } },
              { project: { name: { contains: search, mode: "insensitive" } } },
              { project: { projectCode: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.materialRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              projectCode: true,
              status: true,
            },
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          _count: {
            select: {
              items: true,
              rfqs: true,
              quotations: true,
              dispatches: true,
            },
          },
        },
      }),
      prisma.materialRequest.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update Material Request header
   */
  async update(id: string, organizationId: string, data: UpdateMaterialRequestInput) {
    const requestedById =
      data.requestedById !== undefined
        ? await this.resolveUserId(data.requestedById, organizationId)
        : undefined;

    const approvedById =
      data.approvedById !== undefined
        ? await this.resolveUserId(data.approvedById, organizationId)
        : undefined;

    const updateData: Prisma.MaterialRequestUncheckedUpdateInput = {
      ...(data.projectId ? { projectId: data.projectId } : {}),
      ...(data.requestNumber ? { requestNumber: data.requestNumber } : {}),
      ...(data.requestDate ? { requestDate: new Date(data.requestDate) } : {}),
      ...(data.requiredByDate ? { requiredByDate: new Date(data.requiredByDate) } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.siteLocation !== undefined ? { siteLocation: data.siteLocation } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.reason !== undefined ? { reason: data.reason } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.estimatedCost !== undefined ? { estimatedCost: data.estimatedCost } : {}),
      ...(data.approvedCost !== undefined ? { approvedCost: data.approvedCost } : {}),
      ...(data.requestedById !== undefined ? { requestedById } : {}),
      ...(data.approvedById !== undefined ? { approvedById } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.materialRequest.update({
      where: { id, organizationId },
      data: updateData,
      include: materialRequestDetailInclude,
    });
  }

  /**
   * Soft-delete Material Request
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.materialRequest.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Update status of Material Request
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: Prisma.EnumMaterialRequestStatusFilter["equals"],
    approvedById?: string,
    approvedCost?: number,
    notes?: string
  ) {
    const resolvedApprovedById = approvedById
      ? await this.resolveUserId(approvedById, organizationId)
      : undefined;

    const data: Prisma.MaterialRequestUncheckedUpdateInput = {
      status,
      ...(notes ? { notes } : {}),
      ...(approvedCost !== undefined ? { approvedCost } : {}),
      ...(approvedById !== undefined ? { approvedById: resolvedApprovedById } : {}),
    };

    return prisma.materialRequest.update({
      where: { id, organizationId },
      data,
      include: materialRequestDetailInclude,
    });
  }

  // ==========================================
  // Item Operations
  // ==========================================

  /**
   * Add a line item to a Material Request
   */
  async addItem(
    requestId: string,
    organizationId: string,
    itemData: CreateMaterialRequestItemInput
  ) {
    return prisma.$transaction(async (tx) => {
      const createItemData: Prisma.MaterialRequestItemUncheckedCreateInput = {
        organizationId,
        requestId,
        materialProductId: itemData.materialProductId || null,
        name: itemData.name,
        sku: itemData.sku || null,
        brand: itemData.brand || null,
        specifications: itemData.specifications || null,
        dimensions: itemData.dimensions || null,
        quantity: itemData.quantity,
        unit: itemData.unit,
        estimatedRate: itemData.estimatedRate || 0,
        estimatedAmount:
          itemData.estimatedAmount !== undefined
            ? itemData.estimatedAmount
            : Number(itemData.quantity) * Number(itemData.estimatedRate || 0),
        approvedQuantity: itemData.approvedQuantity || null,
        requiredDate: new Date(itemData.requiredDate),
        notes: itemData.notes || null,
        attachmentUrl: (itemData.attachmentUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        additionalInformation: (itemData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      };

      const createdItem = await tx.materialRequestItem.create({
        data: createItemData,
        include: materialRequestItemInclude,
      });

      // Recalculate request total estimated cost
      const allItems = await tx.materialRequestItem.findMany({
        where: { requestId, organizationId },
        select: { estimatedAmount: true },
      });

      const totalCost = allItems.reduce(
        (acc, it) => acc + Number(it.estimatedAmount || 0),
        0
      );

      await tx.materialRequest.update({
        where: { id: requestId, organizationId },
        data: { estimatedCost: totalCost },
      });

      return createdItem;
    });
  }

  /**
   * Update a line item in a Material Request
   */
  async updateItem(
    itemId: string,
    requestId: string,
    organizationId: string,
    data: UpdateMaterialRequestItemInput
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.materialRequestItem.findFirst({
        where: { id: itemId, requestId, organizationId },
      });

      if (!existing) {
        return null;
      }

      const qty = data.quantity !== undefined ? Number(data.quantity) : Number(existing.quantity);
      const rate = data.estimatedRate !== undefined ? Number(data.estimatedRate) : Number(existing.estimatedRate);
      const amount = data.estimatedAmount !== undefined ? Number(data.estimatedAmount) : qty * rate;

      const updatePayload: Prisma.MaterialRequestItemUncheckedUpdateInput = {
        ...(data.materialProductId !== undefined ? { materialProductId: data.materialProductId || null } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.sku !== undefined ? { sku: data.sku } : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        ...(data.specifications !== undefined ? { specifications: data.specifications } : {}),
        ...(data.dimensions !== undefined ? { dimensions: data.dimensions } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.unit ? { unit: data.unit } : {}),
        ...(data.estimatedRate !== undefined ? { estimatedRate: data.estimatedRate } : {}),
        estimatedAmount: amount,
        ...(data.approvedQuantity !== undefined ? { approvedQuantity: data.approvedQuantity } : {}),
        ...(data.fulfilledQuantity !== undefined ? { fulfilledQuantity: data.fulfilledQuantity } : {}),
        ...(data.requiredDate ? { requiredDate: new Date(data.requiredDate) } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.attachmentUrl !== undefined
          ? { attachmentUrl: (data.attachmentUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull }
          : {}),
        ...(data.additionalInformation !== undefined
          ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
          : {}),
      };

      const updatedItem = await tx.materialRequestItem.update({
        where: { id: itemId },
        data: updatePayload,
        include: materialRequestItemInclude,
      });

      // Recalculate request total estimated cost
      const allItems = await tx.materialRequestItem.findMany({
        where: { requestId, organizationId },
        select: { estimatedAmount: true },
      });

      const totalCost = allItems.reduce(
        (acc, it) => acc + Number(it.estimatedAmount || 0),
        0
      );

      await tx.materialRequest.update({
        where: { id: requestId, organizationId },
        data: { estimatedCost: totalCost },
      });

      return updatedItem;
    });
  }

  /**
   * Remove a line item from a Material Request
   */
  async removeItem(itemId: string, requestId: string, organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.materialRequestItem.findFirst({
        where: { id: itemId, requestId, organizationId },
      });

      if (!existing) {
        return null;
      }

      await tx.materialRequestItem.delete({
        where: { id: itemId },
      });

      // Recalculate request total estimated cost
      const allItems = await tx.materialRequestItem.findMany({
        where: { requestId, organizationId },
        select: { estimatedAmount: true },
      });

      const totalCost = allItems.reduce(
        (acc, it) => acc + Number(it.estimatedAmount || 0),
        0
      );

      await tx.materialRequest.update({
        where: { id: requestId, organizationId },
        data: { estimatedCost: totalCost },
      });

      return existing;
    });
  }
}

export const materialRequestRepo = new MaterialRequestRepository();

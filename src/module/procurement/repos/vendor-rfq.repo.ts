import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateVendorRfqInput,
  UpdateVendorRfqInput,
  CreateRfqItemInput,
  UpdateRfqItemInput,
  CreateRfqInviteInput,
  UpdateRfqInviteInput,
  GetVendorRfqsQueryInput,
} from "../validators/vendor-rfq.validator.js";

const rfqItemInclude = {
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
  materialRequestItem: {
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      estimatedRate: true,
    },
  },
};

const rfqInviteInclude = {
  vendor: {
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      isActive: true,
    },
  },
};

const vendorRfqDetailInclude = {
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
        },
      },
    },
  },
  materialRequest: {
    select: {
      id: true,
      requestNumber: true,
      requestDate: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  items: {
    include: rfqItemInclude,
    orderBy: { createdAt: "asc" as const },
  },
  invites: {
    include: rfqInviteInclude,
    orderBy: { invitedAt: "asc" as const },
  },
  quotations: {
    select: {
      id: true,
      quotationNumber: true,
      vendorId: true,
      totalAmount: true,
      status: true,
      quoteDate: true,
      vendor: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
  _count: {
    select: {
      items: true,
      invites: true,
      quotations: true,
    },
  },
};

/**
 * Repository handling database operations for Vendor RFQs, Items, and Invites
 */
export class VendorRfqRepository {
  /**
   * Auto-generate sequential, tenant-scoped RFQ Number e.g. "RFQ-2026-0001"
   */
  async generateRfqNumber(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `RFQ-${currentYear}-`;

    const latest = await db.vendorRfq.findFirst({
      where: {
        organizationId,
        rfqNumber: { startsWith: prefix },
      },
      orderBy: { rfqNumber: "desc" },
      select: { rfqNumber: true },
    });

    let nextNumber = 1;
    if (latest?.rfqNumber) {
      const parts = latest.rfqNumber.split("-");
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
   * Create a new RFQ with items and vendor invites in an atomic transaction
   */
  async create(organizationId: string, data: CreateVendorRfqInput) {
    return prisma.$transaction(async (tx) => {
      const rfqNumber =
        data.rfqNumber || (await this.generateRfqNumber(organizationId, tx));

      const { items, vendorIds, ...headerData } = data;
      const resolvedCreatedById = await this.resolveUserId(headerData.createdById, organizationId, tx);

      const createData: Prisma.VendorRfqUncheckedCreateInput = {
        organizationId,
        projectId: headerData.projectId,
        materialRequestId: headerData.materialRequestId || null,
        rfqNumber,
        title: headerData.title,
        rfqDate: headerData.rfqDate ? new Date(headerData.rfqDate) : new Date(),
        deadline: new Date(headerData.deadline),
        priority: headerData.priority,
        status: headerData.status,
        deliveryLocation: headerData.deliveryLocation || null,
        terms: headerData.terms || null,
        notes: headerData.notes || null,
        createdById: resolvedCreatedById,
        additionalInformation: (headerData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        items: items && items.length > 0
          ? {
              create: items.map((item) => ({
                organizationId,
                materialRequestItemId: item.materialRequestItemId || null,
                materialProductId: item.materialProductId || null,
                name: item.name,
                specifications: item.specifications || null,
                brand: item.brand || null,
                quantity: item.quantity,
                unit: item.unit,
                targetRate: item.targetRate || null,
                requiredDate: new Date(item.requiredDate),
                notes: item.notes || null,
                additionalInformation: (item.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              })),
            }
          : undefined,
        invites: vendorIds && vendorIds.length > 0
          ? {
              create: vendorIds.map((vendorId) => ({
                organizationId,
                vendorId,
                status: "INVITED" as const,
              })),
            }
          : undefined,
      };

      const created = await tx.vendorRfq.create({
        data: createData,
        include: vendorRfqDetailInclude,
      });

      return created;
    });
  }

  /**
   * Find single RFQ by ID and Organization ID
   */
  async findById(id: string, organizationId: string) {
    return prisma.vendorRfq.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: vendorRfqDetailInclude,
    });
  }

  /**
   * Find paginated RFQs with multi-tenant filtering
   */
  async findMany(organizationId: string, query: GetVendorRfqsQueryInput) {
    const {
      page = 1,
      limit = 10,
      search,
      projectId,
      materialRequestId,
      status,
      priority,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.VendorRfqWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
      ...(materialRequestId ? { materialRequestId } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(startDate || endDate
        ? {
            rfqDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { rfqNumber: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { deliveryLocation: { contains: search, mode: "insensitive" } },
              { project: { name: { contains: search, mode: "insensitive" } } },
              { project: { projectCode: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.vendorRfq.findMany({
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
          materialRequest: {
            select: {
              id: true,
              requestNumber: true,
            },
          },
          createdBy: {
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
              invites: true,
              quotations: true,
            },
          },
        },
      }),
      prisma.vendorRfq.count({ where }),
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
   * Update RFQ header
   */
  async update(id: string, organizationId: string, data: UpdateVendorRfqInput) {
    const updateData: Prisma.VendorRfqUncheckedUpdateInput = {
      ...(data.rfqNumber ? { rfqNumber: data.rfqNumber } : {}),
      ...(data.materialRequestId !== undefined ? { materialRequestId: data.materialRequestId || null } : {}),
      ...(data.title ? { title: data.title } : {}),
      ...(data.rfqDate ? { rfqDate: new Date(data.rfqDate) } : {}),
      ...(data.deadline ? { deadline: new Date(data.deadline) } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.deliveryLocation !== undefined ? { deliveryLocation: data.deliveryLocation } : {}),
      ...(data.terms !== undefined ? { terms: data.terms } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.vendorRfq.update({
      where: { id, organizationId },
      data: updateData,
      include: vendorRfqDetailInclude,
    });
  }

  /**
   * Soft-delete RFQ
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.vendorRfq.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Update status of RFQ
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: Prisma.EnumVendorRfqStatusFilter["equals"],
    notes?: string
  ) {
    return prisma.vendorRfq.update({
      where: { id, organizationId },
      data: {
        status,
        ...(notes ? { notes } : {}),
      },
      include: vendorRfqDetailInclude,
    });
  }

  // ==========================================
  // RFQ Items
  // ==========================================

  async addItem(rfqId: string, organizationId: string, itemData: CreateRfqItemInput) {
    const createItemData: Prisma.VendorRfqItemUncheckedCreateInput = {
      organizationId,
      rfqId,
      materialRequestItemId: itemData.materialRequestItemId || null,
      materialProductId: itemData.materialProductId || null,
      name: itemData.name,
      specifications: itemData.specifications || null,
      brand: itemData.brand || null,
      quantity: itemData.quantity,
      unit: itemData.unit,
      targetRate: itemData.targetRate || null,
      requiredDate: new Date(itemData.requiredDate),
      notes: itemData.notes || null,
      additionalInformation: (itemData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    };

    return prisma.vendorRfqItem.create({
      data: createItemData,
      include: rfqItemInclude,
    });
  }

  async updateItem(
    itemId: string,
    rfqId: string,
    organizationId: string,
    data: UpdateRfqItemInput
  ) {
    const updatePayload: Prisma.VendorRfqItemUncheckedUpdateInput = {
      ...(data.materialRequestItemId !== undefined ? { materialRequestItemId: data.materialRequestItemId || null } : {}),
      ...(data.materialProductId !== undefined ? { materialProductId: data.materialProductId || null } : {}),
      ...(data.name ? { name: data.name } : {}),
      ...(data.specifications !== undefined ? { specifications: data.specifications } : {}),
      ...(data.brand !== undefined ? { brand: data.brand } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
      ...(data.unit ? { unit: data.unit } : {}),
      ...(data.targetRate !== undefined ? { targetRate: data.targetRate } : {}),
      ...(data.requiredDate ? { requiredDate: new Date(data.requiredDate) } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.vendorRfqItem.update({
      where: { id: itemId, rfqId, organizationId },
      data: updatePayload,
      include: rfqItemInclude,
    });
  }

  async removeItem(itemId: string, rfqId: string, organizationId: string) {
    return prisma.vendorRfqItem.delete({
      where: { id: itemId, rfqId, organizationId },
    });
  }

  // ==========================================
  // RFQ Invites
  // ==========================================

  async addInvite(rfqId: string, organizationId: string, inviteData: CreateRfqInviteInput) {
    const createInviteData: Prisma.VendorRfqInviteUncheckedCreateInput = {
      organizationId,
      rfqId,
      vendorId: inviteData.vendorId,
      notes: inviteData.notes || null,
      additionalInformation: (inviteData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    };

    return prisma.vendorRfqInvite.create({
      data: createInviteData,
      include: rfqInviteInclude,
    });
  }

  async findInvites(rfqId: string, organizationId: string) {
    return prisma.vendorRfqInvite.findMany({
      where: { rfqId, organizationId },
      include: rfqInviteInclude,
      orderBy: { invitedAt: "asc" },
    });
  }

  async updateInvite(
    inviteId: string,
    rfqId: string,
    organizationId: string,
    data: UpdateRfqInviteInput
  ) {
    const updatePayload: Prisma.VendorRfqInviteUncheckedUpdateInput = {
      ...(data.status ? { status: data.status } : {}),
      ...(data.respondedAt !== undefined
        ? { respondedAt: data.respondedAt ? new Date(data.respondedAt) : null }
        : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.vendorRfqInvite.update({
      where: { id: inviteId, rfqId, organizationId },
      data: updatePayload,
      include: rfqInviteInclude,
    });
  }

  async removeInvite(inviteId: string, rfqId: string, organizationId: string) {
    return prisma.vendorRfqInvite.delete({
      where: { id: inviteId, rfqId, organizationId },
    });
  }
}

export const vendorRfqRepo = new VendorRfqRepository();

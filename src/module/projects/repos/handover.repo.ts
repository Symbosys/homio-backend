import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  GetHandoversQueryInput,
  GetHandoverItemsQueryInput,
  GetHandoverSnagsQueryInput,
} from "../validators/handover.validator.js";

export class HandoverRepository {
  /**
   * Auto-generates sequential handover code scoped to organization and year (HND-YYYY-NNNN)
   */
  async generateNextHandoverNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `HND-${year}-`;

    const latest = await prisma.projectHandover.findFirst({
      where: {
        organizationId,
        handoverNumber: { startsWith: prefix },
      },
      orderBy: { handoverNumber: "desc" },
      select: { handoverNumber: true },
    });

    if (!latest?.handoverNumber) {
      return `${prefix}0001`;
    }

    const currentSeq = parseInt(latest.handoverNumber.replace(prefix, ""), 10);
    const nextSeq = isNaN(currentSeq) ? 1 : currentSeq + 1;
    return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
  }

  /**
   * Create a new ProjectHandover record with optional initial items and snags
   */
  async createHandover(
    data: Prisma.ProjectHandoverUncheckedCreateInput,
    initialItems?: Prisma.ProjectHandoverItemUncheckedCreateWithoutHandoverInput[],
    initialSnags?: Prisma.ProjectHandoverSnagUncheckedCreateWithoutHandoverInput[],
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    return db.projectHandover.create({
      data: {
        ...data,
        items: initialItems && initialItems.length > 0
          ? { create: initialItems }
          : undefined,
        snags: initialSnags && initialSnags.length > 0
          ? { create: initialSnags }
          : undefined,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
            currentStage: true,
            site: {
              select: {
                address: true,
                city: true,
                state: true,
                pincode: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        handedOverBy: {
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
        _count: {
          select: {
            items: true,
            snags: true,
          },
        },
      },
    });
  }

  /**
   * Find single Handover by ID scoped to organization
   */
  async findHandoverById(id: string, organizationId: string) {
    return prisma.projectHandover.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
            currentStage: true,
            site: {
              select: {
                address: true,
                city: true,
                state: true,
                pincode: true,
              },
            },
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        handedOverBy: {
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
        items: {
          orderBy: { createdAt: "asc" },
        },
        snags: {
          include: {
            assignedTo: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                displayName: true,
              },
            },
            complaint: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        _count: {
          select: {
            items: true,
            snags: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated list of handovers scoped to tenant
   */
  async findHandovers(organizationId: string, filter: GetHandoversQueryInput) {
    const {
      page = 1,
      limit = 10,
      search,
      projectId,
      customerId,
      status,
      isCommercialCleared,
      handedOverById,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filter;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectHandoverWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(customerId && { customerId }),
      ...(status && { status }),
      ...(isCommercialCleared !== undefined && { isCommercialCleared }),
      ...(handedOverById && { handedOverById }),
      ...(startDate || endDate
        ? {
            handoverDate: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { handoverNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { clientSignoffName: { contains: search, mode: "insensitive" } },
          { project: { name: { contains: search, mode: "insensitive" } } },
          { project: { projectCode: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.projectHandover.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
              currentStage: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              displayName: true,
              phone: true,
            },
          },
          handedOverBy: {
            select: {
              id: true,
              employeeCode: true,
              displayName: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              items: true,
              snags: true,
            },
          },
        },
      }),
      prisma.projectHandover.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  /**
   * Update Handover record
   */
  async updateHandover(
    id: string,
    organizationId: string,
    data: Prisma.ProjectHandoverUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    return db.projectHandover.update({
      where: {
        id,
        organizationId,
      },
      data,
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            status: true,
            currentStage: true,
          },
        },
        customer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete a handover record
   */
  async deleteHandover(id: string, organizationId: string) {
    return prisma.projectHandover.update({
      where: {
        id,
        organizationId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  // ==========================================
  // DELIVERABLES / ITEMS REPO METHODS
  // ==========================================

  async createItem(data: Prisma.ProjectHandoverItemUncheckedCreateInput) {
    return prisma.projectHandoverItem.create({ data });
  }

  async findItemById(id: string, handoverId: string) {
    return prisma.projectHandoverItem.findFirst({
      where: { id, handoverId },
    });
  }

  async findItems(handoverId: string, filter?: GetHandoverItemsQueryInput) {
    const where: Prisma.ProjectHandoverItemWhereInput = {
      handoverId,
      ...(filter?.category && { category: filter.category }),
      ...(filter?.status && { status: filter.status }),
      ...(filter?.search && {
        OR: [
          { name: { contains: filter.search, mode: "insensitive" } },
          { description: { contains: filter.search, mode: "insensitive" } },
          { recipientName: { contains: filter.search, mode: "insensitive" } },
        ],
      }),
    };

    return prisma.projectHandoverItem.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });
  }

  async updateItem(id: string, data: Prisma.ProjectHandoverItemUncheckedUpdateInput) {
    return prisma.projectHandoverItem.update({
      where: { id },
      data,
    });
  }

  async bulkUpdateItems(
    handoverId: string,
    itemIds: string[],
    data: Prisma.ProjectHandoverItemUncheckedUpdateInput
  ) {
    return prisma.projectHandoverItem.updateMany({
      where: {
        handoverId,
        id: { in: itemIds },
      },
      data,
    });
  }

  async deleteItem(id: string) {
    return prisma.projectHandoverItem.delete({
      where: { id },
    });
  }

  // ==========================================
  // PRE-HANDOVER SNAG REPO METHODS
  // ==========================================

  async createSnag(data: Prisma.ProjectHandoverSnagUncheckedCreateInput) {
    return prisma.projectHandoverSnag.create({
      data,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async findSnagById(id: string, handoverId: string) {
    return prisma.projectHandoverSnag.findFirst({
      where: { id, handoverId },
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        complaint: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });
  }

  async findSnags(handoverId: string, filter?: GetHandoverSnagsQueryInput) {
    const where: Prisma.ProjectHandoverSnagWhereInput = {
      handoverId,
      ...(filter?.severity && { severity: filter.severity }),
      ...(filter?.status && { status: filter.status }),
      ...(filter?.areaRoom && { areaRoom: filter.areaRoom }),
      ...(filter?.assignedToId && { assignedToId: filter.assignedToId }),
    };

    return prisma.projectHandoverSnag.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async updateSnag(id: string, data: Prisma.ProjectHandoverSnagUncheckedUpdateInput) {
    return prisma.projectHandoverSnag.update({
      where: { id },
      data,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async deleteSnag(id: string) {
    return prisma.projectHandoverSnag.delete({
      where: { id },
    });
  }

  // ==========================================
  // AGGREGATED SUMMARY & READINESS METRICS
  // ==========================================

  async getHandoverSummary(id: string, organizationId: string) {
    const handover = await this.findHandoverById(id, organizationId);
    if (!handover) return null;

    const [itemStats, snagStats] = await Promise.all([
      prisma.projectHandoverItem.groupBy({
        by: ["status"],
        where: { handoverId: id },
        _count: { _all: true },
      }),
      prisma.projectHandoverSnag.groupBy({
        by: ["status", "severity"],
        where: { handoverId: id },
        _count: { _all: true },
      }),
    ]);

    const totalItems = handover.items.length;
    const handedOverItems = handover.items.filter((i) => i.status === "HANDED_OVER").length;
    const pendingItems = totalItems - handedOverItems;

    const totalSnags = handover.snags.length;
    const resolvedSnags = handover.snags.filter(
      (s) => s.status === "RESOLVED" || s.status === "ACCEPTED_BY_CLIENT" || s.status === "WAIVED"
    ).length;
    const openSnags = totalSnags - resolvedSnags;
    const criticalOpenSnags = handover.snags.filter(
      (s) => s.severity === "CRITICAL" && (s.status === "REPORTED" || s.status === "IN_PROGRESS")
    ).length;

    // Readiness score computation
    const itemWeight = totalItems > 0 ? (handedOverItems / totalItems) * 40 : 40;
    const snagWeight = totalSnags > 0 ? (resolvedSnags / totalSnags) * 40 : 40;
    const commercialWeight = handover.isCommercialCleared ? 20 : 0;
    const readinessScore = Math.round(itemWeight + snagWeight + commercialWeight);

    return {
      handover: {
        id: handover.id,
        handoverNumber: handover.handoverNumber,
        title: handover.title,
        status: handover.status,
        handoverDate: handover.handoverDate,
        isCommercialCleared: handover.isCommercialCleared,
        finalSettlementAmount: handover.finalSettlementAmount,
        pendingAmount: handover.pendingAmount,
        warrantyPeriodMonths: handover.warrantyPeriodMonths,
        warrantyEndDate: handover.warrantyEndDate,
      },
      metrics: {
        readinessScore,
        isReadyForHandover: criticalOpenSnags === 0 && handover.isCommercialCleared && openSnags === 0,
        items: {
          total: totalItems,
          handedOver: handedOverItems,
          pending: pendingItems,
          breakdown: itemStats,
        },
        snags: {
          total: totalSnags,
          resolved: resolvedSnags,
          open: openSnags,
          criticalOpen: criticalOpenSnags,
          breakdown: snagStats,
        },
      },
    };
  }
}

export const handoverRepository = new HandoverRepository();

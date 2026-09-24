import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateMaterialDispatchInput,
  UpdateMaterialDispatchInput,
  CreateDispatchItemInput,
  UpdateDispatchItemInput,
  BulkReceiveDispatchInput,
  GetMaterialDispatchesQueryInput,
} from "../validators/material-dispatch.validator.js";

const dispatchItemInclude = {
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

const materialDispatchDetailInclude = {
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
  vendor: {
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
    },
  },
  materialRequest: {
    select: {
      id: true,
      requestNumber: true,
      status: true,
      siteLocation: true,
    },
  },
  quotation: {
    select: {
      id: true,
      quotationNumber: true,
      totalAmount: true,
      status: true,
    },
  },
  receivedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  items: {
    include: dispatchItemInclude,
    orderBy: { createdAt: "asc" as const },
  },
};

/**
 * Repository handling database operations for Material Dispatches & Site Receipts
 */
export class MaterialDispatchRepository {
  /**
   * Auto-generate sequential, tenant-scoped Dispatch Number e.g. "DSP-2026-0001"
   */
  async generateDispatchNumber(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `DSP-${currentYear}-`;

    const latest = await db.materialDispatch.findFirst({
      where: {
        organizationId,
        dispatchNumber: { startsWith: prefix },
      },
      orderBy: { dispatchNumber: "desc" },
      select: { dispatchNumber: true },
    });

    let nextNumber = 1;
    if (latest?.dispatchNumber) {
      const parts = latest.dispatchNumber.split("-");
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
   * Create a new Material Dispatch with items in an atomic transaction
   */
  async create(organizationId: string, data: CreateMaterialDispatchInput) {
    return prisma.$transaction(async (tx) => {
      const dispatchNumber =
        data.dispatchNumber || (await this.generateDispatchNumber(organizationId, tx));

      const { items, ...headerData } = data;
      const resolvedReceivedById = await this.resolveUserId(headerData.receivedById, organizationId, tx);

      const createData: Prisma.MaterialDispatchUncheckedCreateInput = {
        organizationId,
        projectId: headerData.projectId,
        vendorId: headerData.vendorId,
        materialRequestId: headerData.materialRequestId || null,
        quotationId: headerData.quotationId || null,
        dispatchNumber,
        dispatchDate: headerData.dispatchDate ? new Date(headerData.dispatchDate) : new Date(),
        expectedArrival: new Date(headerData.expectedArrival),
        actualArrival: headerData.actualArrival ? new Date(headerData.actualArrival) : null,
        status: headerData.status,
        destinationAddress: headerData.destinationAddress || null,
        transporterName: headerData.transporterName || null,
        vehicleNumber: headerData.vehicleNumber || null,
        driverContact: headerData.driverContact || null,
        challanNumber: headerData.challanNumber || null,
        eWayBillNumber: headerData.eWayBillNumber || null,
        freightAmount: headerData.freightAmount || 0,
        deliveryProofUrl: (headerData.deliveryProofUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        siteSupervisorSignature: (headerData.siteSupervisorSignature as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        siteInspectionNotes: headerData.siteInspectionNotes || null,
        receivedById: resolvedReceivedById,
        additionalInformation: (headerData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        items: items && items.length > 0
          ? {
              create: items.map((item) => ({
                organizationId,
                materialProductId: item.materialProductId || null,
                name: item.name,
                unit: item.unit,
                dispatchedQuantity: item.dispatchedQuantity,
                receivedQuantity: item.receivedQuantity || 0,
                acceptedQuantity: item.acceptedQuantity || 0,
                rejectedQuantity: item.rejectedQuantity || 0,
                condition: item.condition || "GOOD",
                batchLot: item.batchLot || null,
                remarks: item.remarks || null,
                additionalInformation: (item.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
              })),
            }
          : undefined,
      };

      const created = await tx.materialDispatch.create({
        data: createData,
        include: materialDispatchDetailInclude,
      });

      return created;
    });
  }

  /**
   * Find single Dispatch by ID and Organization ID
   */
  async findById(id: string, organizationId: string) {
    return prisma.materialDispatch.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: materialDispatchDetailInclude,
    });
  }

  /**
   * Find paginated Dispatches with multi-tenant filtering
   */
  async findMany(organizationId: string, query: GetMaterialDispatchesQueryInput) {
    const {
      page = 1,
      limit = 10,
      search,
      projectId,
      vendorId,
      materialRequestId,
      quotationId,
      status,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.MaterialDispatchWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(materialRequestId ? { materialRequestId } : {}),
      ...(quotationId ? { quotationId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate
        ? {
            dispatchDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { dispatchNumber: { contains: search, mode: "insensitive" } },
              { transporterName: { contains: search, mode: "insensitive" } },
              { vehicleNumber: { contains: search, mode: "insensitive" } },
              { challanNumber: { contains: search, mode: "insensitive" } },
              { eWayBillNumber: { contains: search, mode: "insensitive" } },
              { vendor: { name: { contains: search, mode: "insensitive" } } },
              { project: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.materialDispatch.findMany({
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
            },
          },
          vendor: {
            select: {
              id: true,
              name: true,
              code: true,
              phone: true,
            },
          },
          materialRequest: {
            select: {
              id: true,
              requestNumber: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
        },
      }),
      prisma.materialDispatch.count({ where }),
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
   * Update Dispatch header
   */
  async update(id: string, organizationId: string, data: UpdateMaterialDispatchInput) {
    const resolvedReceivedById =
      data.receivedById !== undefined
        ? await this.resolveUserId(data.receivedById, organizationId)
        : undefined;

    const updateData: Prisma.MaterialDispatchUncheckedUpdateInput = {
      ...(data.dispatchNumber ? { dispatchNumber: data.dispatchNumber } : {}),
      ...(data.materialRequestId !== undefined ? { materialRequestId: data.materialRequestId || null } : {}),
      ...(data.quotationId !== undefined ? { quotationId: data.quotationId || null } : {}),
      ...(data.dispatchDate ? { dispatchDate: new Date(data.dispatchDate) } : {}),
      ...(data.expectedArrival ? { expectedArrival: new Date(data.expectedArrival) } : {}),
      ...(data.actualArrival !== undefined
        ? { actualArrival: data.actualArrival ? new Date(data.actualArrival) : null }
        : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.destinationAddress !== undefined ? { destinationAddress: data.destinationAddress } : {}),
      ...(data.transporterName !== undefined ? { transporterName: data.transporterName } : {}),
      ...(data.vehicleNumber !== undefined ? { vehicleNumber: data.vehicleNumber } : {}),
      ...(data.driverContact !== undefined ? { driverContact: data.driverContact } : {}),
      ...(data.challanNumber !== undefined ? { challanNumber: data.challanNumber } : {}),
      ...(data.eWayBillNumber !== undefined ? { eWayBillNumber: data.eWayBillNumber } : {}),
      ...(data.freightAmount !== undefined ? { freightAmount: data.freightAmount } : {}),
      ...(data.deliveryProofUrl !== undefined
        ? { deliveryProofUrl: (data.deliveryProofUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
      ...(data.siteSupervisorSignature !== undefined
        ? { siteSupervisorSignature: (data.siteSupervisorSignature as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
      ...(data.siteInspectionNotes !== undefined ? { siteInspectionNotes: data.siteInspectionNotes } : {}),
      ...(data.receivedById !== undefined ? { receivedById: resolvedReceivedById } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.materialDispatch.update({
      where: { id, organizationId },
      data: updateData,
      include: materialDispatchDetailInclude,
    });
  }

  /**
   * Soft-delete Dispatch
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.materialDispatch.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Update status of Dispatch
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: Prisma.EnumMaterialDispatchStatusFilter["equals"],
    actualArrival?: string,
    siteInspectionNotes?: string
  ) {
    const data: Prisma.MaterialDispatchUncheckedUpdateInput = {
      status,
      ...(actualArrival ? { actualArrival: new Date(actualArrival) } : {}),
      ...(siteInspectionNotes !== undefined ? { siteInspectionNotes } : {}),
    };

    return prisma.materialDispatch.update({
      where: { id, organizationId },
      data,
      include: materialDispatchDetailInclude,
    });
  }

  // ==========================================
  // Dispatch Items
  // ==========================================

  async addItem(dispatchId: string, organizationId: string, itemData: CreateDispatchItemInput) {
    const createItemData: Prisma.MaterialDispatchItemUncheckedCreateInput = {
      organizationId,
      dispatchId,
      materialProductId: itemData.materialProductId || null,
      name: itemData.name,
      unit: itemData.unit,
      dispatchedQuantity: itemData.dispatchedQuantity,
      receivedQuantity: itemData.receivedQuantity || 0,
      acceptedQuantity: itemData.acceptedQuantity || 0,
      rejectedQuantity: itemData.rejectedQuantity || 0,
      condition: itemData.condition || "GOOD",
      batchLot: itemData.batchLot || null,
      remarks: itemData.remarks || null,
      additionalInformation: (itemData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    };

    return prisma.materialDispatchItem.create({
      data: createItemData,
      include: dispatchItemInclude,
    });
  }

  async updateItem(
    itemId: string,
    dispatchId: string,
    organizationId: string,
    data: UpdateDispatchItemInput
  ) {
    const updatePayload: Prisma.MaterialDispatchItemUncheckedUpdateInput = {
      ...(data.materialProductId !== undefined ? { materialProductId: data.materialProductId || null } : {}),
      ...(data.name ? { name: data.name } : {}),
      ...(data.unit ? { unit: data.unit } : {}),
      ...(data.dispatchedQuantity !== undefined ? { dispatchedQuantity: data.dispatchedQuantity } : {}),
      ...(data.receivedQuantity !== undefined ? { receivedQuantity: data.receivedQuantity } : {}),
      ...(data.acceptedQuantity !== undefined ? { acceptedQuantity: data.acceptedQuantity } : {}),
      ...(data.rejectedQuantity !== undefined ? { rejectedQuantity: data.rejectedQuantity } : {}),
      ...(data.condition ? { condition: data.condition } : {}),
      ...(data.batchLot !== undefined ? { batchLot: data.batchLot } : {}),
      ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.materialDispatchItem.update({
      where: { id: itemId, dispatchId, organizationId },
      data: updatePayload,
      include: dispatchItemInclude,
    });
  }

  async removeItem(itemId: string, dispatchId: string, organizationId: string) {
    return prisma.materialDispatchItem.delete({
      where: { id: itemId, dispatchId, organizationId },
    });
  }

  /**
   * Bulk receive items and transition dispatch status in an atomic transaction
   */
  async bulkReceive(
    id: string,
    organizationId: string,
    data: BulkReceiveDispatchInput,
    receivedById?: string
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Update individual item quantities and conditions
      for (const item of data.items) {
        await tx.materialDispatchItem.update({
          where: { id: item.id, dispatchId: id, organizationId },
          data: {
            receivedQuantity: item.receivedQuantity,
            acceptedQuantity: item.acceptedQuantity,
            rejectedQuantity: item.rejectedQuantity,
            condition: item.condition,
            remarks: item.remarks || null,
          },
        });
      }

      // 2. Update dispatch header
      const resolvedReceivedById =
        receivedById !== undefined
          ? await this.resolveUserId(receivedById, organizationId, tx)
          : undefined;

      const updateData: Prisma.MaterialDispatchUncheckedUpdateInput = {
        status: data.status || "RECEIVED",
        actualArrival: data.actualArrival ? new Date(data.actualArrival) : new Date(),
        siteInspectionNotes: data.siteInspectionNotes || null,
        ...(receivedById !== undefined ? { receivedById: resolvedReceivedById } : {}),
      };

      const updatedDispatch = await tx.materialDispatch.update({
        where: { id, organizationId },
        data: updateData,
        include: materialDispatchDetailInclude,
      });

      // 3. If linked to a Material Request, update fulfilled quantities on matching items
      if (updatedDispatch.materialRequestId) {
        const dispatchItems = await tx.materialDispatchItem.findMany({
          where: { dispatchId: id, organizationId },
        });

        for (const dItem of dispatchItems) {
          if (dItem.acceptedQuantity && Number(dItem.acceptedQuantity) > 0) {
            // Find corresponding request item by name or materialProductId
            const matchWhere: Prisma.MaterialRequestItemWhereInput = {
              requestId: updatedDispatch.materialRequestId,
              organizationId,
              ...(dItem.materialProductId
                ? { materialProductId: dItem.materialProductId }
                : { name: { equals: dItem.name, mode: "insensitive" } }),
            };

            const reqItem = await tx.materialRequestItem.findFirst({
              where: matchWhere,
            });

            if (reqItem) {
              const newFulfilled =
                Number(reqItem.fulfilledQuantity) + Number(dItem.acceptedQuantity);
              await tx.materialRequestItem.update({
                where: { id: reqItem.id },
                data: { fulfilledQuantity: newFulfilled },
              });
            }
          }
        }
      }

      return updatedDispatch;
    });
  }
}

export const materialDispatchRepo = new MaterialDispatchRepository();

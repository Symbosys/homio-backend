import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateVendorQuotationInput,
  UpdateVendorQuotationInput,
  CreateQuotationItemInput,
  UpdateQuotationItemInput,
  GetVendorQuotationsQueryInput,
} from "../validators/vendor-quotation.validator.js";

const quotationItemInclude = {
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
  rfqItem: {
    select: {
      id: true,
      name: true,
      quantity: true,
      unit: true,
      targetRate: true,
    },
  },
};

const vendorQuotationDetailInclude = {
  project: {
    select: {
      id: true,
      name: true,
      projectCode: true,
      status: true,
    },
  },
  vendor: {
    select: {
      id: true,
      name: true,
      code: true,
      email: true,
      phone: true,
      defaultCommissionRate: true,
      isActive: true,
    },
  },
  rfq: {
    select: {
      id: true,
      rfqNumber: true,
      title: true,
      deadline: true,
      status: true,
    },
  },
  materialRequest: {
    select: {
      id: true,
      requestNumber: true,
      status: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
  items: {
    include: quotationItemInclude,
    orderBy: { createdAt: "asc" as const },
  },
  _count: {
    select: {
      dispatches: true,
    },
  },
};

/**
 * Repository handling database operations for Vendor Quotations & Bids
 */
export class VendorQuotationRepository {
  /**
   * Auto-generate sequential, tenant-scoped Quotation Number e.g. "VQ-2026-0001"
   */
  async generateQuotationNumber(
    organizationId: string,
    vendorId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `VQ-${currentYear}-`;

    const latest = await db.vendorQuotation.findFirst({
      where: {
        organizationId,
        quotationNumber: { startsWith: prefix },
      },
      orderBy: { quotationNumber: "desc" },
      select: { quotationNumber: true },
    });

    let nextNumber = 1;
    if (latest?.quotationNumber) {
      const parts = latest.quotationNumber.split("-");
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
   * Create a new Vendor Quotation with line items in an atomic transaction
   */
  async create(organizationId: string, data: CreateVendorQuotationInput) {
    return prisma.$transaction(async (tx) => {
      const quotationNumber =
        data.quotationNumber ||
        (await this.generateQuotationNumber(organizationId, data.vendorId, tx));

      const { items, ...headerData } = data;
      const resolvedReviewedById = await this.resolveUserId(headerData.reviewedById, organizationId, tx);

      // Compute subtotal from items if not explicitly provided
      let subtotal = Number(headerData.subtotal || 0);
      if (subtotal === 0 && items && items.length > 0) {
        subtotal = items.reduce((acc, it) => {
          const qty = Number(it.quantity);
          const rate = Number(it.unitRate);
          const disc = Number(it.discountPercent || 0);
          const tax = Number(it.taxRate || 0);
          const base = qty * rate * (1 - disc / 100);
          const total = it.totalAmount !== undefined ? Number(it.totalAmount) : base * (1 + tax / 100);
          return acc + total;
        }, 0);
      }

      const discount = Number(headerData.discount || 0);
      const tax = Number(headerData.tax || 0);
      const freight = Number(headerData.freight || 0);
      const totalAmount =
        headerData.totalAmount !== undefined
          ? Number(headerData.totalAmount)
          : subtotal - discount + tax + freight;

      const createData: Prisma.VendorQuotationUncheckedCreateInput = {
        organizationId,
        projectId: headerData.projectId,
        vendorId: headerData.vendorId,
        rfqId: headerData.rfqId || null,
        materialRequestId: headerData.materialRequestId || null,
        quotationNumber,
        quoteDate: headerData.quoteDate ? new Date(headerData.quoteDate) : new Date(),
        validUntil: new Date(headerData.validUntil),
        currency: headerData.currency || "INR",
        status: headerData.status,
        subtotal,
        discount,
        tax,
        freight,
        totalAmount,
        paymentTerms: headerData.paymentTerms || "30 Days Net",
        deliveryTimeline: headerData.deliveryTimeline || null,
        warrantyPeriod: headerData.warrantyPeriod || null,
        vendorRating: headerData.vendorRating || null,
        evaluationNotes: headerData.evaluationNotes || null,
        attachmentUrl: (headerData.attachmentUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        reviewedById: resolvedReviewedById,
        additionalInformation: (headerData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        items: items && items.length > 0
          ? {
              create: items.map((item) => {
                const qty = Number(item.quantity);
                const rate = Number(item.unitRate);
                const disc = Number(item.discountPercent || 0);
                const taxR = Number(item.taxRate || 18.0);
                const base = qty * rate * (1 - disc / 100);
                const itemTotal =
                  item.totalAmount !== undefined
                    ? item.totalAmount
                    : base * (1 + taxR / 100);

                return {
                  organizationId,
                  rfqItemId: item.rfqItemId || null,
                  materialProductId: item.materialProductId || null,
                  name: item.name,
                  brand: item.brand || null,
                  specifications: item.specifications || null,
                  quantity: item.quantity,
                  unit: item.unit,
                  unitRate: item.unitRate,
                  taxRate: item.taxRate || 18.0,
                  discountPercent: item.discountPercent || 0,
                  totalAmount: itemTotal,
                  deliveryDays: item.deliveryDays || null,
                  remarks: item.remarks || null,
                  additionalInformation: (item.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                };
              }),
            }
          : undefined,
      };

      const created = await tx.vendorQuotation.create({
        data: createData,
        include: vendorQuotationDetailInclude,
      });

      return created;
    });
  }

  /**
   * Find single Quotation by ID and Organization ID
   */
  async findById(id: string, organizationId: string) {
    return prisma.vendorQuotation.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: vendorQuotationDetailInclude,
    });
  }

  /**
   * Find paginated Quotations with multi-tenant filtering
   */
  async findMany(organizationId: string, query: GetVendorQuotationsQueryInput) {
    const {
      page = 1,
      limit = 10,
      search,
      projectId,
      vendorId,
      rfqId,
      materialRequestId,
      status,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.VendorQuotationWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(rfqId ? { rfqId } : {}),
      ...(materialRequestId ? { materialRequestId } : {}),
      ...(status ? { status } : {}),
      ...(startDate || endDate
        ? {
            quoteDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { quotationNumber: { contains: search, mode: "insensitive" } },
              { paymentTerms: { contains: search, mode: "insensitive" } },
              { deliveryTimeline: { contains: search, mode: "insensitive" } },
              { vendor: { name: { contains: search, mode: "insensitive" } } },
              { project: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.vendorQuotation.findMany({
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
              email: true,
              phone: true,
            },
          },
          rfq: {
            select: {
              id: true,
              rfqNumber: true,
            },
          },
          _count: {
            select: {
              items: true,
              dispatches: true,
            },
          },
        },
      }),
      prisma.vendorQuotation.count({ where }),
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
   * Find all quotations for a specific RFQ for side-by-side comparison
   */
  async findByRfqId(rfqId: string, organizationId: string) {
    return prisma.vendorQuotation.findMany({
      where: {
        rfqId,
        organizationId,
        isDeleted: false,
      },
      include: vendorQuotationDetailInclude,
      orderBy: { totalAmount: "asc" },
    });
  }

  /**
   * Update Quotation header
   */
  async update(id: string, organizationId: string, data: UpdateVendorQuotationInput) {
    let resolvedReviewedById: string | null | undefined = undefined;
    if (data.reviewedById !== undefined) {
      resolvedReviewedById = await this.resolveUserId(data.reviewedById, organizationId);
    }

    const updateData: Prisma.VendorQuotationUncheckedUpdateInput = {
      ...(data.quotationNumber ? { quotationNumber: data.quotationNumber } : {}),
      ...(data.rfqId !== undefined ? { rfqId: data.rfqId || null } : {}),
      ...(data.materialRequestId !== undefined ? { materialRequestId: data.materialRequestId || null } : {}),
      ...(data.quoteDate ? { quoteDate: new Date(data.quoteDate) } : {}),
      ...(data.validUntil ? { validUntil: new Date(data.validUntil) } : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.subtotal !== undefined ? { subtotal: data.subtotal } : {}),
      ...(data.discount !== undefined ? { discount: data.discount } : {}),
      ...(data.tax !== undefined ? { tax: data.tax } : {}),
      ...(data.freight !== undefined ? { freight: data.freight } : {}),
      ...(data.totalAmount !== undefined ? { totalAmount: data.totalAmount } : {}),
      ...(data.paymentTerms !== undefined ? { paymentTerms: data.paymentTerms } : {}),
      ...(data.deliveryTimeline !== undefined ? { deliveryTimeline: data.deliveryTimeline } : {}),
      ...(data.warrantyPeriod !== undefined ? { warrantyPeriod: data.warrantyPeriod } : {}),
      ...(data.vendorRating !== undefined ? { vendorRating: data.vendorRating } : {}),
      ...(data.evaluationNotes !== undefined ? { evaluationNotes: data.evaluationNotes } : {}),
      ...(data.attachmentUrl !== undefined
        ? { attachmentUrl: (data.attachmentUrl as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
      ...(resolvedReviewedById !== undefined ? { reviewedById: resolvedReviewedById } : {}),
      ...(data.additionalInformation !== undefined
        ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
        : {}),
    };

    return prisma.vendorQuotation.update({
      where: { id, organizationId },
      data: updateData,
      include: vendorQuotationDetailInclude,
    });
  }

  /**
   * Soft-delete Quotation
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.vendorQuotation.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Update status of Quotation
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: Prisma.EnumVendorQuotationStatusFilter["equals"],
    reviewedById?: string,
    vendorRating?: number,
    evaluationNotes?: string
  ) {
    let resolvedReviewedById: string | null | undefined = undefined;
    if (reviewedById !== undefined) {
      resolvedReviewedById = await this.resolveUserId(reviewedById, organizationId);
    }

    const data: Prisma.VendorQuotationUncheckedUpdateInput = {
      status,
      ...(evaluationNotes !== undefined ? { evaluationNotes } : {}),
      ...(vendorRating !== undefined ? { vendorRating } : {}),
      ...(resolvedReviewedById !== undefined ? { reviewedById: resolvedReviewedById } : {}),
    };

    return prisma.vendorQuotation.update({
      where: { id, organizationId },
      data,
      include: vendorQuotationDetailInclude,
    });
  }

  // ==========================================
  // Quotation Items
  // ==========================================

  async addItem(quotationId: string, organizationId: string, itemData: CreateQuotationItemInput) {
    return prisma.$transaction(async (tx) => {
      const qty = Number(itemData.quantity);
      const rate = Number(itemData.unitRate);
      const disc = Number(itemData.discountPercent || 0);
      const taxR = Number(itemData.taxRate || 18.0);
      const base = qty * rate * (1 - disc / 100);
      const itemTotal =
        itemData.totalAmount !== undefined
          ? itemData.totalAmount
          : base * (1 + taxR / 100);

      const createItemData: Prisma.VendorQuotationItemUncheckedCreateInput = {
        organizationId,
        quotationId,
        rfqItemId: itemData.rfqItemId || null,
        materialProductId: itemData.materialProductId || null,
        name: itemData.name,
        brand: itemData.brand || null,
        specifications: itemData.specifications || null,
        quantity: itemData.quantity,
        unit: itemData.unit,
        unitRate: itemData.unitRate,
        taxRate: itemData.taxRate || 18.0,
        discountPercent: itemData.discountPercent || 0,
        totalAmount: itemTotal,
        deliveryDays: itemData.deliveryDays || null,
        remarks: itemData.remarks || null,
        additionalInformation: (itemData.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      };

      const createdItem = await tx.vendorQuotationItem.create({
        data: createItemData,
        include: quotationItemInclude,
      });

      // Recalculate quotation subtotal & total
      const allItems = await tx.vendorQuotationItem.findMany({
        where: { quotationId, organizationId },
        select: { totalAmount: true },
      });

      const subtotal = allItems.reduce((acc, it) => acc + Number(it.totalAmount || 0), 0);
      const quote = await tx.vendorQuotation.findUnique({
        where: { id: quotationId },
        select: { discount: true, tax: true, freight: true },
      });

      const totalAmount =
        subtotal -
        Number(quote?.discount || 0) +
        Number(quote?.tax || 0) +
        Number(quote?.freight || 0);

      await tx.vendorQuotation.update({
        where: { id: quotationId },
        data: { subtotal, totalAmount },
      });

      return createdItem;
    });
  }

  async updateItem(
    itemId: string,
    quotationId: string,
    organizationId: string,
    data: UpdateQuotationItemInput
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.vendorQuotationItem.findFirst({
        where: { id: itemId, quotationId, organizationId },
      });

      if (!existing) return null;

      const qty = data.quantity !== undefined ? Number(data.quantity) : Number(existing.quantity);
      const rate = data.unitRate !== undefined ? Number(data.unitRate) : Number(existing.unitRate);
      const disc = data.discountPercent !== undefined ? Number(data.discountPercent) : Number(existing.discountPercent);
      const taxR = data.taxRate !== undefined ? Number(data.taxRate) : Number(existing.taxRate);
      const base = qty * rate * (1 - disc / 100);
      const itemTotal = data.totalAmount !== undefined ? Number(data.totalAmount) : base * (1 + taxR / 100);

      const updatePayload: Prisma.VendorQuotationItemUncheckedUpdateInput = {
        ...(data.rfqItemId !== undefined ? { rfqItemId: data.rfqItemId || null } : {}),
        ...(data.materialProductId !== undefined ? { materialProductId: data.materialProductId || null } : {}),
        ...(data.name ? { name: data.name } : {}),
        ...(data.brand !== undefined ? { brand: data.brand } : {}),
        ...(data.specifications !== undefined ? { specifications: data.specifications } : {}),
        ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
        ...(data.unit ? { unit: data.unit } : {}),
        ...(data.unitRate !== undefined ? { unitRate: data.unitRate } : {}),
        ...(data.taxRate !== undefined ? { taxRate: data.taxRate } : {}),
        ...(data.discountPercent !== undefined ? { discountPercent: data.discountPercent } : {}),
        totalAmount: itemTotal,
        ...(data.deliveryDays !== undefined ? { deliveryDays: data.deliveryDays } : {}),
        ...(data.remarks !== undefined ? { remarks: data.remarks } : {}),
        ...(data.additionalInformation !== undefined
          ? { additionalInformation: (data.additionalInformation as Prisma.InputJsonValue) ?? Prisma.JsonNull }
          : {}),
      };

      const updatedItem = await tx.vendorQuotationItem.update({
        where: { id: itemId },
        data: updatePayload,
        include: quotationItemInclude,
      });

      // Recalculate quotation subtotal & total
      const allItems = await tx.vendorQuotationItem.findMany({
        where: { quotationId, organizationId },
        select: { totalAmount: true },
      });

      const subtotal = allItems.reduce((acc, it) => acc + Number(it.totalAmount || 0), 0);
      const quote = await tx.vendorQuotation.findUnique({
        where: { id: quotationId },
        select: { discount: true, tax: true, freight: true },
      });

      const totalAmount =
        subtotal -
        Number(quote?.discount || 0) +
        Number(quote?.tax || 0) +
        Number(quote?.freight || 0);

      await tx.vendorQuotation.update({
        where: { id: quotationId },
        data: { subtotal, totalAmount },
      });

      return updatedItem;
    });
  }

  async removeItem(itemId: string, quotationId: string, organizationId: string) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.vendorQuotationItem.findFirst({
        where: { id: itemId, quotationId, organizationId },
      });

      if (!existing) return null;

      await tx.vendorQuotationItem.delete({
        where: { id: itemId },
      });

      // Recalculate quotation subtotal & total
      const allItems = await tx.vendorQuotationItem.findMany({
        where: { quotationId, organizationId },
        select: { totalAmount: true },
      });

      const subtotal = allItems.reduce((acc, it) => acc + Number(it.totalAmount || 0), 0);
      const quote = await tx.vendorQuotation.findUnique({
        where: { id: quotationId },
        select: { discount: true, tax: true, freight: true },
      });

      const totalAmount =
        subtotal -
        Number(quote?.discount || 0) +
        Number(quote?.tax || 0) +
        Number(quote?.freight || 0);

      await tx.vendorQuotation.update({
        where: { id: quotationId },
        data: { subtotal, totalAmount },
      });

      return existing;
    });
  }
}

export const vendorQuotationRepo = new VendorQuotationRepository();

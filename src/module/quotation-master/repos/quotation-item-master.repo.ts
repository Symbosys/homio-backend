import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetQuotationItemsQueryInput } from "../validators/quotation-item-master.validator.js";

/**
 * Repository: Quotation Item Master Data Access
 * Handles tenant-isolated CRUD, multi-criteria filtering, pagination, and gallery management
 */
export class QuotationItemMasterRepo {
  /**
   * Create a new Quotation Item Master record
   */
  async create(
    organizationId: string,
    data: Omit<Prisma.QuotationItemMasterUncheckedCreateInput, "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationItemMaster.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  /**
   * Bulk create Quotation Item Master records
   */
  async bulkCreate(
    organizationId: string,
    items: Array<Omit<Prisma.QuotationItemMasterUncheckedCreateInput, "organizationId">>,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationItemMaster.createMany({
      data: items.map((item) => ({
        ...item,
        organizationId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Find item by ID within tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.quotationItemMaster.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find item by SKU within tenant organization
   */
  async findBySku(sku: string, organizationId: string) {
    return prisma.quotationItemMaster.findFirst({
      where: {
        sku: { equals: sku, mode: "insensitive" },
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Fetch paginated list of items with rich filters
   */
  async findAll(organizationId: string, query: GetQuotationItemsQueryInput) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      subcategory,
      uom,
      brand,
      tag,
      isActive,
      minCost,
      maxCost,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.QuotationItemMasterWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (category) {
      where.category = category;
    }

    if (subcategory) {
      where.subcategory = { contains: subcategory, mode: "insensitive" };
    }

    if (uom) {
      where.uom = { equals: uom, mode: "insensitive" };
    }

    if (brand) {
      where.approvedBrands = { has: brand };
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (minCost !== undefined || maxCost !== undefined) {
      where.unitCost = {};
      if (minCost !== undefined) {
        where.unitCost.gte = minCost;
      }
      if (maxCost !== undefined) {
        where.unitCost.lte = maxCost;
      }
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
        { technicalSpecs: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { subcategory: { contains: term, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.quotationItemMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      prisma.quotationItemMaster.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Update item master record
   */
  async update(
    id: string,
    organizationId: string,
    data: Prisma.QuotationItemMasterUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationItemMaster.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete item master record
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationItemMaster.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Toggle active state of an item
   */
  async toggleActive(id: string, currentStatus: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationItemMaster.update({
      where: { id },
      data: {
        isActive: !currentStatus,
      },
    });
  }

  /**
   * Group items by category for summary metrics
   */
  async getCategorySummary(organizationId: string) {
    const counts = await prisma.quotationItemMaster.groupBy({
      by: ["category"],
      where: {
        organizationId,
        isDeleted: false,
      },
      _count: {
        id: true,
      },
    });

    return counts.map((c) => ({
      category: c.category,
      count: c._count.id,
    }));
  }
}

export const quotationItemMasterRepo = new QuotationItemMasterRepo();

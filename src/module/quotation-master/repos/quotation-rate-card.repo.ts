import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetRateCardsQueryInput } from "../validators/quotation-rate-card.validator.js";

/**
 * Repository: Quotation Rate Card Data Access
 * Handles pricing tiers, markup configurations, default card switching, and reordering
 */
export class QuotationRateCardRepo {
  /**
   * Create a new Rate Card
   */
  async create(
    organizationId: string,
    data: Omit<Prisma.QuotationRateCardUncheckedCreateInput, "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationRateCard.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  /**
   * Find Rate Card by ID within tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.quotationRateCard.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find Rate Card by Code within tenant organization
   */
  async findByCode(code: string, organizationId: string) {
    return prisma.quotationRateCard.findFirst({
      where: {
        code: { equals: code, mode: "insensitive" },
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find the default active Rate Card for the tenant
   */
  async findDefault(organizationId: string) {
    return prisma.quotationRateCard.findFirst({
      where: {
        organizationId,
        isDefault: true,
        isActive: true,
        isDeleted: false,
      },
    });
  }

  /**
   * List all non-paginated Rate Cards for the tenant
   */
  async findAll(organizationId: string, query: GetRateCardsQueryInput) {
    const { search, tierType, isActive } = query;

    const where: Prisma.QuotationRateCardWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (tierType) {
      where.tierType = tierType;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { code: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ];
    }

    return prisma.quotationRateCard.findMany({
      where,
      orderBy: [
        { sortOrder: "asc" },
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Unset isDefault flag on other rate cards within the tenant
   */
  async clearExistingDefault(organizationId: string, excludeId?: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationRateCard.updateMany({
      where: {
        organizationId,
        isDefault: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: {
        isDefault: false,
      },
    });
  }

  /**
   * Update Rate Card record
   */
  async update(
    id: string,
    organizationId: string,
    data: Prisma.QuotationRateCardUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationRateCard.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete Rate Card
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationRateCard.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
        isDefault: false,
      },
    });
  }

  /**
   * Toggle active status of a Rate Card
   */
  async toggleActive(id: string, currentStatus: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationRateCard.update({
      where: { id },
      data: {
        isActive: !currentStatus,
      },
    });
  }

  /**
   * Reorder rate cards in batch transaction
   */
  async reorder(
    organizationId: string,
    orders: Array<{ id: string; sortOrder: number }>
  ) {
    return prisma.$transaction(
      orders.map((item) =>
        prisma.quotationRateCard.updateMany({
          where: {
            id: item.id,
            organizationId,
            isDeleted: false,
          },
          data: {
            sortOrder: item.sortOrder,
          },
        })
      )
    );
  }
}

export const quotationRateCardRepo = new QuotationRateCardRepo();

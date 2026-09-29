import { prisma } from "../../../lib/prisma.js";
import { Prisma, PdfPageImagePosition } from "../../../types/types.js";
import type { GetPdfAssetsQueryInput } from "../validators/quotation-pdf-asset.validator.js";

/**
 * Repository: Quotation PDF Page Asset Data Access
 * Enforces max 10 FRONT / 10 BACK image quotas per tenant, manages sequential sortOrder and metadata
 */
export class QuotationPdfAssetRepo {
  /**
   * Count active/non-deleted assets by position within tenant
   */
  async countByPosition(organizationId: string, position: PdfPageImagePosition) {
    return prisma.quotationPdfPageAsset.count({
      where: {
        organizationId,
        position,
        isDeleted: false,
      },
    });
  }

  /**
   * Determine next sort order for a given position (0 to 9)
   */
  async getNextSortOrder(organizationId: string, position: PdfPageImagePosition): Promise<number> {
    const highest = await prisma.quotationPdfPageAsset.findFirst({
      where: {
        organizationId,
        position,
        isDeleted: false,
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    if (!highest) {
      return 0;
    }
    return Math.min(highest.sortOrder + 1, 9);
  }

  /**
   * Create a new PDF Page Asset
   */
  async create(
    organizationId: string,
    data: Omit<Prisma.QuotationPdfPageAssetUncheckedCreateInput, "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationPdfPageAsset.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  /**
   * Find PDF Asset by ID within tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.quotationPdfPageAsset.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * List all non-paginated PDF assets for tenant
   */
  async findAll(organizationId: string, query: GetPdfAssetsQueryInput) {
    const { position, search, pageTag, isActive } = query;

    const where: Prisma.QuotationPdfPageAssetWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (position) {
      where.position = position;
    }

    if (pageTag) {
      where.pageTag = pageTag;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: "insensitive" } },
        { pageTag: { contains: term, mode: "insensitive" } },
      ];
    }

    return prisma.quotationPdfPageAsset.findMany({
      where,
      orderBy: [
        { position: "asc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });
  }

  /**
   * Get summary counts and limits for tenant PDF page assets
   */
  async getSummary(organizationId: string) {
    const [frontCount, backCount] = await Promise.all([
      prisma.quotationPdfPageAsset.count({
        where: {
          organizationId,
          position: PdfPageImagePosition.FRONT,
          isDeleted: false,
        },
      }),
      prisma.quotationPdfPageAsset.count({
        where: {
          organizationId,
          position: PdfPageImagePosition.BACK,
          isDeleted: false,
        },
      }),
    ]);

    const MAX_LIMIT = 10;

    return {
      front: {
        count: frontCount,
        maxLimit: MAX_LIMIT,
        remainingSlots: Math.max(0, MAX_LIMIT - frontCount),
        isLimitReached: frontCount >= MAX_LIMIT,
      },
      back: {
        count: backCount,
        maxLimit: MAX_LIMIT,
        remainingSlots: Math.max(0, MAX_LIMIT - backCount),
        isLimitReached: backCount >= MAX_LIMIT,
      },
    };
  }

  /**
   * Update PDF Asset record
   */
  async update(
    id: string,
    organizationId: string,
    data: Prisma.QuotationPdfPageAssetUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.quotationPdfPageAsset.update({
      where: { id },
      data,
    });
  }

  /**
   * Soft delete PDF Asset
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationPdfPageAsset.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Toggle active status
   */
  async toggleActive(id: string, currentStatus: boolean, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.quotationPdfPageAsset.update({
      where: { id },
      data: {
        isActive: !currentStatus,
      },
    });
  }

  /**
   * Batch update sort orders within a position
   */
  async reorder(
    organizationId: string,
    position: PdfPageImagePosition,
    orders: Array<{ id: string; sortOrder: number }>
  ) {
    return prisma.$transaction(
      orders.map((item) =>
        prisma.quotationPdfPageAsset.updateMany({
          where: {
            id: item.id,
            organizationId,
            position,
            isDeleted: false,
          },
          data: {
            sortOrder: item.sortOrder,
          },
        })
      )
    );
  }

  /**
   * Recompact remaining sort orders for a position after deletion
   */
  async recompactSortOrders(
    organizationId: string,
    position: PdfPageImagePosition,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    const assets = await client.quotationPdfPageAsset.findMany({
      where: {
        organizationId,
        position,
        isDeleted: false,
      },
      orderBy: { sortOrder: "asc" },
      select: { id: true },
    });

    for (const [index, asset] of assets.entries()) {
      await client.quotationPdfPageAsset.update({
        where: { id: asset.id },
        data: { sortOrder: index },
      });
    }
  }
}

export const quotationPdfAssetRepo = new QuotationPdfAssetRepo();

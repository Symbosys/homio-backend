import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetChannelPartnersQueryInput } from "../validators/channel-partner.validator.js";

/**
 * Repository: Channel Partner Master Data Access
 * Handles multi-tenant queries, sequential code generation, and aggregations
 */
export class ChannelPartnerRepo {
  /**
   * Generates next sequential partner code for the tenant (e.g. CP-1001, CP-1002)
   */
  async generatePartnerCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const client = tx || prisma;
    const latestPartner = await client.channelPartner.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      select: { partnerCode: true },
    });

    if (!latestPartner || !latestPartner.partnerCode) {
      return "CP-1001";
    }

    const match = latestPartner.partnerCode.match(/CP-(\d+)/);
    if (!match || !match[1]) {
      const totalCount = await client.channelPartner.count({ where: { organizationId } });
      return `CP-${1000 + totalCount + 1}`;
    }

    const nextNumber = parseInt(match[1], 10) + 1;
    return `CP-${nextNumber}`;
  }

  /**
   * Create a new Channel Partner record
   */
  async create(
    organizationId: string,
    data: Omit<Prisma.ChannelPartnerUncheckedCreateInput, "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.channelPartner.create({
      data: {
        ...data,
        organizationId,
      },
    });
  }

  /**
   * Find Channel Partner by ID within tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.channelPartner.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        _count: {
          select: {
            channelPartnerLeads: true,
            payouts: true,
          },
        },
        payouts: {
          take: 5,
          orderBy: { paymentDate: "desc" },
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            status: true,
            paymentDate: true,
            transactionReference: true,
          },
        },
      },
    });
  }

  /**
   * Find Channel Partner by phone within tenant organization (for deduplication)
   */
  async findByPhone(phone: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.channelPartner.findFirst({
      where: {
        phone,
        organizationId,
        isDeleted: false,
      },
    });
  }

  /**
   * Find all Channel Partners for tenant organization with search, filters, and pagination
   */
  async findAll(organizationId: string, query: GetChannelPartnersQueryInput) {
    const { page, limit, search, status, kycStatus, partnerType, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ChannelPartnerWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(kycStatus ? { kycStatus } : {}),
      ...(partnerType ? { partnerType: { contains: partnerType, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { partnerCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.channelPartner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              channelPartnerLeads: true,
              payouts: true,
            },
          },
        },
      }),
      prisma.channelPartner.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update Channel Partner properties (dirty update)
   */
  async update(
    id: string,
    organizationId: string,
    data: Prisma.ChannelPartnerUncheckedUpdateInput,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.channelPartner.update({
      where: {
        id,
      },
      data,
    });
  }

  /**
   * Soft delete Channel Partner
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const client = tx || prisma;
    return client.channelPartner.update({
      where: {
        id,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const channelPartnerRepo = new ChannelPartnerRepo();

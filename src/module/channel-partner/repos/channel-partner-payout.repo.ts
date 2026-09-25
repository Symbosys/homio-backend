import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetCPPayoutsQueryInput } from "../validators/channel-partner-payout.validator.js";

/**
 * Repository: Channel Partner Payouts Data Access
 * Handles commission payout ledger recording, financial history, and queries
 */
export class ChannelPartnerPayoutRepo {
  /**
   * Create a new Payout record
   */
  async create(
    organizationId: string,
    data: Omit<Prisma.ChannelPartnerPayoutUncheckedCreateInput, "organizationId">,
    tx?: Prisma.TransactionClient
  ) {
    const client = tx || prisma;
    return client.channelPartnerPayout.create({
      data: {
        ...data,
        organizationId,
      },
      include: {
        channelPartner: {
          select: {
            id: true,
            name: true,
            partnerCode: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });
  }

  /**
   * Find Payout by ID within tenant organization
   */
  async findById(id: string, organizationId: string) {
    return prisma.channelPartnerPayout.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        channelPartner: {
          select: {
            id: true,
            name: true,
            partnerCode: true,
            companyName: true,
            phone: true,
            email: true,
            bankDetails: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Find all Payouts for tenant organization with filters and pagination
   */
  async findAll(organizationId: string, query: GetCPPayoutsQueryInput) {
    const { page, limit, channelPartnerId, leadId, paymentMode, status, fromDate, toDate, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ChannelPartnerPayoutWhereInput = {
      organizationId,
      ...(channelPartnerId ? { channelPartnerId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(paymentMode ? { paymentMode } : {}),
      ...(status ? { status } : {}),
      ...(fromDate || toDate
        ? {
            paymentDate: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
    };

    const [items, total, aggregateTotal] = await Promise.all([
      prisma.channelPartnerPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          channelPartner: {
            select: {
              id: true,
              name: true,
              partnerCode: true,
              companyName: true,
              phone: true,
            },
          },
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
            },
          },
          processedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.channelPartnerPayout.count({ where }),
      prisma.channelPartnerPayout.aggregate({
        where,
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      items,
      totalAmountPaid: aggregateTotal._sum.amount || 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find all payouts for a specific Channel Partner
   */
  async findByPartnerId(partnerId: string, organizationId: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const where: Prisma.ChannelPartnerPayoutWhereInput = {
      organizationId,
      channelPartnerId: partnerId,
    };

    const [items, total, aggregateTotal] = await Promise.all([
      prisma.channelPartnerPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: "desc" },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
            },
          },
          processedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.channelPartnerPayout.count({ where }),
      prisma.channelPartnerPayout.aggregate({
        where,
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      items,
      totalAmountPaid: aggregateTotal._sum.amount || 0,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const channelPartnerPayoutRepo = new ChannelPartnerPayoutRepo();

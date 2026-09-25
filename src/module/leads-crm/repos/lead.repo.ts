import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateLeadInput,
  UpdateLeadInput,
  GetLeadsQueryInput,
} from "../validators/lead.validator.js";

export class LeadRepository {
  /**
   * Create a new Lead in the CRM pipeline
   */
  async create(
    organizationId: string,
    data: Omit<CreateLeadInput, "customer"> & {
      customerId: string;
      leadCode: string;
      inquiryNumber: number;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const {
      possessionDate,
      customFields,
      additionalInformation,
      tags,
      estimatedBudget,
      customer,
      ...directFields
    } = data as any;

    return db.lead.create({
      data: {
        ...directFields,
        organizationId,
        estimatedBudget:
          estimatedBudget !== undefined && estimatedBudget !== null
            ? new Prisma.Decimal(estimatedBudget)
            : null,
        possessionDate: possessionDate ? new Date(possessionDate) : null,
        tags: tags || [],
        customFields: customFields
          ? (customFields as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        additionalInformation: additionalInformation
          ? (additionalInformation as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            salutation: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            email: true,
            companyName: true,
            billingCity: true,
            avatarUrl: true,
            totalInquiriesCount: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workEmail: true,
          },
        },
        channelPartnerLead: {
          select: {
            id: true,
            channelPartnerId: true,
            status: true,
            commissionType: true,
            commissionRate: true,
            commissionAmount: true,
            commissionPaidAmount: true,
            commissionDueAmount: true,
            commissionStatus: true,
            channelPartner: {
              select: {
                id: true,
                partnerCode: true,
                name: true,
                companyName: true,
                phone: true,
              },
            },
          },
        },
        lostReasonRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            group: true,
            color: true,
            icon: true,
          },
        },
      },
    });
  }

  /**
   * Find single lead by ID with full relational details
   */
  async findById(id: string, organizationId: string) {
    return prisma.lead.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            salutation: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            alternatePhone: true,
            email: true,
            companyName: true,
            gstin: true,
            panNumber: true,
            status: true,
            billingAddress: true,
            billingCity: true,
            billingState: true,
            billingPincode: true,
            shippingAddress: true,
            shippingCity: true,
            shippingState: true,
            shippingPincode: true,
            avatarUrl: true,
            totalInquiriesCount: true,
            portalAccessEnabled: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
            workEmail: true,
            workPhone: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        convertedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        channelPartnerLead: {
          select: {
            id: true,
            channelPartnerId: true,
            status: true,
            commissionType: true,
            commissionRate: true,
            commissionAmount: true,
            commissionPaidAmount: true,
            commissionDueAmount: true,
            commissionStatus: true,
            notes: true,
            channelPartner: {
              select: {
                id: true,
                partnerCode: true,
                name: true,
                companyName: true,
                partnerType: true,
                phone: true,
                alternatePhone: true,
                email: true,
                address: true,
                city: true,
                state: true,
                pincode: true,
                panNumber: true,
                gstNumber: true,
                aadhaarNumber: true,
                kycStatus: true,
                kycDetails: true,
                status: true,
                notes: true,
                bankDetails: true,
                avatarUrl: true,
                defaultCommissionType: true,
                defaultCommissionValue: true,
                createdAt: true,
              },
            },
            payouts: {
              orderBy: { paymentDate: "desc" },
              select: {
                id: true,
                amount: true,
                paymentMode: true,
                transactionReference: true,
                status: true,
                paymentDate: true,
                receiptUrl: true,
                remarks: true,
              },
            },
          },
        },
        lostReasonRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            group: true,
            color: true,
            icon: true,
          },
        },
        followUps: {
          orderBy: { scheduledAt: "asc" },
          include: {
            assignedTo: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          include: {
            performedBy: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        stageHistories: {
          orderBy: { createdAt: "desc" },
          include: {
            changedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find all leads with robust search, pipeline stage filters, and pagination
   */
  async findAll(organizationId: string, query: GetLeadsQueryInput) {
    const {
      page,
      limit,
      search,
      projectType,
      status,
      source,
      priority,
      assignedToId,
      customerId,
      channelPartnerId,
      propertyName,
      possessionStatus,
      propertyCity,
      propertyState,
      minBudget,
      maxBudget,
      fromDate,
      toDate,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const effectiveFrom = fromDate || startDate;
    const effectiveTo = toDate || endDate;

    let fromDateObj: Date | undefined;
    if (effectiveFrom) {
      fromDateObj = new Date(
        effectiveFrom.length === 10
          ? `${effectiveFrom}T00:00:00.000Z`
          : effectiveFrom,
      );
    }

    let toDateObj: Date | undefined;
    if (effectiveTo) {
      toDateObj = new Date(
        effectiveTo.length === 10
          ? `${effectiveTo}T23:59:59.999Z`
          : effectiveTo,
      );
    }

    const where: Prisma.LeadWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectType ? { projectType } : {}),
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(channelPartnerId ? { channelPartnerLead: { channelPartnerId } } : {}),
      ...(possessionStatus ? { possessionStatus } : {}),
      ...(propertyName
        ? { propertyName: { contains: propertyName, mode: "insensitive" } }
        : {}),
      ...(propertyCity
        ? { propertyCity: { contains: propertyCity, mode: "insensitive" } }
        : {}),
      ...(propertyState
        ? { propertyState: { contains: propertyState, mode: "insensitive" } }
        : {}),
      ...(minBudget !== undefined || maxBudget !== undefined
        ? {
            estimatedBudget: {
              ...(minBudget !== undefined ? { gte: minBudget } : {}),
              ...(maxBudget !== undefined ? { lte: maxBudget } : {}),
            },
          }
        : {}),
      ...(fromDateObj || toDateObj
        ? {
            createdAt: {
              ...(fromDateObj ? { gte: fromDateObj } : {}),
              ...(toDateObj ? { lte: toDateObj } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { leadCode: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { propertyName: { contains: search, mode: "insensitive" } },
              { propertyAddress: { contains: search, mode: "insensitive" } },
              { propertyCity: { contains: search, mode: "insensitive" } },
              { propertyState: { contains: search, mode: "insensitive" } },
              {
                customer: {
                  OR: [
                    { firstName: { contains: search, mode: "insensitive" } },
                    { lastName: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search } },
                    { email: { contains: search, mode: "insensitive" } },
                    { companyName: { contains: search, mode: "insensitive" } },
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              customerCode: true,
              customerType: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              email: true,
              companyName: true,
              billingCity: true,
              avatarUrl: true,
              totalInquiriesCount: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              designation: true,
            },
          },
          channelPartnerLead: {
            select: {
              id: true,
              channelPartnerId: true,
              status: true,
              commissionType: true,
              commissionRate: true,
              commissionAmount: true,
              commissionPaidAmount: true,
              commissionDueAmount: true,
              commissionStatus: true,
              channelPartner: {
                select: {
                  id: true,
                  partnerCode: true,
                  name: true,
                  companyName: true,
                  phone: true,
                },
              },
            },
          },
          lostReasonRef: {
            select: {
              id: true,
              name: true,
              slug: true,
              code: true,
              group: true,
              color: true,
              icon: true,
            },
          },
          _count: {
            select: {
              followUps: true,
              activities: true,
              documents: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update lead details
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateLeadInput & {
      assignedById?: string | null;
      assignedAt?: Date | null;
      convertedById?: string | null;
      convertedAt?: Date | null;
      convertedProjectId?: string | null;
      lostReason?: string | null;
      lostRemarks?: string | null;
      lostAt?: Date | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const {
      possessionDate,
      estimatedBudget,
      customFields,
      additionalInformation,
      ...directFields
    } = data;

    return db.lead.update({
      where: { id },
      data: {
        ...directFields,
        ...(possessionDate !== undefined
          ? { possessionDate: possessionDate ? new Date(possessionDate) : null }
          : {}),
        ...(estimatedBudget !== undefined
          ? {
              estimatedBudget:
                estimatedBudget !== null
                  ? new Prisma.Decimal(estimatedBudget)
                  : null,
            }
          : {}),
        ...(customFields !== undefined
          ? {
              customFields: customFields
                ? (customFields as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
        ...(additionalInformation !== undefined
          ? {
              additionalInformation: additionalInformation
                ? (additionalInformation as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            }
          : {}),
      } as Prisma.LeadUncheckedUpdateInput,
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        lostReasonRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            group: true,
            color: true,
            icon: true,
          },
        },
      },
    });
  }

  /**
   * Update lead status and record stage transition history atomically
   */
  async updateStatusWithHistory(
    id: string,
    organizationId: string,
    fromStage: any,
    toStage: any,
    changedById?: string | null,
    remarks?: string | null,
    durationMinutes?: number | null,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    const [updatedLead, stageHistory] = await Promise.all([
      db.lead.update({
        where: { id },
        data: {
          status: toStage,
          ...(toStage === "WON"
            ? { convertedAt: new Date(), convertedById: changedById || null }
            : {}),
        },
      }),
      db.leadStageHistory.create({
        data: {
          organizationId,
          leadId: id,
          fromStage: fromStage || null,
          toStage,
          changedById: changedById || null,
          remarks: remarks || null,
          durationMinutes: durationMinutes || null,
        },
      }),
    ]);

    return { updatedLead, stageHistory };
  }

  /**
   * Generate sequential lead code (e.g. LEAD-2026-0001)
   */
  async generateLeadCode(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const count = await db.lead.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
        },
      },
    });

    return `LEAD-${currentYear}-${String(count + 1).padStart(4, "0")}`;
  }

  /**
   * Bulk assign leads
   */
  async bulkAssign(
    leadIds: string[],
    organizationId: string,
    assignedToId: string | null,
    assignedById?: string | null,
  ) {
    return prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        organizationId,
        isDeleted: false,
      },
      data: {
        assignedToId,
        assignedAt: assignedToId ? new Date() : null,
        assignedById: assignedToId ? assignedById || null : null,
      },
    });
  }

  /**
   * Bulk update status
   */
  async bulkUpdateStatus(
    leadIds: string[],
    organizationId: string,
    status: any,
    changedById?: string | null,
  ) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: {
          id: { in: leadIds },
          organizationId,
          isDeleted: false,
        },
        data: {
          status,
          ...(status === "WON"
            ? { convertedAt: new Date(), convertedById: changedById || null }
            : {}),
        },
      });

      // Insert stage history for each
      const historyRows = leadIds.map((leadId) => ({
        organizationId,
        leadId,
        toStage: status,
        changedById: changedById || null,
        remarks: "Bulk status update",
      }));

      await tx.leadStageHistory.createMany({
        data: historyRows,
      });

      return updated;
    });
  }

  /**
   * Bulk soft-delete leads
   */
  async bulkDelete(leadIds: string[], organizationId: string) {
    return prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        organizationId,
        isDeleted: false,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Soft delete lead
   */
  async softDelete(id: string, organizationId: string) {
    return prisma.lead.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Pipeline Analytics & Aggregations
   */
  async getAnalytics(
    organizationId: string,
    filters?: {
      fromDate?: string;
      toDate?: string;
      assignedToId?: string;
    },
  ) {
    const where: Prisma.LeadWhereInput = {
      organizationId,
      isDeleted: false,
      ...(filters?.assignedToId ? { assignedToId: filters.assignedToId } : {}),
      ...(filters?.fromDate || filters?.toDate
        ? {
            createdAt: {
              ...(filters.fromDate ? { gte: new Date(filters.fromDate) } : {}),
              ...(filters.toDate ? { lte: new Date(filters.toDate) } : {}),
            },
          }
        : {}),
    };

    const [
      totalLeads,
      statusGroups,
      sourceGroups,
      priorityGroups,
      budgetAggregations,
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ["status"],
        where,
        _count: { id: true },
        _sum: { estimatedBudget: true },
      }),
      prisma.lead.groupBy({
        by: ["source"],
        where,
        _count: { id: true },
      }),
      prisma.lead.groupBy({
        by: ["priority"],
        where,
        _count: { id: true },
      }),
      prisma.lead.aggregate({
        where,
        _sum: { estimatedBudget: true },
        _avg: { estimatedBudget: true, qualificationScore: true },
      }),
    ]);

    const wonLeadsCount =
      statusGroups.find((g) => g.status === "WON")?._count.id || 0;
    const lostLeadsCount =
      statusGroups.find((g) => g.status === "LOST")?._count.id || 0;
    const conversionRate =
      totalLeads > 0 ? ((wonLeadsCount / totalLeads) * 100).toFixed(2) : "0.00";

    return {
      totalLeads,
      wonLeadsCount,
      lostLeadsCount,
      conversionRate: Number(conversionRate),
      totalPipelineValue: budgetAggregations._sum.estimatedBudget || 0,
      averageDealValue: budgetAggregations._avg.estimatedBudget || 0,
      averageQualificationScore: Math.round(
        budgetAggregations._avg.qualificationScore || 0,
      ),
      byStatus: statusGroups.map((g) => ({
        status: g.status,
        count: g._count.id,
        totalValue: g._sum.estimatedBudget || 0,
      })),
      bySource: sourceGroups.map((g) => ({
        source: g.source,
        count: g._count.id,
      })),
      byPriority: priorityGroups.map((g) => ({
        priority: g.priority,
        count: g._count.id,
      })),
    };
  }

  /**
   * Get distinct property names for dropdown search
   */
  async getDistinctProperties(
    organizationId: string,
    query: { city?: string; state?: string; search?: string },
  ) {
    const { city, state, search } = query;
    const where: Prisma.LeadWhereInput = {
      organizationId,
      isDeleted: false,
      propertyName: { not: null },
      ...(city
        ? { propertyCity: { contains: city, mode: "insensitive" } }
        : {}),
      ...(state
        ? { propertyState: { contains: state, mode: "insensitive" } }
        : {}),
      ...(search
        ? { propertyName: { contains: search, mode: "insensitive" } }
        : {}),
    };

    const results = await prisma.lead.findMany({
      where,
      select: {
        propertyName: true,
        propertyCity: true,
        propertyState: true,
      },
      distinct: ["propertyName"],
      take: 100,
      orderBy: { propertyName: "asc" },
    });

    return results
      .filter((r) => Boolean(r.propertyName))
      .map((r) => ({
        propertyName: r.propertyName!,
        city: r.propertyCity || null,
        state: r.propertyState || null,
      }));
  }

  /**
   * Link or update Channel Partner on Lead
   */
  async upsertChannelPartnerLead(
    leadId: string,
    organizationId: string,
    data: {
      channelPartnerId?: string;
      status?:
        "IN_PROGRESS" | "MEETING_DONE" | "BOOKED" | "NOT_INTERESTED" | "LOST";
      commissionType?: "PERCENTAGE" | "FIXED_AMOUNT";
      commissionRate?: number | null;
      commissionAmount?: number | null;
      commissionStatus?: "DUE" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
      notes?: string | null;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;
    const existing = await db.channelPartnerLead.findUnique({
      where: { leadId },
    });

    if (existing) {
      return db.channelPartnerLead.update({
        where: { leadId },
        data: {
          ...(data.channelPartnerId
            ? { channelPartnerId: data.channelPartnerId }
            : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(data.commissionType
            ? { commissionType: data.commissionType }
            : {}),
          ...(data.commissionRate !== undefined
            ? {
                commissionRate:
                  data.commissionRate !== null
                    ? new Prisma.Decimal(data.commissionRate)
                    : null,
              }
            : {}),
          ...(data.commissionAmount !== undefined
            ? {
                commissionAmount:
                  data.commissionAmount !== null
                    ? new Prisma.Decimal(data.commissionAmount)
                    : null,
                commissionDueAmount:
                  data.commissionAmount !== null
                    ? new Prisma.Decimal(data.commissionAmount).sub(
                        existing.commissionPaidAmount,
                      )
                    : null,
              }
            : {}),
          ...(data.commissionStatus
            ? { commissionStatus: data.commissionStatus }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
        include: {
          channelPartner: {
            select: {
              id: true,
              partnerCode: true,
              name: true,
              companyName: true,
              phone: true,
            },
          },
        },
      });
    }

    if (!data.channelPartnerId) {
      throw new Error("channelPartnerId is required to link channel partner");
    }

    return db.channelPartnerLead.create({
      data: {
        organizationId,
        leadId,
        channelPartnerId: data.channelPartnerId,
        status: data.status || "IN_PROGRESS",
        commissionType: data.commissionType || "PERCENTAGE",
        commissionRate:
          data.commissionRate !== undefined && data.commissionRate !== null
            ? new Prisma.Decimal(data.commissionRate)
            : null,
        commissionAmount:
          data.commissionAmount !== undefined && data.commissionAmount !== null
            ? new Prisma.Decimal(data.commissionAmount)
            : null,
        commissionDueAmount:
          data.commissionAmount !== undefined && data.commissionAmount !== null
            ? new Prisma.Decimal(data.commissionAmount)
            : null,
        commissionStatus: data.commissionStatus || "DUE",
        notes: data.notes || null,
      },
      include: {
        channelPartner: {
          select: {
            id: true,
            partnerCode: true,
            name: true,
            companyName: true,
            phone: true,
          },
        },
      },
    });
  }
}

export const leadRepo = new LeadRepository();

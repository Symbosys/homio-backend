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
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { possessionDate, customFields, additionalInformation, tags, estimatedBudget, customer, ...directFields } = data as any;

    return db.lead.create({
      data: {
        ...directFields,
        organizationId,
        estimatedBudget: estimatedBudget !== undefined && estimatedBudget !== null ? new Prisma.Decimal(estimatedBudget) : null,
        possessionDate: possessionDate ? new Date(possessionDate) : null,
        tags: tags || [],
        customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation ? (additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull,
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
      status,
      source,
      priority,
      assignedToId,
      customerId,
      possessionStatus,
      propertyCity,
      minBudget,
      maxBudget,
      fromDate,
      toDate,
      sortBy,
      sortOrder,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LeadWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(priority ? { priority } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(possessionStatus ? { possessionStatus } : {}),
      ...(propertyCity ? { propertyCity: { contains: propertyCity, mode: "insensitive" } } : {}),
      ...(minBudget !== undefined || maxBudget !== undefined
        ? {
            estimatedBudget: {
              ...(minBudget !== undefined ? { gte: minBudget } : {}),
              ...(maxBudget !== undefined ? { lte: maxBudget } : {}),
            },
          }
        : {}),
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: new Date(fromDate) } : {}),
              ...(toDate ? { lte: new Date(toDate) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { leadCode: { contains: search, mode: "insensitive" } },
              { title: { contains: search, mode: "insensitive" } },
              { propertyAddress: { contains: search, mode: "insensitive" } },
              { propertyCity: { contains: search, mode: "insensitive" } },
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
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { possessionDate, estimatedBudget, customFields, additionalInformation, ...directFields } = data;

    return db.lead.update({
      where: { id },
      data: {
        ...directFields,
        ...(possessionDate !== undefined ? { possessionDate: possessionDate ? new Date(possessionDate) : null } : {}),
        ...(estimatedBudget !== undefined ? { estimatedBudget: estimatedBudget !== null ? new Prisma.Decimal(estimatedBudget) : null } : {}),
        ...(customFields !== undefined ? { customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
        ...(additionalInformation !== undefined ? { additionalInformation: additionalInformation ? (additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
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
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    const [updatedLead, stageHistory] = await Promise.all([
      db.lead.update({
        where: { id },
        data: {
          status: toStage,
          ...(toStage === "WON" ? { convertedAt: new Date(), convertedById: changedById || null } : {}),
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
  async generateLeadCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
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
  async bulkAssign(leadIds: string[], organizationId: string, assignedToId: string | null, assignedById?: string | null) {
    return prisma.lead.updateMany({
      where: {
        id: { in: leadIds },
        organizationId,
        isDeleted: false,
      },
      data: {
        assignedToId,
        assignedAt: assignedToId ? new Date() : null,
        assignedById: assignedToId ? (assignedById || null) : null,
      },
    });
  }

  /**
   * Bulk update status
   */
  async bulkUpdateStatus(leadIds: string[], organizationId: string, status: any, changedById?: string | null) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.lead.updateMany({
        where: {
          id: { in: leadIds },
          organizationId,
          isDeleted: false,
        },
        data: {
          status,
          ...(status === "WON" ? { convertedAt: new Date(), convertedById: changedById || null } : {}),
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
    }
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

    const wonLeadsCount = statusGroups.find((g) => g.status === "WON")?._count.id || 0;
    const lostLeadsCount = statusGroups.find((g) => g.status === "LOST")?._count.id || 0;
    const conversionRate = totalLeads > 0 ? ((wonLeadsCount / totalLeads) * 100).toFixed(2) : "0.00";

    return {
      totalLeads,
      wonLeadsCount,
      lostLeadsCount,
      conversionRate: Number(conversionRate),
      totalPipelineValue: budgetAggregations._sum.estimatedBudget || 0,
      averageDealValue: budgetAggregations._avg.estimatedBudget || 0,
      averageQualificationScore: Math.round(budgetAggregations._avg.qualificationScore || 0),
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
}

export const leadRepo = new LeadRepository();

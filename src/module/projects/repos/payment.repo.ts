import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { z } from "zod";
import type {
  createPaymentSchema,
  updatePaymentSchema,
  getPaymentsQuerySchema,
  getPaymentSummaryQuerySchema,
} from "../validators/payment.validator.js";

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>["body"];
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>["body"];
export type GetPaymentsQuery = z.infer<typeof getPaymentsQuerySchema>["query"];
export type GetPaymentSummaryQuery = z.infer<typeof getPaymentSummaryQuerySchema>["query"];

/**
 * Repository layer for Project Payments with strict multi-tenant isolation (Rule 1 & Rule 3)
 */
export class PaymentRepository {
  /**
   * Standard include relations for payment records
   */
  private readonly defaultIncludes = {
    project: {
      select: {
        id: true,
        projectCode: true,
        name: true,
      },
    },
    milestone: {
      select: {
        id: true,
        milestoneCode: true,
        name: true,
        stage: true,
      },
    },
    customer: {
      select: {
        id: true,
        customerCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        companyName: true,
        phone: true,
        email: true,
      },
    },
    recordedBy: {
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
      },
    },
  };

  /**
   * Create a new project payment transaction
   */
  async create(organizationId: string, data: CreatePaymentInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { amount, paymentDate, receiptUrl, attachments, additionalInformation, ...directFields } = data;

    return db.projectPayment.create({
      data: {
        ...directFields,
        paymentNumber: directFields.paymentNumber || `PAY-${Date.now()}`,
        organizationId,
        amount: new Prisma.Decimal(amount),
        paymentDate: new Date(paymentDate),
        receiptUrl: receiptUrl ? (receiptUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation ? (additionalInformation as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Find paginated list of project payments with comprehensive filters
   */
  async findAll(organizationId: string, query: GetPaymentsQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      search,
      projectId,
      milestoneId,
      customerId,
      paymentType,
      flowDirection,
      status,
      paymentMethod,
      startDate,
      endDate,
      sortBy = "paymentDate",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectPaymentWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (milestoneId) {
      where.milestoneId = milestoneId;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (paymentType) {
      where.paymentType = paymentType;
    }

    if (flowDirection) {
      where.flowDirection = flowDirection;
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.paymentDate.lte = new Date(endDate);
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { paymentNumber: { contains: search, mode: "insensitive" } },
        { transactionReference: { contains: search, mode: "insensitive" } },
        { bankName: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { project: { name: { contains: search, mode: "insensitive" } } },
        {
          customer: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      db.projectPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: this.defaultIncludes,
      }),
      db.projectPayment.count({ where }),
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
   * Find single payment by ID scoped to tenant
   */
  async findById(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectPayment.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Find payment by paymentNumber within tenant
   */
  async findByPaymentNumber(organizationId: string, paymentNumber: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectPayment.findFirst({
      where: {
        organizationId,
        paymentNumber,
        isDeleted: false,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Update payment record (Rule 5: Partial / Dirty update)
   */
  async update(organizationId: string, id: string, data: UpdatePaymentInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { amount, paymentDate, receiptUrl, attachments, additionalInformation, ...directFields } = data;

    const updateData: Prisma.ProjectPaymentUpdateInput = {
      ...directFields,
    };

    if (amount !== undefined) {
      updateData.amount = new Prisma.Decimal(amount);
    }

    if (paymentDate !== undefined) {
      updateData.paymentDate = new Date(paymentDate);
    }

    if (receiptUrl !== undefined) {
      updateData.receiptUrl = receiptUrl ? (receiptUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    if (attachments !== undefined) {
      updateData.attachments = attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    if (additionalInformation !== undefined) {
      updateData.additionalInformation = additionalInformation
        ? (additionalInformation as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    return db.projectPayment.update({
      where: {
        id,
        organizationId,
      },
      data: updateData,
      include: this.defaultIncludes,
    });
  }

  /**
   * Soft delete payment transaction
   */
  async delete(organizationId: string, id: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectPayment.update({
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

  /**
   * Count payments created in the current year to generate sequential paymentNumber
   */
  async countInYear(organizationId: string, year: number, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${year}-12-31T23:59:59.999Z`);

    return db.projectPayment.count({
      where: {
        organizationId,
        createdAt: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });
  }

  /**
   * Calculate financial summary totals (Inflow, Outflow, Net, Status counts)
   */
  async getSummary(organizationId: string, query: GetPaymentSummaryQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { projectId, startDate, endDate } = query;

    const where: Prisma.ProjectPaymentWhereInput = {
      organizationId,
      isDeleted: false,
    };

    if (projectId) {
      where.projectId = projectId;
    }

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) {
        where.paymentDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.paymentDate.lte = new Date(endDate);
      }
    }

    const allPayments = await db.projectPayment.findMany({
      where,
      select: {
        amount: true,
        flowDirection: true,
        status: true,
        paymentType: true,
      },
    });

    let totalInflow = 0;
    let totalOutflow = 0;
    let pendingInflow = 0;
    let pendingOutflow = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    const breakdownByType: Record<string, number> = {};

    for (const p of allPayments) {
      const amt = Number(p.amount) || 0;
      const isCompleted = p.status === "COMPLETED";
      const isPending = p.status === "PENDING";

      if (p.flowDirection === "INFLOW") {
        if (isCompleted) totalInflow += amt;
        if (isPending) pendingInflow += amt;
      } else {
        if (isCompleted) totalOutflow += amt;
        if (isPending) pendingOutflow += amt;
      }

      if (isCompleted) completedCount++;
      else if (isPending) pendingCount++;
      else failedCount++;

      breakdownByType[p.paymentType] = (breakdownByType[p.paymentType] || 0) + amt;
    }

    const netReceived = totalInflow - totalOutflow;

    return {
      totalInflow,
      totalOutflow,
      netReceived,
      pendingInflow,
      pendingOutflow,
      totalTransactions: allPayments.length,
      completedCount,
      pendingCount,
      failedCount,
      breakdownByType,
    };
  }
}

export const paymentRepository = new PaymentRepository();

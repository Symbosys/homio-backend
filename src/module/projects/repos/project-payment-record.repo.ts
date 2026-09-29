import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { z } from "zod";
import type {
  createProjectPaymentRecordSchema,
  updateProjectPaymentRecordSchema,
  getProjectPaymentRecordsQuerySchema,
} from "../validators/project-billing.validator.js";

export type CreateProjectPaymentRecordInput = z.infer<typeof createProjectPaymentRecordSchema>["body"];
export type UpdateProjectPaymentRecordInput = z.infer<typeof updateProjectPaymentRecordSchema>["body"];
export type GetProjectPaymentRecordsQuery = z.infer<typeof getProjectPaymentRecordsQuerySchema>["query"];

/**
 * Repository layer for Project Payment Records with strict multi-tenant isolation (Rule 1 & Rule 3)
 */
export class ProjectPaymentRecordRepository {
  /**
   * Standard include relations for ProjectPaymentRecord
   */
  private readonly defaultIncludes = {
    project: {
      select: {
        id: true,
        projectCode: true,
        name: true,
        status: true,
        currentStage: true,
      },
    },
    bill: {
      select: {
        id: true,
        billNumber: true,
        title: true,
        billType: true,
        stage: true,
        grandTotal: true,
        paidAmount: true,
        dueAmount: true,
        status: true,
        vendor: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
          },
        },
        labour: {
          select: {
            id: true,
            name: true,
            trade: true,
          },
        },
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
   * Create a new Project Payment Record
   */
  async create(
    organizationId: string,
    data: CreateProjectPaymentRecordInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      amount,
      paymentDate,
      receiptUrl,
      attachments,
      additionalInformation,
      ...directFields
    } = data;

    return db.projectPaymentRecord.create({
      data: {
        ...directFields,
        organizationId,
        paymentNumber: directFields.paymentNumber || `PAY-${Date.now()}`,
        amount: new Prisma.Decimal(amount),
        paymentDate: new Date(paymentDate),
        receiptUrl: receiptUrl ? (receiptUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation
          ? (additionalInformation as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Find paginated list of Project Payment Records with filters
   */
  async findAll(
    organizationId: string,
    query: GetProjectPaymentRecordsQuery,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      search,
      projectId,
      billId,
      billType,
      stage,
      status,
      paymentMethod,
      startDate,
      endDate,
      sortBy = "paymentDate",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectPaymentRecordWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(billId && { billId }),
      ...(billType && { billType }),
      ...(stage && { stage }),
      ...(status && { status }),
      ...(paymentMethod && { paymentMethod }),
      ...(startDate &&
        endDate && {
          paymentDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(search && {
        OR: [
          { paymentNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { transactionReference: { contains: search, mode: "insensitive" } },
          { bankName: { contains: search, mode: "insensitive" } },
          { bill: { billNumber: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [payments, total] = await Promise.all([
      db.projectPaymentRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: this.defaultIncludes,
      }),
      db.projectPaymentRecord.count({ where }),
    ]);

    return {
      data: payments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single Project Payment Record by ID and tenant
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectPaymentRecord.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Sum all successful payments allocated to a bill
   */
  async sumPaymentsByBillId(billId: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const aggregate = await db.projectPaymentRecord.aggregate({
      where: {
        billId,
        organizationId,
        isDeleted: false,
        status: "SUCCESS",
      },
      _sum: {
        amount: true,
      },
    });

    return aggregate._sum.amount ? Number(aggregate._sum.amount) : 0;
  }

  /**
   * Update a Project Payment Record
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateProjectPaymentRecordInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      amount,
      paymentDate,
      receiptUrl,
      attachments,
      additionalInformation,
      ...directFields
    } = data;

    const updatePayload: Prisma.ProjectPaymentRecordUpdateInput = {
      ...directFields,
      ...(amount !== undefined && { amount: new Prisma.Decimal(amount) }),
      ...(paymentDate !== undefined && { paymentDate: new Date(paymentDate) }),
      ...(receiptUrl !== undefined && {
        receiptUrl: receiptUrl
          ? (receiptUrl as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      }),
      ...(attachments !== undefined && {
        attachments: attachments
          ? (attachments as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      }),
      ...(additionalInformation !== undefined && {
        additionalInformation: additionalInformation
          ? (additionalInformation as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      }),
    };

    return db.projectPaymentRecord.update({
      where: { id, organizationId },
      data: updatePayload,
      include: this.defaultIncludes,
    });
  }

  /**
   * Soft delete Project Payment Record
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectPaymentRecord.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const projectPaymentRecordRepo = new ProjectPaymentRecordRepository();

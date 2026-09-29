import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { z } from "zod";
import type {
  createProjectBillSchema,
  updateProjectBillSchema,
  getProjectBillsQuerySchema,
} from "../validators/project-billing.validator.js";

export type CreateProjectBillInput = z.infer<typeof createProjectBillSchema>["body"];
export type UpdateProjectBillInput = z.infer<typeof updateProjectBillSchema>["body"];
export type GetProjectBillsQuery = z.infer<typeof getProjectBillsQuerySchema>["query"];

/**
 * Repository layer for Project Bills with strict multi-tenant isolation (Rule 1 & Rule 3)
 */
export class ProjectBillRepository {
  /**
   * Standard include relations for ProjectBill
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
    vendor: {
      select: {
        id: true,
        name: true,
        code: true,
        companyName: true,
        category: true,
        phone: true,
        email: true,
      },
    },
    labour: {
      select: {
        id: true,
        name: true,
        trade: true,
        phone: true,
        skillLevel: true,
      },
    },
    createdBy: {
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
      },
    },
    approvedBy: {
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarUrl: true,
      },
    },
    paymentRecords: {
      where: { isDeleted: false },
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        paymentDate: true,
        paymentMethod: true,
        status: true,
        transactionReference: true,
      },
      orderBy: { paymentDate: "desc" as const },
    },
  };

  /**
   * Create a new Project Bill
   */
  async create(organizationId: string, data: CreateProjectBillInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      totalAmount,
      taxPercent,
      taxAmount,
      grandTotal,
      commissionRate,
      commissionAmount,
      commissionPaidDate,
      billDate,
      dueDate,
      billDocumentUrl,
      attachments,
      additionalInformation,
      ...directFields
    } = data;

    const computedGrandTotal = grandTotal > 0 ? grandTotal : totalAmount + taxAmount;

    return db.projectBill.create({
      data: {
        ...directFields,
        organizationId,
        billNumber: directFields.billNumber || `BIL-${Date.now()}`,
        totalAmount: new Prisma.Decimal(totalAmount),
        taxPercent: new Prisma.Decimal(taxPercent),
        taxAmount: new Prisma.Decimal(taxAmount),
        grandTotal: new Prisma.Decimal(computedGrandTotal),
        paidAmount: new Prisma.Decimal(0),
        dueAmount: new Prisma.Decimal(computedGrandTotal),
        commissionRate: new Prisma.Decimal(commissionRate),
        commissionAmount: new Prisma.Decimal(commissionAmount),
        commissionPaidDate: commissionPaidDate ? new Date(commissionPaidDate) : null,
        billDate: new Date(billDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        billDocumentUrl: billDocumentUrl ? (billDocumentUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation
          ? (additionalInformation as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Find paginated list of Project Bills with rich filters
   */
  async findAll(organizationId: string, query: GetProjectBillsQuery, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      search,
      projectId,
      billType,
      stage,
      status,
      vendorId,
      labourId,
      materialCategory,
      commissionStatus,
      startDate,
      endDate,
      sortBy = "billDate",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectBillWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(billType && { billType }),
      ...(stage && { stage }),
      ...(status && { status }),
      ...(vendorId && { vendorId }),
      ...(labourId && { labourId }),
      ...(materialCategory && {
        materialCategory: { contains: materialCategory, mode: "insensitive" },
      }),
      ...(commissionStatus && { commissionStatus }),
      ...(startDate &&
        endDate && {
          billDate: {
            gte: new Date(startDate),
            lte: new Date(endDate),
          },
        }),
      ...(search && {
        OR: [
          { billNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { notes: { contains: search, mode: "insensitive" } },
          { materialCategory: { contains: search, mode: "insensitive" } },
          { labourTrade: { contains: search, mode: "insensitive" } },
          { vendor: { name: { contains: search, mode: "insensitive" } } },
          { labour: { name: { contains: search, mode: "insensitive" } } },
        ],
      }),
    };

    const [bills, total] = await Promise.all([
      db.projectBill.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: this.defaultIncludes,
      }),
      db.projectBill.count({ where }),
    ]);

    return {
      data: bills,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find single Project Bill by ID and tenant
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectBill.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Update a Project Bill (Rule 5: Partial / Dirty update)
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateProjectBillInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const {
      totalAmount,
      taxPercent,
      taxAmount,
      grandTotal,
      commissionRate,
      commissionAmount,
      commissionPaidDate,
      billDate,
      dueDate,
      billDocumentUrl,
      attachments,
      additionalInformation,
      ...directFields
    } = data;

    const updatePayload: Prisma.ProjectBillUpdateInput = {
      ...directFields,
      ...(totalAmount !== undefined && { totalAmount: new Prisma.Decimal(totalAmount) }),
      ...(taxPercent !== undefined && { taxPercent: new Prisma.Decimal(taxPercent) }),
      ...(taxAmount !== undefined && { taxAmount: new Prisma.Decimal(taxAmount) }),
      ...(grandTotal !== undefined && { grandTotal: new Prisma.Decimal(grandTotal) }),
      ...(commissionRate !== undefined && { commissionRate: new Prisma.Decimal(commissionRate) }),
      ...(commissionAmount !== undefined && { commissionAmount: new Prisma.Decimal(commissionAmount) }),
      ...(commissionPaidDate !== undefined && {
        commissionPaidDate: commissionPaidDate ? new Date(commissionPaidDate) : null,
      }),
      ...(billDate !== undefined && { billDate: new Date(billDate) }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
      ...(billDocumentUrl !== undefined && {
        billDocumentUrl: billDocumentUrl
          ? (billDocumentUrl as unknown as Prisma.InputJsonValue)
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

    return db.projectBill.update({
      where: { id, organizationId },
      data: updatePayload,
      include: this.defaultIncludes,
    });
  }

  /**
   * Rebalance paid and due amounts on bill
   */
  async rebalanceBill(
    id: string,
    organizationId: string,
    paidAmount: number,
    dueAmount: number,
    status: Prisma.ProjectBillUncheckedUpdateInput["status"],
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    return db.projectBill.update({
      where: { id, organizationId },
      data: {
        paidAmount: new Prisma.Decimal(paidAmount),
        dueAmount: new Prisma.Decimal(dueAmount),
        status,
      },
      include: this.defaultIncludes,
    });
  }

  /**
   * Soft delete Project Bill
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectBill.update({
      where: { id, organizationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const projectBillRepo = new ProjectBillRepository();

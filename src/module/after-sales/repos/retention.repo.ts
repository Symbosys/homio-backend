import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateRetentionFollowUpInput,
  UpdateRetentionFollowUpInput,
  LogRetentionCallInput,
  GetRetentionFollowUpsQueryInput,
} from "../validators/retention.validator.js";

export class RetentionRepository {
  /**
   * Auto-generates sequential retention code (RET-YYYY-NNNN)
   */
  async generateNextCallNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `RET-${year}-`;

    const latest = await prisma.retentionFollowUp.findFirst({
      where: {
        project: { organizationId },
        callNumber: { startsWith: prefix },
      },
      orderBy: { callNumber: "desc" },
      select: { callNumber: true },
    });

    let nextSeq = 1;
    if (latest?.callNumber) {
      const parts = latest.callNumber.split("-");
      if (parts[2]) {
        const currentSeq = parseInt(parts[2], 10);
        if (!isNaN(currentSeq)) {
          nextSeq = currentSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * Create proactive retention follow-up
   */
  async create(organizationId: string, data: CreateRetentionFollowUpInput) {
    const callNumber = await this.generateNextCallNumber(organizationId);

    return prisma.retentionFollowUp.create({
      data: {
        projectId: data.projectId,
        callNumber,
        followUpType: data.followUpType || "COURTESY_CALL_30_DAYS",
        channel: data.channel || "PHONE_CALL",
        scheduledDate: new Date(data.scheduledDate),
        assignedEmployeeId: data.assignedEmployeeId,
        objective: data.objective,
        notes: data.notes,
        additionalInformation:
          data.additionalInformation !== undefined
            ? (data.additionalInformation as Prisma.InputJsonValue)
            : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        assignedEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });
  }

  /**
   * Find retention follow-up by ID with tenant verification
   */
  async findById(organizationId: string, id: string) {
    return prisma.retentionFollowUp.findFirst({
      where: {
        id,
        project: { organizationId },
        isDeleted: false,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        assignedEmployee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            workPhone: true,
            workEmail: true,
          },
        },
      },
    });
  }

  /**
   * List paginated retention follow-ups
   */
  async list(organizationId: string, query: GetRetentionFollowUpsQueryInput) {
    const {
      projectId,
      assignedEmployeeId,
      followUpType,
      channel,
      outcome,
      scheduledDate,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.RetentionFollowUpWhereInput = {
      project: { organizationId },
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(assignedEmployeeId && { assignedEmployeeId }),
      ...(followUpType && { followUpType }),
      ...(channel && { channel }),
      ...(outcome && { outcome }),
      ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
      ...(startDate && { scheduledDate: { gte: new Date(startDate) } }),
      ...(endDate && { scheduledDate: { lte: new Date(endDate) } }),
    };

    const [items, total] = await Promise.all([
      prisma.retentionFollowUp.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: { id: true, name: true, projectCode: true },
          },
          assignedEmployee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
        },
      }),
      prisma.retentionFollowUp.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Partial update retention details
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateRetentionFollowUpInput,
  ) {
    return prisma.retentionFollowUp.update({
      where: { id },
      data: {
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.followUpType !== undefined && {
          followUpType: data.followUpType,
        }),
        ...(data.channel !== undefined && { channel: data.channel }),
        ...(data.scheduledDate !== undefined && {
          scheduledDate: new Date(data.scheduledDate),
        }),
        ...(data.assignedEmployeeId !== undefined && {
          assignedEmployeeId: data.assignedEmployeeId,
        }),
        ...(data.objective !== undefined && { objective: data.objective }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation:
            data.additionalInformation as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Log completed call outcome, CSAT, review, and referral lead
   */
  async logCall(
    organizationId: string,
    id: string,
    data: LogRetentionCallInput,
  ) {
    return prisma.retentionFollowUp.update({
      where: { id },
      data: {
        conductedAt: data.conductedAt ? new Date(data.conductedAt) : new Date(),
        notes: data.notes,
        outcome: data.outcome,
        nextFollowUpDate: data.nextFollowUpDate
          ? new Date(data.nextFollowUpDate)
          : null,
        csatScore:
          data.csatScore !== undefined && data.csatScore !== null
            ? new Prisma.Decimal(data.csatScore)
            : null,
        reviewLinkSent: data.reviewLinkSent ?? false,
        reviewPosted: data.reviewPosted ?? false,
        referralLeadName: data.referralLeadName,
        referralLeadPhone: data.referralLeadPhone,
        referralLeadEmail: data.referralLeadEmail,
      },
    });
  }

  /**
   * Soft delete retention follow-up
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.retentionFollowUp.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const retentionRepository = new RetentionRepository();

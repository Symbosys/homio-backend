import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateApprovalInput,
  UpdateApprovalInput,
  ReviewApprovalInput,
  GetApprovalsQueryInput,
  CreateChangeRequestInput,
  RespondChangeRequestInput,
} from "../validators/approval.validator.js";

export class ApprovalRepository {
  /**
   * Create a new WorkApproval entry
   */
  async create(projectId: string, data: CreateApprovalInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { dueDate, attachments, ...directFields } = data;

    return db.workApproval.create({
      data: {
        ...directFields,
        projectId,
        dueDate: dueDate ? new Date(dueDate) : null,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Find paginated list of work approvals for a project
   */
  async findAll(projectId: string, query: GetApprovalsQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      status,
      type,
      priority,
      milestoneId,
      submittedById,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.WorkApprovalWhereInput = {
      projectId,
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
      ...(milestoneId ? { milestoneId } : {}),
      ...(submittedById ? { submittedById } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      db.workApproval.count({ where }),
      db.workApproval.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          submittedBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              avatarUrl: true,
              designation: true,
            },
          },
          milestone: {
            select: {
              id: true,
              milestoneCode: true,
              name: true,
              stage: true,
              status: true,
            },
          },
          _count: {
            select: {
              changeRequests: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Find single WorkApproval by ID with all nested change requests
   */
  async findById(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.workApproval.findFirst({
      where: {
        id,
        projectId,
        isDeleted: false,
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
            workEmail: true,
            workPhone: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
            status: true,
          },
        },
        changeRequests: {
          orderBy: { roundNumber: "desc" },
          include: {
            requestedByCustomer: {
              select: {
                id: true,
                customerCode: true,
                displayName: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
            respondedBy: {
              select: {
                id: true,
                employeeCode: true,
                displayName: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                designation: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Partial update on a WorkApproval
   */
  async update(id: string, projectId: string, data: UpdateApprovalInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { dueDate, attachments, ...directFields } = data;

    const updateData: Prisma.WorkApprovalUpdateInput = {
      ...directFields,
      updatedAt: new Date(),
    };

    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (attachments !== undefined) {
      updateData.attachments = attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    return db.workApproval.update({
      where: { id, projectId },
      data: updateData,
      include: {
        submittedBy: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
            stage: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Client review action (Approve / Reject)
   */
  async review(id: string, projectId: string, data: ReviewApprovalInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const isApproved = data.action === "APPROVE";

    return db.workApproval.update({
      where: { id, projectId },
      data: {
        status: isApproved ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        clientFeedback: data.clientFeedback || null,
        rejectionReason: isApproved ? null : data.rejectionReason || null,
        updatedAt: new Date(),
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
          },
        },
        milestone: {
          select: {
            id: true,
            milestoneCode: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete WorkApproval
   */
  async softDelete(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.workApproval.update({
      where: { id, projectId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  // ==========================================
  // CHANGE REQUEST OPERATIONS
  // ==========================================

  /**
   * Create a new change request round for a WorkApproval
   */
  async createChangeRequest(
    workApprovalId: string,
    data: CreateChangeRequestInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { attachments, ...directFields } = data;

    // Find the current highest round number
    const lastCr = await db.workApprovalChangeRequest.findFirst({
      where: { workApprovalId },
      orderBy: { roundNumber: "desc" },
      select: { roundNumber: true },
    });

    const nextRoundNumber = (lastCr?.roundNumber ?? 0) + 1;

    // Create change request and update approval status & revisionCount in a transaction
    return db.$transaction(async (trx) => {
      const cr = await trx.workApprovalChangeRequest.create({
        data: {
          ...directFields,
          workApprovalId,
          roundNumber: nextRoundNumber,
          status: "PENDING",
          attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
        include: {
          requestedByCustomer: {
            select: {
              id: true,
              customerCode: true,
              displayName: true,
              phone: true,
              email: true,
            },
          },
        },
      });

      // Update parent WorkApproval status to REVISION_REQUESTED and increment revisionCount
      await trx.workApproval.update({
        where: { id: workApprovalId },
        data: {
          status: "REVISION_REQUESTED",
          revisionNotes: data.requestedChanges,
          revisionCount: nextRoundNumber,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return cr;
    });
  }

  /**
   * List all change requests for a work approval
   */
  async findChangeRequests(workApprovalId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.workApprovalChangeRequest.findMany({
      where: { workApprovalId },
      orderBy: { roundNumber: "desc" },
      include: {
        requestedByCustomer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            phone: true,
            email: true,
          },
        },
        respondedBy: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            avatarUrl: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Find single change request by ID
   */
  async findChangeRequestById(id: string, workApprovalId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.workApprovalChangeRequest.findFirst({
      where: { id, workApprovalId },
      include: {
        requestedByCustomer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
          },
        },
        respondedBy: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            designation: true,
          },
        },
      },
    });
  }

  /**
   * Respond to a change request (Accept / Reject / Implement)
   */
  async respondChangeRequest(
    id: string,
    workApprovalId: string,
    data: RespondChangeRequestInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { revisedAttachments, ...directFields } = data;

    return db.$transaction(async (trx) => {
      const cr = await trx.workApprovalChangeRequest.update({
        where: { id, workApprovalId },
        data: {
          ...directFields,
          respondedAt: new Date(),
          revisedAttachments: revisedAttachments
            ? (revisedAttachments as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          updatedAt: new Date(),
        },
        include: {
          respondedBy: {
            select: {
              id: true,
              employeeCode: true,
              displayName: true,
              designation: true,
            },
          },
        },
      });

      // If implemented, update parent approval to RESUBMITTED
      if (data.status === "IMPLEMENTED") {
        await trx.workApproval.update({
          where: { id: workApprovalId },
          data: {
            status: "RESUBMITTED",
            updatedAt: new Date(),
          },
        });
      }

      return cr;
    });
  }
}

export const approvalRepo = new ApprovalRepository();

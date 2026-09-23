import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateComplaintInput,
  UpdateComplaintInput,
  UpdateComplaintStatusInput,
  AddComplaintCommentInput,
  GetComplaintsQueryInput,
} from "../validators/complaint.validator.js";

export class ComplaintRepository {
  /**
   * File a new project complaint / ticket
   */
  async create(projectId: string, data: CreateComplaintInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { targetResolutionDate, attachments, additionalInformation, ...directFields } = data;

    return db.projectComplaint.create({
      data: {
        ...directFields,
        projectId,
        targetResolutionDate: targetResolutionDate ? new Date(targetResolutionDate) : null,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation ? (additionalInformation as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        categoryRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            color: true,
            icon: true,
          },
        },
        reportedByCustomer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        reportedByEmployee: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedTo: {
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
   * Find paginated list of complaints for a project
   */
  async findAll(projectId: string, query: GetComplaintsQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      status,
      type,
      severity,
      priority,
      milestoneId,
      assignedToId,
      reportedByCustomerId,
      reportedByEmployeeId,
      search,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectComplaintWhereInput = {
      projectId,
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(severity ? { severity } : {}),
      ...(priority ? { priority } : {}),
      ...(milestoneId ? { milestoneId } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      ...(reportedByCustomerId ? { reportedByCustomerId } : {}),
      ...(reportedByEmployeeId ? { reportedByEmployeeId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
              { areaRoom: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, data] = await Promise.all([
      db.projectComplaint.count({ where }),
      db.projectComplaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          reportedByCustomer: {
            select: {
              id: true,
              customerCode: true,
              displayName: true,
              firstName: true,
              lastName: true,
            },
          },
          assignedTo: {
            select: {
              id: true,
              employeeCode: true,
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
            },
          },
          categoryRef: {
            select: {
              id: true,
              name: true,
              slug: true,
              code: true,
              color: true,
              icon: true,
            },
          },
          _count: {
            select: {
              comments: true,
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
   * Find single complaint with comments and full attribution
   */
  async findById(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectComplaint.findFirst({
      where: {
        id,
        projectId,
        isDeleted: false,
      },
      include: {
        reportedByCustomer: {
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
        reportedByEmployee: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            designation: true,
            workPhone: true,
            workEmail: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            designation: true,
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
        comments: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
            employee: {
              select: {
                id: true,
                employeeCode: true,
                displayName: true,
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
   * Partial update on a Complaint
   */
  async update(id: string, projectId: string, data: UpdateComplaintInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { targetResolutionDate, attachments, additionalInformation, ...directFields } = data;

    const updateData: Prisma.ProjectComplaintUpdateInput = {
      ...directFields,
      updatedAt: new Date(),
    };

    if (targetResolutionDate !== undefined) {
      updateData.targetResolutionDate = targetResolutionDate ? new Date(targetResolutionDate) : null;
    }
    if (attachments !== undefined) {
      updateData.attachments = attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }
    if (additionalInformation !== undefined) {
      updateData.additionalInformation = additionalInformation ? (additionalInformation as unknown as Prisma.InputJsonValue) : Prisma.JsonNull;
    }

    return db.projectComplaint.update({
      where: { id, projectId },
      data: updateData,
      include: {
        categoryRef: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            color: true,
            icon: true,
          },
        },
        assignedTo: {
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
   * Update complaint status and lifecycle timestamps
   */
  async updateStatus(
    id: string,
    projectId: string,
    data: UpdateComplaintStatusInput,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;
    const { status, assignedToId, resolvedById, resolutionNotes, rejectionReason } = data;

    const updateData: Prisma.ProjectComplaintUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    if (assignedToId !== undefined) updateData.assignedTo = assignedToId ? { connect: { id: assignedToId } } : { disconnect: true };
    if (resolvedById !== undefined) updateData.resolvedBy = resolvedById ? { connect: { id: resolvedById } } : { disconnect: true };
    if (resolutionNotes !== undefined) updateData.resolutionNotes = resolutionNotes || null;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason || null;

    if (status === "RESOLVED") {
      updateData.resolvedAt = new Date();
    } else if (status === "CLOSED") {
      updateData.closedAt = new Date();
    } else if (status === "REOPENED") {
      updateData.resolvedAt = null;
      updateData.closedAt = null;
    }

    return db.projectComplaint.update({
      where: { id, projectId },
      data: updateData,
      include: {
        assignedTo: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
            designation: true,
          },
        },
        resolvedBy: {
          select: {
            id: true,
            employeeCode: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Soft delete complaint
   */
  async softDelete(id: string, projectId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.projectComplaint.update({
      where: { id, projectId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  // ==========================================
  // COMPLAINT COMMENTS OPERATIONS
  // ==========================================

  /**
   * Add a comment to a complaint
   */
  async addComment(complaintId: string, data: AddComplaintCommentInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const { attachments, authorType = "EMPLOYEE", ...directFields } = data;

    return db.complaintComment.create({
      data: {
        ...directFields,
        authorType,
        complaintId,
        attachments: attachments ? (attachments as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        employee: {
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
   * List all comments for a complaint
   */
  async findComments(complaintId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.complaintComment.findMany({
      where: { complaintId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        employee: {
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
}

export const complaintRepo = new ComplaintRepository();

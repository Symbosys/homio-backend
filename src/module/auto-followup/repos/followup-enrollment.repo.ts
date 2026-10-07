import { prisma } from "../../../lib/prisma.js";
import {
  Prisma,
  FollowUpEnrollmentStatus,
} from "../../../types/types.js";

/**
 * Follow-Up Enrollment Repository
 * Manages active, completed, and stopped follow-up lifecycle records for Leads and Meetings.
 */
export class FollowUpEnrollmentRepository {
  /**
   * Create an enrollment record with calculated initial step state.
   *
   * @param organizationId - Tenant organization UUID
   * @param data - Enrollment creation parameters
   * @param tx - Optional transaction client
   * @returns Newly created FollowUpEnrollment
   */
  async createEnrollment(
    organizationId: string,
    data: {
      configId: string;
      leadId?: string;
      meetingId?: string;
      status?: FollowUpEnrollmentStatus;
      currentStepIndex?: number;
      totalSteps: number;
      nextExecutionAt?: Date | null;
      metadata?: Record<string, any>;
      additionalInformation?: Record<string, any>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpEnrollment.create({
      data: {
        organizationId,
        configId: data.configId,
        leadId: data.leadId,
        meetingId: data.meetingId,
        status: data.status ?? FollowUpEnrollmentStatus.ACTIVE,
        currentStepIndex: data.currentStepIndex ?? 0,
        totalSteps: data.totalSteps,
        nextExecutionAt: data.nextExecutionAt,
        metadata: data.metadata as Prisma.InputJsonValue,
        additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
      },
      include: {
        config: {
          include: {
            leadSteps: { orderBy: { stepOrder: "asc" } },
            meetingSteps: { orderBy: { stepOrder: "asc" } },
          },
        },
        lead: {
          include: { customer: true },
        },
        meeting: {
          include: { lead: { include: { customer: true } }, customer: true },
        },
      },
    });
  }

  /**
   * Get an enrollment by ID scoped to organization.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Enrollment UUID
   */
  async getEnrollmentById(organizationId: string, id: string) {
    return prisma.followUpEnrollment.findFirst({
      where: { id, organizationId },
      include: {
        config: {
          include: {
            leadSteps: {
              orderBy: { stepOrder: "asc" },
              include: { template: true },
            },
            meetingSteps: {
              orderBy: { stepOrder: "asc" },
              include: { template: true },
            },
          },
        },
        lead: {
          include: { customer: true },
        },
        meeting: {
          include: { lead: { include: { customer: true } }, customer: true },
        },
        executionLogs: {
          orderBy: { scheduledFor: "asc" },
          include: { template: true, chatMessage: true },
        },
      },
    });
  }

  /**
   * Find active lead enrollment for a specific lead.
   *
   * @param organizationId - Tenant organization UUID
   * @param leadId - Lead UUID
   */
  async getActiveEnrollmentForLead(organizationId: string, leadId: string) {
    return prisma.followUpEnrollment.findFirst({
      where: {
        organizationId,
        leadId,
        status: FollowUpEnrollmentStatus.ACTIVE,
      },
      include: {
        config: {
          include: {
            leadSteps: {
              where: { isActive: true },
              orderBy: { stepOrder: "asc" },
              include: { template: { include: { variables: true } } },
            },
          },
        },
        lead: {
          include: { customer: true },
        },
      },
    });
  }

  /**
   * Find active meeting enrollment for a specific meeting.
   *
   * @param organizationId - Tenant organization UUID
   * @param meetingId - Meeting UUID
   */
  async getActiveEnrollmentForMeeting(organizationId: string, meetingId: string) {
    return prisma.followUpEnrollment.findFirst({
      where: {
        organizationId,
        meetingId,
        status: FollowUpEnrollmentStatus.ACTIVE,
      },
      include: {
        config: {
          include: {
            meetingSteps: {
              where: { isActive: true },
              orderBy: { stepOrder: "asc" },
              include: { template: { include: { variables: true } } },
            },
          },
        },
        meeting: {
          include: { lead: { include: { customer: true } }, customer: true },
        },
      },
    });
  }

  /**
   * Update enrollment state and timestamps.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Enrollment UUID
   * @param data - Update payload
   * @param tx - Optional transaction client
   */
  async updateEnrollment(
    organizationId: string,
    id: string,
    data: {
      status?: FollowUpEnrollmentStatus;
      currentStepIndex?: number;
      nextExecutionAt?: Date | null;
      lastExecutedAt?: Date | null;
      stopReason?: string | null;
      stoppedAt?: Date | null;
      metadata?: Record<string, any>;
      additionalInformation?: Record<string, any>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpEnrollment.update({
      where: { id },
      data: {
        status: data.status,
        currentStepIndex: data.currentStepIndex,
        nextExecutionAt: data.nextExecutionAt,
        lastExecutedAt: data.lastExecutedAt,
        stopReason: data.stopReason,
        stoppedAt: data.stoppedAt,
        metadata: data.metadata !== undefined ? (data.metadata as Prisma.InputJsonValue) : undefined,
        additionalInformation:
          data.additionalInformation !== undefined
            ? (data.additionalInformation as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  /**
   * Stop all active enrollments for a specific lead (e.g. when meeting is booked).
   *
   * @param organizationId - Tenant organization UUID
   * @param leadId - Lead UUID
   * @param reason - Reason description
   * @param status - Enrollment stop status
   * @param tx - Optional transaction client
   */
  async stopActiveEnrollmentsForLead(
    organizationId: string,
    leadId: string,
    reason: string = "Meeting scheduled",
    status: FollowUpEnrollmentStatus = FollowUpEnrollmentStatus.STOPPED_MEETING_BOOKED,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpEnrollment.updateMany({
      where: {
        organizationId,
        leadId,
        status: FollowUpEnrollmentStatus.ACTIVE,
      },
      data: {
        status,
        stopReason: reason,
        stoppedAt: new Date(),
        nextExecutionAt: null,
      },
    });
  }

  /**
   * Stop active enrollments for a specific meeting (e.g. when cancelled).
   *
   * @param organizationId - Tenant organization UUID
   * @param meetingId - Meeting UUID
   * @param reason - Reason description
   * @param status - Enrollment stop status
   * @param tx - Optional transaction client
   */
  async stopActiveEnrollmentsForMeeting(
    organizationId: string,
    meetingId: string,
    reason: string = "Meeting cancelled",
    status: FollowUpEnrollmentStatus = FollowUpEnrollmentStatus.STOPPED_CANCELLED,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpEnrollment.updateMany({
      where: {
        organizationId,
        meetingId,
        status: FollowUpEnrollmentStatus.ACTIVE,
      },
      data: {
        status,
        stopReason: reason,
        stoppedAt: new Date(),
        nextExecutionAt: null,
      },
    });
  }

  /**
   * Query all enrollments where next execution is due.
   *
   * @param cutoff - Target timestamp (usually new Date())
   * @param limit - Batch size
   */
  async getDueEnrollments(cutoff: Date = new Date(), limit: number = 50) {
    return prisma.followUpEnrollment.findMany({
      where: {
        status: FollowUpEnrollmentStatus.ACTIVE,
        nextExecutionAt: {
          lte: cutoff,
          not: null,
        },
      },
      take: limit,
      include: {
        config: {
          include: {
            leadSteps: {
              where: { isActive: true },
              orderBy: { stepOrder: "asc" },
              include: { template: { include: { variables: true } } },
            },
            meetingSteps: {
              where: { isActive: true },
              orderBy: { stepOrder: "asc" },
              include: { template: { include: { variables: true } } },
            },
          },
        },
        lead: {
          include: { customer: true },
        },
        meeting: {
          include: { lead: { include: { customer: true } }, customer: true },
        },
      },
    });
  }

  /**
   * List paginated enrollments for a tenant.
   *
   * @param organizationId - Tenant organization UUID
   * @param params - Filtering and pagination parameters
   */
  async listEnrollments(
    organizationId: string,
    params: {
      leadId?: string;
      meetingId?: string;
      status?: FollowUpEnrollmentStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.FollowUpEnrollmentWhereInput = {
      organizationId,
      ...(params.leadId ? { leadId: params.leadId } : {}),
      ...(params.meetingId ? { meetingId: params.meetingId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.followUpEnrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          config: {
            select: { id: true, name: true, type: true },
          },
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
              customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
          meeting: {
            select: {
              id: true,
              meetingCode: true,
              title: true,
              meetingDate: true,
              startTime: true,
              status: true,
            },
          },
        },
      }),
      prisma.followUpEnrollment.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const followUpEnrollmentRepo = new FollowUpEnrollmentRepository();

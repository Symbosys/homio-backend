import { prisma } from "../../../lib/prisma.js";
import {
  Prisma,
  FollowUpExecutionStatus,
} from "../../../types/types.js";

/**
 * Follow-Up Execution Repository
 * Manages audit records for individual template message dispatches across follow-up steps.
 */
export class FollowUpExecutionRepository {
  /**
   * Create an execution log entry.
   *
   * @param organizationId - Tenant organization UUID
   * @param data - Log creation parameters
   * @param tx - Optional transaction client
   */
  async createExecutionLog(
    organizationId: string,
    data: {
      enrollmentId: string;
      leadStepId?: string | null;
      meetingStepId?: string | null;
      leadId?: string | null;
      meetingId?: string | null;
      templateId?: string | null;
      chatMessageId?: string | null;
      status?: FollowUpExecutionStatus;
      scheduledFor: Date;
      renderedVariables?: Record<string, any>;
      errorMessage?: string | null;
      additionalInformation?: Record<string, any>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpExecutionLog.create({
      data: {
        organizationId,
        enrollmentId: data.enrollmentId,
        leadStepId: data.leadStepId,
        meetingStepId: data.meetingStepId,
        leadId: data.leadId,
        meetingId: data.meetingId,
        templateId: data.templateId,
        chatMessageId: data.chatMessageId,
        status: data.status ?? FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: data.scheduledFor,
        renderedVariables: data.renderedVariables as Prisma.InputJsonValue,
        errorMessage: data.errorMessage,
        additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Update an existing execution log.
   *
   * @param id - Log UUID
   * @param data - Update payload
   * @param tx - Optional transaction client
   */
  async updateExecutionLog(
    id: string,
    data: {
      status?: FollowUpExecutionStatus;
      executedAt?: Date | null;
      chatMessageId?: string | null;
      renderedVariables?: Record<string, any>;
      errorMessage?: string | null;
      retryCount?: number;
      additionalInformation?: Record<string, any>;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpExecutionLog.update({
      where: { id },
      data: {
        status: data.status,
        executedAt: data.executedAt,
        chatMessageId: data.chatMessageId,
        renderedVariables:
          data.renderedVariables !== undefined
            ? (data.renderedVariables as Prisma.InputJsonValue)
            : undefined,
        errorMessage: data.errorMessage,
        retryCount: data.retryCount,
        additionalInformation:
          data.additionalInformation !== undefined
            ? (data.additionalInformation as Prisma.InputJsonValue)
            : undefined,
      },
    });
  }

  /**
   * Cancel pending/scheduled execution logs for a stopped or rescheduled enrollment.
   *
   * @param enrollmentId - Enrollment UUID
   * @param reason - Cancellation reason
   * @param tx - Optional transaction client
   */
  async cancelPendingLogsForEnrollment(
    enrollmentId: string,
    reason: string = "Follow-up cancelled or rescheduled",
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    return db.followUpExecutionLog.updateMany({
      where: {
        enrollmentId,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
      data: {
        status: FollowUpExecutionStatus.CANCELLED,
        errorMessage: reason,
      },
    });
  }

  /**
   * Get all execution logs for an enrollment ordered chronologically.
   *
   * @param enrollmentId - Enrollment UUID
   */
  async getLogsForEnrollment(enrollmentId: string) {
    return prisma.followUpExecutionLog.findMany({
      where: { enrollmentId },
      orderBy: { scheduledFor: "asc" },
      include: {
        template: {
          select: { id: true, name: true, language: true },
        },
        chatMessage: {
          select: { id: true, content: true, status: true, deliveredAt: true, readAt: true },
        },
      },
    });
  }
}

export const followUpExecutionRepo = new FollowUpExecutionRepository();

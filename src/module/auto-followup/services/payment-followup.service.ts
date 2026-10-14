import { prisma } from "../../../lib/prisma.js";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
} from "../../../types/types.js";
import { autoFollowUpConfigRepo } from "../repos/auto-followup-config.repo.js";
import { followUpEnrollmentRepo } from "../repos/followup-enrollment.repo.js";
import { followUpExecutionRepo } from "../repos/followup-execution.repo.js";
import { whatsAppMessageService } from "../../communication/services/whatsapp-message.service.js";

/**
 * Project Handover Payment Reminder Auto Follow-Up Service
 * Handles automated payment reminder sequences for handovers with outstanding pending balances.
 * Automatically halts when pending balance is settled or commercial is cleared.
 */
export class PaymentFollowUpService {
  /**
   * Enroll a Project Handover into the organization's default or specified payment reminder sequence.
   *
   * @param organizationId - Tenant organization UUID
   * @param handoverId - Project Handover UUID
   * @param explicitConfigId - Optional explicit OrgFollowUpConfig UUID
   */
  async enrollHandover(
    organizationId: string,
    handoverId: string,
    explicitConfigId?: string,
  ) {
    // 1. Fetch Handover with relations
    const handover = await prisma.projectHandover.findFirst({
      where: { id: handoverId, organizationId, isDeleted: false },
      include: {
        customer: true,
        project: { include: { customer: true } },
      },
    });

    if (!handover) {
      return null;
    }

    const recipientPhone =
      handover.customer?.phone || handover.project?.customer?.phone;
    if (!recipientPhone) {
      return null;
    }

    // Do not enroll if already cleared or pending amount is zero
    const pendingAmount = Number(handover.pendingAmount ?? 0);
    if (handover.isCommercialCleared || pendingAmount <= 0) {
      return null;
    }

    // 2. Check if active enrollment already exists
    const existing = await followUpEnrollmentRepo.getActiveEnrollmentForHandover(
      organizationId,
      handoverId,
    );
    if (existing) {
      return existing;
    }

    // 3. Fetch configuration
    const config = explicitConfigId
      ? await autoFollowUpConfigRepo.getConfigById(organizationId, explicitConfigId)
      : await autoFollowUpConfigRepo.getDefaultConfig(
          organizationId,
          FollowUpConfigType.PAYMENT_REMINDER,
        );

    if (
      !config ||
      !config.isActive ||
      !config.paymentSteps ||
      config.paymentSteps.length === 0
    ) {
      return null;
    }

    const activeSteps = config.paymentSteps.filter((s) => s.isActive);
    if (activeSteps.length === 0) return null;

    // 4. Calculate execution date for Step 1
    const firstStep = activeSteps[0];
    if (!firstStep) return null;

    const baseDate = handover.handoverDate || handover.scheduledDate || handover.createdAt;
    const nextExecutionAt = this.calculateStepExecutionTime(
      baseDate,
      firstStep.dayOffset,
      config.preferredSendTime || "11:00",
    );

    // 5. Create enrollment
    const enrollment = await followUpEnrollmentRepo.createEnrollment(organizationId, {
      configId: config.id,
      handoverId,
      projectId: handover.projectId,
      status: FollowUpEnrollmentStatus.ACTIVE,
      currentStepIndex: 0,
      totalSteps: activeSteps.length,
      nextExecutionAt,
      metadata: {
        enrolledAt: new Date().toISOString(),
        customerPhone: recipientPhone,
        pendingAmount,
        finalSettlementAmount: Number(handover.finalSettlementAmount ?? 0),
        handoverNumber: handover.handoverNumber,
      },
    });

    // 6. Pre-create execution log for first step
    await followUpExecutionRepo.createExecutionLog(organizationId, {
      enrollmentId: enrollment.id,
      paymentStepId: firstStep.id,
      handoverId,
      projectId: handover.projectId,
      templateId: firstStep.templateId,
      status: FollowUpExecutionStatus.SCHEDULED,
      scheduledFor: nextExecutionAt,
    });

    return enrollment;
  }

  /**
   * Execute due step for an active payment reminder enrollment.
   *
   * @param enrollmentId - FollowUpEnrollment UUID
   */
  async executeStep(enrollmentId: string) {
    const enrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        config: {
          include: {
            paymentSteps: {
              where: { isActive: true },
              orderBy: { stepOrder: "asc" },
              include: { template: { include: { variables: true } } },
            },
          },
        },
        handover: {
          include: {
            customer: true,
            project: { include: { customer: true } },
          },
        },
        project: true,
      },
    });

    if (
      !enrollment ||
      enrollment.status !== FollowUpEnrollmentStatus.ACTIVE ||
      !enrollment.handover
    ) {
      return;
    }

    const { handover, config, organizationId } = enrollment;
    const recipientPhone =
      handover.customer?.phone || handover.project?.customer?.phone;
    const recipientCustomer = handover.customer || handover.project?.customer;
    const recipientName =
      recipientCustomer
        ? `${recipientCustomer.firstName || ""} ${recipientCustomer.lastName || ""}`.trim() || "Customer"
        : "Customer";

    if (!recipientPhone) {
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollmentId, {
        status: FollowUpEnrollmentStatus.FAILED,
        stopReason: "Missing recipient customer phone number",
        stoppedAt: new Date(),
        nextExecutionAt: null,
      });
      return;
    }

    // Verify handover commercial clearance state
    const pendingAmount = Number(handover.pendingAmount ?? 0);
    if (handover.isCommercialCleared || pendingAmount <= 0) {
      await this.stopHandoverPaymentFollowUp(
        organizationId,
        handover.id,
        "Commercial settlement cleared / pending balance is zero",
        FollowUpEnrollmentStatus.COMPLETED,
      );
      return;
    }

    const activeSteps = config.paymentSteps;
    const currentStepIndex = enrollment.currentStepIndex;
    const currentStep = activeSteps[currentStepIndex];

    if (!currentStep) {
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollmentId, {
        status: FollowUpEnrollmentStatus.COMPLETED,
        stopReason: "Completed all configured reminder steps",
        stoppedAt: new Date(),
        nextExecutionAt: null,
      });
      return;
    }

    // Find pending execution log
    let executionLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        paymentStepId: currentStep.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
      orderBy: { scheduledFor: "desc" },
    });

    if (!executionLog) {
      executionLog = await followUpExecutionRepo.createExecutionLog(organizationId, {
        enrollmentId: enrollment.id,
        paymentStepId: currentStep.id,
        handoverId: handover.id,
        projectId: handover.projectId,
        templateId: currentStep.templateId,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: new Date(),
      });
    }

    // Dispatch WhatsApp Reminder
    try {
      if (!currentStep.templateId) {
        throw new Error("No WhatsApp message template linked to this payment reminder step");
      }

      const dispatchResult = await whatsAppMessageService.sendTemplateMessage(
        organizationId,
        {
          to: recipientPhone,
          templateId: currentStep.templateId,
          context: {
            projectId: handover.projectId,
            handoverId: handover.id,
            customerId: handover.customerId || handover.customer?.id,
            recipientPhone,
            recipientName,
            customOverrides: (currentStep.customVariables as Record<string, string>) || {},
          },
        },
      );

      // Update execution log
      await followUpExecutionRepo.updateExecutionLog(executionLog.id, {
        status: FollowUpExecutionStatus.DISPATCHED,
        executedAt: new Date(),
        renderedVariables: {
          messageId: dispatchResult.messageId,
          renderedBody: dispatchResult.renderedBody,
        },
      });

      // Advance or complete enrollment
      const nextIndex = currentStepIndex + 1;
      const nextStep = activeSteps[nextIndex];
      const isFinished = currentStep.isFinalStep || nextIndex >= activeSteps.length || !nextStep;

      if (isFinished || !nextStep) {
        await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollmentId, {
          status: FollowUpEnrollmentStatus.COMPLETED,
          currentStepIndex: nextIndex,
          lastExecutedAt: new Date(),
          nextExecutionAt: null,
          stoppedAt: new Date(),
          stopReason: "Completed all payment reminder steps",
        });
      } else {
        const baseDate = handover.handoverDate || handover.scheduledDate || handover.createdAt;
        const nextExecutionAt = this.calculateStepExecutionTime(
          baseDate,
          nextStep.dayOffset,
          config.preferredSendTime || "11:00",
        );

        await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollmentId, {
          currentStepIndex: nextIndex,
          lastExecutedAt: new Date(),
          nextExecutionAt,
        });

        // Pre-create next execution log
        await followUpExecutionRepo.createExecutionLog(organizationId, {
          enrollmentId: enrollment.id,
          paymentStepId: nextStep.id,
          handoverId: handover.id,
          projectId: handover.projectId,
          templateId: nextStep.templateId,
          status: FollowUpExecutionStatus.SCHEDULED,
          scheduledFor: nextExecutionAt,
        });
      }
    } catch (error: any) {
      console.error(`[PaymentFollowUp] Step execution failed for enrollment ${enrollmentId}:`, error);

      await followUpExecutionRepo.updateExecutionLog(executionLog.id, {
        status: FollowUpExecutionStatus.FAILED,
        executedAt: new Date(),
        errorMessage: error.message || "Failed to dispatch WhatsApp reminder",
        retryCount: (executionLog.retryCount || 0) + 1,
      });

      // Reschedule retry in 30 minutes if under retry limit
      if ((executionLog.retryCount || 0) < 3) {
        const retryAt = new Date(Date.now() + 30 * 60 * 1000);
        await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollmentId, {
          nextExecutionAt: retryAt,
        });
      } else {
        await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollmentId, {
          status: FollowUpEnrollmentStatus.FAILED,
          stoppedAt: new Date(),
          stopReason: `Delivery retries exceeded: ${error.message}`,
          nextExecutionAt: null,
        });
      }
    }
  }

  /**
   * Stop active payment reminder follow-up for a handover.
   *
   * @param organizationId - Tenant organization UUID
   * @param handoverId - Handover UUID
   * @param reason - Reason for termination
   * @param status - Terminal status
   */
  async stopHandoverPaymentFollowUp(
    organizationId: string,
    handoverId: string,
    reason: string = "Payment settled in full",
    status: FollowUpEnrollmentStatus = FollowUpEnrollmentStatus.COMPLETED,
  ) {
    const active = await followUpEnrollmentRepo.getActiveEnrollmentForHandover(
      organizationId,
      handoverId,
    );

    if (active) {
      await followUpEnrollmentRepo.stopHandoverPaymentFollowUp(
        organizationId,
        handoverId,
        reason,
        status,
      );

      // Cancel remaining scheduled execution logs
      await prisma.followUpExecutionLog.updateMany({
        where: {
          enrollmentId: active.id,
          status: FollowUpExecutionStatus.SCHEDULED,
        },
        data: {
          status: FollowUpExecutionStatus.CANCELLED,
          errorMessage: `Sequence cancelled: ${reason}`,
        },
      });
    }
  }

  /**
   * Resynchronize scheduled execution dates for all active enrollments when timing configuration changes.
   *
   * @param organizationId - Tenant organization UUID
   * @param configId - Configuration UUID
   */
  async resyncActiveEnrollmentsForConfig(
    organizationId: string,
    configId: string,
  ) {
    const activeEnrollments = await prisma.followUpEnrollment.findMany({
      where: {
        organizationId,
        configId,
        status: FollowUpEnrollmentStatus.ACTIVE,
      },
      include: {
        config: {
          include: {
            paymentSteps: {
              where: { isActive: true },
              orderBy: { stepOrder: "asc" },
            },
          },
        },
        handover: true,
      },
    });

    for (const enrollment of activeEnrollments) {
      if (!enrollment.handover) continue;

      const activeSteps = enrollment.config.paymentSteps;
      const currentStep = activeSteps[enrollment.currentStepIndex];

      if (!currentStep) continue;

      const baseDate =
        enrollment.handover.handoverDate ||
        enrollment.handover.scheduledDate ||
        enrollment.handover.createdAt;

      const newExecutionAt = this.calculateStepExecutionTime(
        baseDate,
        currentStep.dayOffset,
        enrollment.config.preferredSendTime || "11:00",
      );

      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        nextExecutionAt: newExecutionAt,
        totalSteps: activeSteps.length,
      });

      await prisma.followUpExecutionLog.updateMany({
        where: {
          enrollmentId: enrollment.id,
          paymentStepId: currentStep.id,
          status: FollowUpExecutionStatus.SCHEDULED,
        },
        data: {
          scheduledFor: newExecutionAt,
        },
      });
    }
  }

  /**
   * Calculate future dispatch Date based on dayOffset and preferredSendTime.
   */
  private calculateStepExecutionTime(
    baseDate: Date,
    dayOffset: number,
    preferredSendTime: string = "11:00",
  ): Date {
    const target = new Date(baseDate);
    target.setDate(target.getDate() + dayOffset);

    const [hours, minutes] = preferredSendTime.split(":").map((v) => parseInt(v, 10));
    target.setHours(hours || 11, minutes || 0, 0, 0);

    // If target timestamp is in the past, schedule for 5 minutes in future
    if (target.getTime() <= Date.now()) {
      return new Date(Date.now() + 5 * 60 * 1000);
    }

    return target;
  }
}

export const paymentFollowUpService = new PaymentFollowUpService();

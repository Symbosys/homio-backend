import { prisma } from "../../../lib/prisma.js";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  LeadStatus,
} from "../../../types/types.js";
import { autoFollowUpConfigRepo } from "../repos/auto-followup-config.repo.js";
import { followUpEnrollmentRepo } from "../repos/followup-enrollment.repo.js";
import { followUpExecutionRepo } from "../repos/followup-execution.repo.js";
import { whatsAppMessageService } from "../../communication/services/whatsapp-message.service.js";

/**
 * Lead No-Response Auto Follow-Up Service
 * Handles automatic multi-day follow-up sequences for Leads.
 * Follow-up persists across normal replies and ONLY stops when a meeting is booked.
 * On final step execution, dispatches template and marks lead status as NOT_RESPONDING.
 */
export class LeadFollowUpService {
  /**
   * Enroll a newly created Lead into the organization's default or specified follow-up sequence.
   *
   * @param organizationId - Tenant organization UUID
   * @param leadId - Lead UUID
   * @param explicitConfigId - Optional explicit OrgFollowUpConfig UUID
   */
  async enrollLead(
    organizationId: string,
    leadId: string,
    explicitConfigId?: string,
  ) {
    // 1. Fetch Lead details
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, organizationId, isDeleted: false },
      include: { customer: true },
    });

    if (!lead || !lead.customer?.phone) {
      return null;
    }

    // Do not enroll if already in meeting scheduled or converted/lost states
    if (
      lead.status === LeadStatus.ONLINE_MEETING_SCHEDULED ||
      lead.status === LeadStatus.SITE_VISIT_SCHEDULED ||
      lead.status === LeadStatus.WON ||
      lead.status === LeadStatus.LOST ||
      lead.status === LeadStatus.JUNK
    ) {
      return null;
    }

    // 2. Check if active enrollment already exists
    const existing = await followUpEnrollmentRepo.getActiveEnrollmentForLead(
      organizationId,
      leadId,
    );
    if (existing) {
      return existing;
    }

    // 3. Fetch configuration
    const config = explicitConfigId
      ? await autoFollowUpConfigRepo.getConfigById(organizationId, explicitConfigId)
      : await autoFollowUpConfigRepo.getDefaultConfig(
          organizationId,
          FollowUpConfigType.LEAD_NO_RESPONSE,
        );

    if (!config || !config.isActive || !config.leadSteps || config.leadSteps.length === 0) {
      return null;
    }

    const activeSteps = config.leadSteps.filter((s) => s.isActive);
    if (activeSteps.length === 0) return null;

    // 4. Calculate execution date for Step 0
    const firstStep = activeSteps[0];
    if (!firstStep) return null;

    const nextExecutionAt = this.calculateStepExecutionTime(
      lead.createdAt,
      firstStep.dayOffset,
      config.preferredSendTime || "10:00",
    );

    // 5. Create enrollment
    const enrollment = await followUpEnrollmentRepo.createEnrollment(organizationId, {
      configId: config.id,
      leadId,
      status: FollowUpEnrollmentStatus.ACTIVE,
      currentStepIndex: 0,
      totalSteps: activeSteps.length,
      nextExecutionAt,
      metadata: {
        enrolledAt: new Date().toISOString(),
        customerPhone: lead.customer.phone,
      },
    });

    // 6. Pre-create execution log for first step
    await followUpExecutionRepo.createExecutionLog(organizationId, {
      enrollmentId: enrollment.id,
      leadStepId: firstStep.id,
      leadId,
      templateId: firstStep.templateId,
      status: FollowUpExecutionStatus.SCHEDULED,
      scheduledFor: nextExecutionAt,
    });

    return enrollment;
  }

  /**
   * Execute due step for an active lead follow-up enrollment.
   *
   * @param enrollmentId - FollowUpEnrollment UUID
   */
  async executeStep(enrollmentId: string) {
    const enrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollmentId },
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

    if (
      !enrollment ||
      enrollment.status !== FollowUpEnrollmentStatus.ACTIVE ||
      !enrollment.lead ||
      !enrollment.lead.customer?.phone
    ) {
      return;
    }

    const { lead, config, organizationId } = enrollment;

    // Verify lead has not booked a meeting in the meantime
    if (
      lead.status === LeadStatus.ONLINE_MEETING_SCHEDULED ||
      lead.status === LeadStatus.SITE_VISIT_SCHEDULED ||
      lead.status === LeadStatus.WON ||
      lead.status === LeadStatus.LOST
    ) {
      await this.stopLeadFollowUp(
        organizationId,
        lead.id,
        `Lead in final or meeting status: ${lead.status}`,
      );
      return;
    }

    const activeSteps = config.leadSteps;
    const currentStep = activeSteps[enrollment.currentStepIndex];

    if (!currentStep) {
      // All steps exhausted
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        status: FollowUpEnrollmentStatus.COMPLETED,
        nextExecutionAt: null,
      });
      return;
    }

    const isFinalStep =
      currentStep.isFinalStep || enrollment.currentStepIndex === activeSteps.length - 1;

    // Find pending scheduled execution log or create one
    let executionLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        leadStepId: currentStep.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
      orderBy: { scheduledFor: "desc" },
    });

    if (!executionLog) {
      executionLog = await followUpExecutionRepo.createExecutionLog(organizationId, {
        enrollmentId: enrollment.id,
        leadStepId: currentStep.id,
        leadId: lead.id,
        templateId: currentStep.templateId,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: new Date(),
      });
    }

    // Dispatch WhatsApp template if configured
    let dispatchSuccess = false;
    let errorMessage: string | null = null;

    if (currentStep.templateId) {
      try {
        await whatsAppMessageService.sendTemplateMessage(organizationId, {
          to: lead.customer.phone,
          templateId: currentStep.templateId,
          context: {
            leadId: lead.id,
            customerId: lead.customerId,
            recipientName: `${lead.customer.firstName || ""} ${lead.customer.lastName || ""}`.trim() || lead.title,
            customOverrides: currentStep.customVariables as Record<string, string> | undefined,
          },
        });
        dispatchSuccess = true;
      } catch (err: any) {
        errorMessage = err.message || "Failed to dispatch WhatsApp template";
      }
    } else {
      // If no template configured, mark step as dispatched
      dispatchSuccess = true;
    }

    // Update execution log
    await followUpExecutionRepo.updateExecutionLog(executionLog.id, {
      status: dispatchSuccess
        ? FollowUpExecutionStatus.DISPATCHED
        : FollowUpExecutionStatus.FAILED,
      executedAt: new Date(),
      errorMessage,
    });

    const nextStepIndex = enrollment.currentStepIndex + 1;
    const hasNextStep = nextStepIndex < activeSteps.length && !isFinalStep;

    const nextStep = activeSteps[nextStepIndex];
    if (hasNextStep && nextStep) {
      const nextExecutionAt = this.calculateStepExecutionTime(
        lead.createdAt,
        nextStep.dayOffset,
        config.preferredSendTime || "10:00",
      );

      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        currentStepIndex: nextStepIndex,
        nextExecutionAt,
        lastExecutedAt: new Date(),
      });

      // Schedule next execution log
      await followUpExecutionRepo.createExecutionLog(organizationId, {
        enrollmentId: enrollment.id,
        leadStepId: nextStep.id,
        leadId: lead.id,
        templateId: nextStep.templateId,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: nextExecutionAt,
      });
    } else {
      // Final step completed: mark lead status as NOT_RESPONDING
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: { status: LeadStatus.NOT_RESPONDING },
        }),
        prisma.followUpEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: FollowUpEnrollmentStatus.COMPLETED,
            lastExecutedAt: new Date(),
            nextExecutionAt: null,
          },
        }),
      ]);
    }
  }

  /**
   * Resynchronize and recalculate all active lead follow-up enrollments for a configuration.
   * Called whenever steps, preferred send time, or templates are modified.
   */
  async resyncActiveEnrollmentsForConfig(organizationId: string, configId: string) {
    const config = await autoFollowUpConfigRepo.getConfigById(organizationId, configId);
    if (!config) return;

    const activeEnrollments = await prisma.followUpEnrollment.findMany({
      where: {
        organizationId,
        configId,
        status: FollowUpEnrollmentStatus.ACTIVE,
      },
      include: {
        lead: true,
      },
    });

    const activeSteps = (config.leadSteps || []).filter((s) => s.isActive);
    if (activeSteps.length === 0) {
      if (!config.isActive) {
        await prisma.followUpEnrollment.updateMany({
          where: {
            organizationId,
            configId,
            status: FollowUpEnrollmentStatus.ACTIVE,
          },
          data: { status: FollowUpEnrollmentStatus.PAUSED, nextExecutionAt: null },
        });
      }
      return;
    }

    for (const enrollment of activeEnrollments) {
      if (!enrollment.lead) continue;

      // Delete any pending (SCHEDULED) execution logs so they pick up new steps/templates
      await prisma.followUpExecutionLog.deleteMany({
        where: {
          enrollmentId: enrollment.id,
          status: FollowUpExecutionStatus.SCHEDULED,
        },
      });

      let stepIndex = enrollment.currentStepIndex;
      if (stepIndex >= activeSteps.length) {
        stepIndex = Math.max(0, activeSteps.length - 1);
      }

      const targetStep = activeSteps[stepIndex];
      if (targetStep) {
        const nextExecutionAt = this.calculateStepExecutionTime(
          enrollment.lead.createdAt,
          targetStep.dayOffset,
          config.preferredSendTime || "10:00",
        );

        // Update enrollment with new step counts and calculated next time
        await prisma.followUpEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepIndex: stepIndex,
            totalSteps: activeSteps.length,
            nextExecutionAt,
          },
        });

        // Recreate the pending execution log with updated step & template
        await followUpExecutionRepo.createExecutionLog(organizationId, {
          enrollmentId: enrollment.id,
          leadStepId: targetStep.id,
          leadId: enrollment.lead.id,
          templateId: targetStep.templateId,
          status: FollowUpExecutionStatus.SCHEDULED,
          scheduledFor: nextExecutionAt,
        });
      }
    }
  }

  /**
   * Stop active lead follow-up when a meeting is scheduled.
   *
   * @param organizationId - Tenant organization UUID
   * @param leadId - Lead UUID
   * @param reason - Reason description
   */
  async stopLeadFollowUp(
    organizationId: string,
    leadId: string,
    reason: string = "Meeting scheduled",
  ) {
    const activeEnrollment = await followUpEnrollmentRepo.getActiveEnrollmentForLead(
      organizationId,
      leadId,
    );

    if (activeEnrollment) {
      await followUpExecutionRepo.cancelPendingLogsForEnrollment(
        activeEnrollment.id,
        reason,
      );
      await followUpEnrollmentRepo.stopActiveEnrollmentsForLead(
        organizationId,
        leadId,
        reason,
        FollowUpEnrollmentStatus.STOPPED_MEETING_BOOKED,
      );
    }
  }

  /**
   * Calculate scheduled execution time based on base date, day offset, and preferred time string (HH:mm).
   */
  public calculateStepExecutionTime(
    baseDate: Date,
    dayOffset: number,
    preferredTime: string,
  ): Date {
    const [hoursStr, minutesStr] = preferredTime.split(":");
    const hours = parseInt(hoursStr || "10", 10);
    const minutes = parseInt(minutesStr || "0", 10);

    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    targetDate.setHours(hours, minutes, 0, 0);

    return targetDate;
  }
}

export const leadFollowUpService = new LeadFollowUpService();

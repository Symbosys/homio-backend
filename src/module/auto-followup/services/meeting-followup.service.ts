import { prisma } from "../../../lib/prisma.js";
import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  FollowUpIntervalUnit,
  MeetingStatus,
} from "../../../types/types.js";
import { autoFollowUpConfigRepo } from "../repos/auto-followup-config.repo.js";
import { followUpEnrollmentRepo } from "../repos/followup-enrollment.repo.js";
import { followUpExecutionRepo } from "../repos/followup-execution.repo.js";
import { RelativeTimeFormatter } from "./relative-time.formatter.js";
import { whatsAppMessageService } from "../../communication/services/whatsapp-message.service.js";

/**
 * Meeting Reminder Auto Follow-Up Service
 * Handles automated pre-meeting reminder sequences across days, hours, and minutes before the meeting.
 * Automatically recalculates schedules on meeting reschedule and stops when meeting is cancelled.
 */
export class MeetingFollowUpService {
  /**
   * Enroll a newly scheduled meeting into the reminder sequence.
   *
   * @param organizationId - Tenant organization UUID
   * @param meetingId - Meeting UUID
   * @param explicitConfigId - Optional explicit OrgFollowUpConfig UUID
   */
  async enrollMeeting(
    organizationId: string,
    meetingId: string,
    explicitConfigId?: string,
  ) {
    // 1. Fetch meeting details
    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId, isDeleted: false },
      include: {
        customer: true,
        lead: { include: { customer: true } },
      },
    });

    if (!meeting) return null;

    const recipientPhone = meeting.customer?.phone || meeting.lead?.customer?.phone;
    if (!recipientPhone) return null;

    if (
      meeting.status === MeetingStatus.CANCELLED ||
      meeting.status === MeetingStatus.COMPLETED ||
      meeting.status === MeetingStatus.NO_SHOW
    ) {
      return null;
    }

    // 2. Check if active enrollment already exists
    const existing = await followUpEnrollmentRepo.getActiveEnrollmentForMeeting(
      organizationId,
      meetingId,
    );
    if (existing) {
      return existing;
    }

    // 3. Fetch configuration
    const config = explicitConfigId
      ? await autoFollowUpConfigRepo.getConfigById(organizationId, explicitConfigId)
      : await autoFollowUpConfigRepo.getDefaultConfig(
          organizationId,
          FollowUpConfigType.MEETING_REMINDER,
        );

    if (
      !config ||
      !config.isActive ||
      !config.meetingSteps ||
      config.meetingSteps.length === 0
    ) {
      return null;
    }

    // Filter applicable steps (meeting type matching if specified)
    if (config.meetingTypes && config.meetingTypes.length > 0) {
      if (!config.meetingTypes.includes(meeting.type)) {
        return null;
      }
    }

    const activeSteps = config.meetingSteps.filter((s) => s.isActive);
    if (activeSteps.length === 0) return null;

    const now = new Date();
    const meetingStart = new Date(meeting.startTime);

    // Calculate step execution dates and filter to future steps
    const stepSchedules = activeSteps
      .map((step, idx) => {
        const scheduledFor = this.calculateStepExecutionTime(
          meetingStart,
          step.intervalUnit,
          step.intervalValue,
        );
        return { step, idx, scheduledFor };
      })
      .filter((s) => s.scheduledFor.getTime() > now.getTime())
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

    if (stepSchedules.length === 0) {
      return null;
    }

    const firstScheduled = stepSchedules[0];
    if (!firstScheduled) {
      return null;
    }

    // 4. Create enrollment
    const enrollment = await followUpEnrollmentRepo.createEnrollment(organizationId, {
      configId: config.id,
      meetingId,
      status: FollowUpEnrollmentStatus.ACTIVE,
      currentStepIndex: firstScheduled.idx,
      totalSteps: activeSteps.length,
      nextExecutionAt: firstScheduled.scheduledFor,
      metadata: {
        meetingStartTime: meetingStart.toISOString(),
        recipientPhone,
      },
    });

    // 5. Pre-create scheduled execution logs for all upcoming steps
    for (const schedule of stepSchedules) {
      await followUpExecutionRepo.createExecutionLog(organizationId, {
        enrollmentId: enrollment.id,
        meetingStepId: schedule.step.id,
        meetingId,
        templateId: schedule.step.templateId,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: schedule.scheduledFor,
      });
    }

    return enrollment;
  }

  /**
   * Recalculate reminder execution schedules when a meeting is rescheduled.
   *
   * @param organizationId - Tenant organization UUID
   * @param meetingId - Meeting UUID
   */
  async onMeetingRescheduled(organizationId: string, meetingId: string) {
    const enrollment = await followUpEnrollmentRepo.getActiveEnrollmentForMeeting(
      organizationId,
      meetingId,
    );

    if (!enrollment) {
      // If not previously enrolled, attempt to enroll afresh
      return this.enrollMeeting(organizationId, meetingId);
    }

    const meeting = await prisma.meeting.findFirst({
      where: { id: meetingId, organizationId, isDeleted: false },
    });

    if (!meeting) return;

    // 1. Cancel existing pending scheduled logs
    await followUpExecutionRepo.cancelPendingLogsForEnrollment(
      enrollment.id,
      "Meeting rescheduled - recalculating reminder times",
    );

    // 2. Recalculate based on new meeting start time
    const activeSteps = enrollment.config.meetingSteps.filter((s) => s.isActive);
    const now = new Date();
    const meetingStart = new Date(meeting.startTime);

    const stepSchedules = activeSteps
      .map((step, idx) => {
        const scheduledFor = this.calculateStepExecutionTime(
          meetingStart,
          step.intervalUnit,
          step.intervalValue,
        );
        return { step, idx, scheduledFor };
      })
      .filter((s) => s.scheduledFor.getTime() > now.getTime())
      .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

    if (stepSchedules.length === 0) {
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        status: FollowUpEnrollmentStatus.COMPLETED,
        nextExecutionAt: null,
      });
      return;
    }

    const firstScheduled = stepSchedules[0];
    if (!firstScheduled) return;

    // 3. Update enrollment nextExecutionAt
    await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
      currentStepIndex: firstScheduled.idx,
      nextExecutionAt: firstScheduled.scheduledFor,
      metadata: {
        ...(enrollment.metadata as Record<string, any>),
        meetingStartTime: meetingStart.toISOString(),
        rescheduledAt: new Date().toISOString(),
      },
    });

    // 4. Create new execution logs
    for (const schedule of stepSchedules) {
      await followUpExecutionRepo.createExecutionLog(organizationId, {
        enrollmentId: enrollment.id,
        meetingStepId: schedule.step.id,
        meetingId,
        templateId: schedule.step.templateId,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: schedule.scheduledFor,
      });
    }
  }

  /**
   * Stop active meeting reminders when a meeting is cancelled.
   *
   * @param organizationId - Tenant organization UUID
   * @param meetingId - Meeting UUID
   * @param reason - Cancellation reason
   */
  async onMeetingCancelled(
    organizationId: string,
    meetingId: string,
    reason: string = "Meeting cancelled",
  ) {
    const enrollment = await followUpEnrollmentRepo.getActiveEnrollmentForMeeting(
      organizationId,
      meetingId,
    );

    if (enrollment) {
      await followUpExecutionRepo.cancelPendingLogsForEnrollment(
        enrollment.id,
        reason,
      );
      await followUpEnrollmentRepo.stopActiveEnrollmentsForMeeting(
        organizationId,
        meetingId,
        reason,
      );
    }
  }

  /**
   * Execute due reminder step for an active meeting follow-up enrollment.
   *
   * @param enrollmentId - FollowUpEnrollment UUID
   */
  async executeStep(enrollmentId: string) {
    const enrollment = await prisma.followUpEnrollment.findUnique({
      where: { id: enrollmentId },
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
          include: {
            customer: true,
            lead: { include: { customer: true } },
          },
        },
      },
    });

    if (
      !enrollment ||
      enrollment.status !== FollowUpEnrollmentStatus.ACTIVE ||
      !enrollment.meeting
    ) {
      return;
    }

    const { meeting, config, organizationId } = enrollment;

    if (
      meeting.status === MeetingStatus.CANCELLED ||
      meeting.status === MeetingStatus.COMPLETED ||
      meeting.status === MeetingStatus.NO_SHOW
    ) {
      await this.onMeetingCancelled(
        organizationId,
        meeting.id,
        `Meeting in status: ${meeting.status}`,
      );
      return;
    }

    const recipientPhone = meeting.customer?.phone || meeting.lead?.customer?.phone;
    const recipientName =
      meeting.customer?.firstName ||
      meeting.lead?.customer?.firstName ||
      meeting.title ||
      "Customer";

    if (!recipientPhone) return;

    const activeSteps = config.meetingSteps;
    const currentStep = activeSteps[enrollment.currentStepIndex];

    if (!currentStep) {
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        status: FollowUpEnrollmentStatus.COMPLETED,
        nextExecutionAt: null,
      });
      return;
    }

    // Dynamic relative time variable calculation (e.g. "in 2 days", "in 5 hours", "in 15 minutes")
    const relativeTime = RelativeTimeFormatter.formatRelativeTime(
      currentStep.intervalUnit,
      currentStep.intervalValue,
      currentStep.dynamicTimeVariableFormat,
    );

    // Find pending execution log
    let executionLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        meetingStepId: currentStep.id,
        status: FollowUpExecutionStatus.SCHEDULED,
      },
      orderBy: { scheduledFor: "desc" },
    });

    if (!executionLog) {
      executionLog = await followUpExecutionRepo.createExecutionLog(organizationId, {
        enrollmentId: enrollment.id,
        meetingStepId: currentStep.id,
        meetingId: meeting.id,
        templateId: currentStep.templateId,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: new Date(),
      });
    }

    let dispatchSuccess = false;
    let errorMessage: string | null = null;

    if (currentStep.templateId) {
      try {
        const customOverrides = {
          timeToMeeting: relativeTime,
          relativeTime,
          meetingTitle: meeting.title,
          meetingDate: new Date(meeting.meetingDate).toLocaleDateString(),
          meetingTime: new Date(meeting.startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          meetingUrl: meeting.meetingUrl || "",
          ...((currentStep.customVariables as Record<string, string>) || {}),
        };

        await whatsAppMessageService.sendTemplateMessage(organizationId, {
          to: recipientPhone,
          templateId: currentStep.templateId,
          context: {
            meetingId: meeting.id,
            leadId: meeting.leadId || undefined,
            customerId: meeting.customerId || undefined,
            recipientName,
            customOverrides,
          },
        });
        dispatchSuccess = true;
      } catch (err: any) {
        errorMessage = err.message || "Failed to dispatch WhatsApp reminder";
      }
    } else {
      dispatchSuccess = true;
    }

    // Update execution log
    await followUpExecutionRepo.updateExecutionLog(executionLog.id, {
      status: dispatchSuccess
        ? FollowUpExecutionStatus.DISPATCHED
        : FollowUpExecutionStatus.FAILED,
      executedAt: new Date(),
      renderedVariables: { relativeTime },
      errorMessage,
    });

    // Find next upcoming scheduled log
    const now = new Date();
    const nextLog = await prisma.followUpExecutionLog.findFirst({
      where: {
        enrollmentId: enrollment.id,
        status: FollowUpExecutionStatus.SCHEDULED,
        scheduledFor: { gt: now },
      },
      orderBy: { scheduledFor: "asc" },
    });

    if (nextLog) {
      const nextStepIdx = activeSteps.findIndex((s) => s.id === nextLog.meetingStepId);
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        currentStepIndex: nextStepIdx >= 0 ? nextStepIdx : enrollment.currentStepIndex + 1,
        nextExecutionAt: nextLog.scheduledFor,
        lastExecutedAt: new Date(),
      });
    } else {
      await followUpEnrollmentRepo.updateEnrollment(organizationId, enrollment.id, {
        status: FollowUpEnrollmentStatus.COMPLETED,
        lastExecutedAt: new Date(),
        nextExecutionAt: null,
      });
    }
  }

  /**
   * Resynchronize and recalculate all active meeting reminder enrollments for a configuration.
   * Called whenever reminder intervals, time units, or templates are modified.
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
        meeting: true,
      },
    });

    const activeSteps = (config.meetingSteps || []).filter((s) => s.isActive);
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

    const now = new Date();

    for (const enrollment of activeEnrollments) {
      if (!enrollment.meeting) continue;

      const meetingStart = new Date(enrollment.meeting.startTime);

      // Delete any pending (SCHEDULED) execution logs
      await prisma.followUpExecutionLog.deleteMany({
        where: {
          enrollmentId: enrollment.id,
          status: FollowUpExecutionStatus.SCHEDULED,
        },
      });

      // Recalculate future step schedules
      const stepSchedules = activeSteps
        .map((step, idx) => {
          const scheduledFor = this.calculateStepExecutionTime(
            meetingStart,
            step.intervalUnit,
            step.intervalValue,
          );
          return { step, idx, scheduledFor };
        })
        .filter((s) => s.scheduledFor.getTime() > now.getTime())
        .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());

      if (stepSchedules.length > 0) {
        const firstScheduled = stepSchedules[0]!;

        await prisma.followUpEnrollment.update({
          where: { id: enrollment.id },
          data: {
            currentStepIndex: firstScheduled.idx,
            totalSteps: activeSteps.length,
            nextExecutionAt: firstScheduled.scheduledFor,
          },
        });

        for (const schedule of stepSchedules) {
          await followUpExecutionRepo.createExecutionLog(organizationId, {
            enrollmentId: enrollment.id,
            meetingStepId: schedule.step.id,
            meetingId: enrollment.meeting.id,
            templateId: schedule.step.templateId,
            status: FollowUpExecutionStatus.SCHEDULED,
            scheduledFor: schedule.scheduledFor,
          });
        }
      } else {
        // No future steps remaining
        await prisma.followUpEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: FollowUpEnrollmentStatus.COMPLETED,
            nextExecutionAt: null,
          },
        });
      }
    }
  }

  /**
   * Calculate scheduled execution time before meeting start time.
   */
  public calculateStepExecutionTime(
    meetingStartTime: Date,
    intervalUnit: FollowUpIntervalUnit,
    intervalValue: number,
  ): Date {
    const meetingTimeMs = meetingStartTime.getTime();
    let offsetMs = 0;

    switch (intervalUnit) {
      case FollowUpIntervalUnit.DAYS_BEFORE:
        offsetMs = intervalValue * 24 * 60 * 60 * 1000;
        break;
      case FollowUpIntervalUnit.HOURS_BEFORE:
        offsetMs = intervalValue * 60 * 60 * 1000;
        break;
      case FollowUpIntervalUnit.MINUTES_BEFORE:
        offsetMs = intervalValue * 60 * 1000;
        break;
      default:
        offsetMs = intervalValue * 60 * 60 * 1000;
    }

    return new Date(meetingTimeMs - offsetMs);
  }
}

export const meetingFollowUpService = new MeetingFollowUpService();

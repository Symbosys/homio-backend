import {
  FollowUpConfigType,
  FollowUpEnrollmentStatus,
} from "../../../types/types.js";
import { autoFollowUpConfigRepo } from "../repos/auto-followup-config.repo.js";
import { followUpEnrollmentRepo } from "../repos/followup-enrollment.repo.js";
import { followUpExecutionRepo } from "../repos/followup-execution.repo.js";
import { leadFollowUpService } from "./lead-followup.service.js";
import { meetingFollowUpService } from "./meeting-followup.service.js";
import type {
  CreateFollowUpConfigInput,
  UpdateFollowUpConfigInput,
} from "../validators/auto-followup.validator.js";

/**
 * Auto Follow-Up Master Orchestrator Service
 * Coordinates configuration CRUD, manual enrollments, status transitions, and batch execution processing.
 */
export class AutoFollowUpService {
  /**
   * Get unified follow-up configuration for an organization (combines Lead and Meeting configs).
   *
   * @param organizationId - Tenant organization UUID
   */
  async getUnifiedConfig(organizationId: string) {
    const [leadConfig, meetingConfig] = await Promise.all([
      autoFollowUpConfigRepo.getDefaultConfig(organizationId, FollowUpConfigType.LEAD_NO_RESPONSE),
      autoFollowUpConfigRepo.getDefaultConfig(organizationId, FollowUpConfigType.MEETING_REMINDER),
    ]);

    const leadSteps = (leadConfig?.leadSteps || []).map((step) => ({
      id: step.id,
      configId: step.configId,
      stepOrder: step.stepOrder,
      dayOffset: step.dayOffset,
      preferredSendTime: leadConfig?.preferredSendTime || "10:00",
      channel: step.channel,
      whatsappTemplateId: step.templateId,
      description: null,
      isActive: step.isActive,
      isFinalStep: step.isFinalStep,
      additionalInformation: step.additionalInformation,
      whatsappTemplate: step.template
        ? {
            id: step.template.id,
            name: step.template.name,
            category: step.template.category,
            language: step.template.language,
          }
        : null,
    }));

    const meetingSteps = (meetingConfig?.meetingSteps || []).map((step) => ({
      id: step.id,
      configId: step.configId,
      stepOrder: step.stepOrder,
      intervalValue: step.intervalValue,
      intervalUnit: step.intervalUnit,
      channel: step.channel,
      whatsappTemplateId: step.templateId,
      description: null,
      isActive: step.isActive,
      additionalInformation: step.additionalInformation,
      whatsappTemplate: step.template
        ? {
            id: step.template.id,
            name: step.template.name,
            category: step.template.category,
            language: step.template.language,
          }
        : null,
    }));

    return {
      id: leadConfig?.id || meetingConfig?.id || "default",
      organizationId,
      isLeadFollowUpActive: leadConfig?.isActive ?? true,
      isMeetingReminderActive: meetingConfig?.isActive ?? true,
      defaultChannel: "WHATSAPP",
      additionalInformation: {
        ...(typeof leadConfig?.additionalInformation === "object" && leadConfig.additionalInformation ? leadConfig.additionalInformation : {}),
        ...(typeof meetingConfig?.additionalInformation === "object" && meetingConfig.additionalInformation ? meetingConfig.additionalInformation : {}),
      },
      leadFollowUpSteps: leadSteps,
      meetingFollowUpSteps: meetingSteps,
      createdAt: leadConfig?.createdAt || meetingConfig?.createdAt || new Date(),
      updatedAt: leadConfig?.updatedAt || meetingConfig?.updatedAt || new Date(),
    };
  }

  /**
   * Upsert unified follow-up configuration for an organization.
   *
   * @param organizationId - Tenant organization UUID
   * @param data - Unified follow-up settings payload
   * @param userId - Requesting user UUID
   */
  async upsertUnifiedConfig(organizationId: string, data: any, userId?: string) {
    // 1. Handle Lead No-Response Sequence
    if (data.isLeadFollowUpActive !== undefined || data.leadFollowUpSteps !== undefined) {
      const existingLeadConfig = await autoFollowUpConfigRepo.getDefaultConfig(
        organizationId,
        FollowUpConfigType.LEAD_NO_RESPONSE,
      );

      const preferredTime =
        data.preferredSendTime ||
        data.leadFollowUpSteps?.[0]?.preferredSendTime ||
        existingLeadConfig?.preferredSendTime ||
        "10:00";

      const leadStepsData = data.leadFollowUpSteps?.map((s: any, idx: number) => {
        const rawTplId = s.whatsappTemplateId || s.templateId;
        const validTplId =
          typeof rawTplId === "string" && rawTplId.trim() ? rawTplId.trim() : null;
        return {
          id: s.id && typeof s.id === "string" && !s.id.startsWith("temp-") ? s.id : undefined,
          stepOrder: s.stepOrder ?? idx + 1,
          dayOffset: Number(s.dayOffset) || 1,
          channel: s.channel || "WHATSAPP",
          templateId: validTplId,
          isFinalStep: s.isFinalStep ?? idx === data.leadFollowUpSteps.length - 1,
          isActive: s.isActive ?? true,
          additionalInformation: s.additionalInformation || null,
        };
      });

      let savedLeadConfig;
      if (existingLeadConfig) {
        savedLeadConfig = await autoFollowUpConfigRepo.updateConfig(organizationId, existingLeadConfig.id, {
          isActive: data.isLeadFollowUpActive !== undefined ? data.isLeadFollowUpActive : existingLeadConfig.isActive,
          preferredSendTime: preferredTime,
          leadSteps: leadStepsData,
        });
      } else {
        savedLeadConfig = await autoFollowUpConfigRepo.createConfig(
          organizationId,
          {
            type: FollowUpConfigType.LEAD_NO_RESPONSE,
            name: "Default Lead No-Response Follow-Up",
            description: "Automated WhatsApp follow-up sequence for unanswered leads",
            isActive: data.isLeadFollowUpActive ?? true,
            isDefault: true,
            preferredSendTime: preferredTime,
            meetingTypes: [],
            leadSteps: leadStepsData || [],
            meetingSteps: [],
          },
          userId,
        );
      }

      if (savedLeadConfig) {
        await leadFollowUpService.resyncActiveEnrollmentsForConfig(
          organizationId,
          savedLeadConfig.id,
        );
      }
    }

    // 2. Handle Meeting Reminder Sequence
    if (data.isMeetingReminderActive !== undefined || data.meetingFollowUpSteps !== undefined) {
      const existingMeetingConfig = await autoFollowUpConfigRepo.getDefaultConfig(
        organizationId,
        FollowUpConfigType.MEETING_REMINDER,
      );

      const meetingStepsData = data.meetingFollowUpSteps?.map((s: any, idx: number) => {
        const rawTplId = s.whatsappTemplateId || s.templateId;
        const validTplId =
          typeof rawTplId === "string" && rawTplId.trim() ? rawTplId.trim() : null;
        return {
          id: s.id && typeof s.id === "string" && !s.id.startsWith("temp-") ? s.id : undefined,
          stepOrder: s.stepOrder ?? idx + 1,
          intervalValue: Number(s.intervalValue) || 1,
          intervalUnit: s.intervalUnit || "HOURS_BEFORE",
          channel: s.channel || "WHATSAPP",
          templateId: validTplId,
          isActive: s.isActive ?? true,
          additionalInformation: s.additionalInformation || null,
        };
      });

      let savedMeetingConfig;
      if (existingMeetingConfig) {
        savedMeetingConfig = await autoFollowUpConfigRepo.updateConfig(organizationId, existingMeetingConfig.id, {
          isActive: data.isMeetingReminderActive !== undefined ? data.isMeetingReminderActive : existingMeetingConfig.isActive,
          meetingSteps: meetingStepsData,
        });
      } else {
        savedMeetingConfig = await autoFollowUpConfigRepo.createConfig(
          organizationId,
          {
            type: FollowUpConfigType.MEETING_REMINDER,
            name: "Default Pre-Meeting Reminders",
            description: "Automated WhatsApp reminders leading up to scheduled meetings",
            isActive: data.isMeetingReminderActive ?? true,
            isDefault: true,
            preferredSendTime: "10:00",
            meetingTypes: [],
            leadSteps: [],
            meetingSteps: meetingStepsData || [],
          },
          userId,
        );
      }

      if (savedMeetingConfig) {
        await meetingFollowUpService.resyncActiveEnrollmentsForConfig(
          organizationId,
          savedMeetingConfig.id,
        );
      }
    }

    return this.getUnifiedConfig(organizationId);
  }

  /**
   * Create an organization follow-up configuration.
   *
   * @param organizationId - Tenant organization UUID
   * @param data - Creation payload
   * @param userId - User UUID
   */
  async createConfig(
    organizationId: string,
    data: CreateFollowUpConfigInput,
    userId?: string,
  ) {
    return autoFollowUpConfigRepo.createConfig(organizationId, data, userId);
  }

  /**
   * Update an existing organization follow-up configuration.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Configuration UUID
   * @param data - Partial update payload
   */
  async updateConfig(
    organizationId: string,
    id: string,
    data: UpdateFollowUpConfigInput,
  ) {
    const updated = await autoFollowUpConfigRepo.updateConfig(organizationId, id, data);
    if (updated.type === FollowUpConfigType.LEAD_NO_RESPONSE) {
      await leadFollowUpService.resyncActiveEnrollmentsForConfig(organizationId, updated.id);
    } else if (updated.type === FollowUpConfigType.MEETING_REMINDER) {
      await meetingFollowUpService.resyncActiveEnrollmentsForConfig(organizationId, updated.id);
    }
    return updated;
  }

  /**
   * Get configuration by ID.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Configuration UUID
   */
  async getConfigById(organizationId: string, id: string) {
    return autoFollowUpConfigRepo.getConfigById(organizationId, id);
  }

  /**
   * List paginated configurations.
   *
   * @param organizationId - Tenant organization UUID
   * @param params - Query filters
   */
  async listConfigs(
    organizationId: string,
    params: {
      type?: FollowUpConfigType;
      isActive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return autoFollowUpConfigRepo.listConfigs(organizationId, params);
  }

  /**
   * Delete configuration.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Configuration UUID
   */
  async deleteConfig(organizationId: string, id: string) {
    return autoFollowUpConfigRepo.deleteConfig(organizationId, id);
  }

  /**
   * List paginated enrollments for an organization.
   *
   * @param organizationId - Tenant organization UUID
   * @param params - Filter options
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
    return followUpEnrollmentRepo.listEnrollments(organizationId, params);
  }

  /**
   * Get enrollment details by ID including execution logs and status.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Enrollment UUID
   */
  async getEnrollmentById(organizationId: string, id: string) {
    return followUpEnrollmentRepo.getEnrollmentById(organizationId, id);
  }

  /**
   * Manually stop/cancel an active enrollment.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Enrollment UUID
   * @param reason - Cancellation reason
   */
  async cancelEnrollment(
    organizationId: string,
    id: string,
    reason: string = "Manually cancelled by user",
  ) {
    await followUpExecutionRepo.cancelPendingLogsForEnrollment(id, reason);
    return followUpEnrollmentRepo.updateEnrollment(organizationId, id, {
      status: FollowUpEnrollmentStatus.STOPPED_CANCELLED,
      stopReason: reason,
      stoppedAt: new Date(),
      nextExecutionAt: null,
    });
  }

  /**
   * Batch process all currently due enrollments across the system.
   * Called periodically by the follow-up queue worker / cron poller.
   */
  async processDueEnrollments(batchSize: number = 50) {
    const dueEnrollments = await followUpEnrollmentRepo.getDueEnrollments(
      new Date(),
      batchSize,
    );

    const results = {
      processed: dueEnrollments.length,
      leadExecutions: 0,
      meetingExecutions: 0,
      errors: [] as string[],
    };

    for (const enrollment of dueEnrollments) {
      try {
        if (enrollment.config.type === FollowUpConfigType.LEAD_NO_RESPONSE) {
          await leadFollowUpService.executeStep(enrollment.id);
          results.leadExecutions++;
        } else if (enrollment.config.type === FollowUpConfigType.MEETING_REMINDER) {
          await meetingFollowUpService.executeStep(enrollment.id);
          results.meetingExecutions++;
        }
      } catch (err: any) {
        results.errors.push(
          `Error processing enrollment ${enrollment.id}: ${err.message || String(err)}`,
        );
      }
    }

    return results;
  }
}

export const autoFollowUpService = new AutoFollowUpService();

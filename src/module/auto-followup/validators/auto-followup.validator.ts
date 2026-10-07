import { z } from "zod";
import {
  FollowUpConfigType,
  FollowUpIntervalUnit,
  FollowUpEnrollmentStatus,
  FollowUpExecutionStatus,
  CommunicationChannel,
  MeetingType,
} from "../../../types/types.js";

// ============================================================================
// ZOD ENUMS IMPORTED FROM GENERATED PRISMA CLIENT (Rule 22)
// ============================================================================

export const FollowUpConfigTypeEnum = z.nativeEnum(FollowUpConfigType);
export const FollowUpIntervalUnitEnum = z.nativeEnum(FollowUpIntervalUnit);
export const FollowUpEnrollmentStatusEnum = z.nativeEnum(FollowUpEnrollmentStatus);
export const FollowUpExecutionStatusEnum = z.nativeEnum(FollowUpExecutionStatus);
export const CommunicationChannelEnum = z.nativeEnum(CommunicationChannel);
export const MeetingTypeEnum = z.nativeEnum(MeetingType);

// ============================================================================
// STEP SCHEMAS
// ============================================================================

export const createLeadFollowUpStepSchema = z.object({
  id: z.string().uuid().optional(),
  stepOrder: z.number().int().min(1, "Step order must be at least 1"),
  dayOffset: z.number().int().min(1, "Day offset must be at least 1"),
  channel: CommunicationChannelEnum.optional().default(CommunicationChannel.WHATSAPP),
  templateId: z.string().uuid("Invalid template ID").optional().nullable(),
  customVariables: z.record(z.string(), z.any()).optional().nullable(),
  isFinalStep: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

export const createMeetingFollowUpStepSchema = z.object({
  id: z.string().uuid().optional(),
  stepOrder: z.number().int().min(1, "Step order must be at least 1"),
  intervalUnit: FollowUpIntervalUnitEnum.optional().default(FollowUpIntervalUnit.HOURS_BEFORE),
  intervalValue: z.number().int().min(1, "Interval value must be at least 1"),
  channel: CommunicationChannelEnum.optional().default(CommunicationChannel.WHATSAPP),
  templateId: z.string().uuid("Invalid template ID").optional().nullable(),
  dynamicTimeVariableFormat: z.string().max(200).optional().nullable(),
  customVariables: z.record(z.string(), z.any()).optional().nullable(),
  isActive: z.boolean().optional().default(true),
  additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
});

// ============================================================================
// CONFIG CRUD SCHEMAS
// ============================================================================

export const createFollowUpConfigSchema = z.object({
  body: z.object({
    type: FollowUpConfigTypeEnum,
    name: z.string().min(1, "Configuration name is required").max(150),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional().default(true),
    isDefault: z.boolean().optional().default(false),
    preferredSendTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "preferredSendTime must be in HH:mm format (e.g. 10:00)")
      .optional()
      .default("10:00"),
    meetingTypes: z.array(MeetingTypeEnum).optional().default([]),
    leadSteps: z.array(createLeadFollowUpStepSchema).optional().default([]),
    meetingSteps: z.array(createMeetingFollowUpStepSchema).optional().default([]),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateFollowUpConfigSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid config ID"),
  }),
  body: z.object({
    type: FollowUpConfigTypeEnum.optional(),
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(500).optional().nullable(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    preferredSendTime: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "preferredSendTime must be in HH:mm format (e.g. 10:00)")
      .optional(),
    meetingTypes: z.array(MeetingTypeEnum).optional(),
    leadSteps: z.array(createLeadFollowUpStepSchema).optional(),
    meetingSteps: z.array(createMeetingFollowUpStepSchema).optional(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const getFollowUpConfigByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid config ID"),
  }),
});

export const queryFollowUpConfigsSchema = z.object({
  query: z.object({
    type: FollowUpConfigTypeEnum.optional(),
    isActive: z
      .string()
      .transform((val) => val === "true")
      .optional(),
    search: z.string().optional(),
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional()
      .default(1),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional()
      .default(20),
  }),
});

// ============================================================================
// MANUAL ENROLLMENT & ACTIONS SCHEMAS
// ============================================================================

export const enrollLeadSchema = z.object({
  body: z.object({
    leadId: z.string().uuid("Invalid lead ID"),
    configId: z.string().uuid("Invalid config ID").optional(),
  }),
});

export const enrollMeetingSchema = z.object({
  body: z.object({
    meetingId: z.string().uuid("Invalid meeting ID"),
    configId: z.string().uuid("Invalid config ID").optional(),
  }),
});

export const enrollmentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid enrollment ID"),
  }),
});

export const cancelEnrollmentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid enrollment ID"),
  }),
  body: z.object({
    reason: z.string().min(1, "Cancellation reason is required").max(250),
  }),
});

export const queryEnrollmentsSchema = z.object({
  query: z.object({
    leadId: z.string().uuid().optional(),
    meetingId: z.string().uuid().optional(),
    status: FollowUpEnrollmentStatusEnum.optional(),
    page: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional()
      .default(1),
    limit: z
      .string()
      .transform((val) => parseInt(val, 10))
      .optional()
      .default(20),
  }),
});

export type CreateFollowUpConfigInput = z.infer<typeof createFollowUpConfigSchema>["body"];
export type UpdateFollowUpConfigInput = z.infer<typeof updateFollowUpConfigSchema>["body"];
export type CreateLeadFollowUpStepInput = z.infer<typeof createLeadFollowUpStepSchema>;
export type CreateMeetingFollowUpStepInput = z.infer<typeof createMeetingFollowUpStepSchema>;

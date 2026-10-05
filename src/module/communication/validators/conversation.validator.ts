import { z } from "zod";
import {
  CommunicationChannel,
  ConversationStatus,
  ConversationPriority,
  ConversationHandlingMode,
  MessageDirection,
  MessageContentType,
} from "../../../types/types.js";

// NativeEnum Validators (Rule 22)
export const CommunicationChannelEnum = z.nativeEnum(CommunicationChannel);
export const ConversationStatusEnum = z.nativeEnum(ConversationStatus);
export const ConversationPriorityEnum = z.nativeEnum(ConversationPriority);
export const ConversationHandlingModeEnum = z.nativeEnum(ConversationHandlingMode);
export const MessageDirectionEnum = z.nativeEnum(MessageDirection);
export const MessageContentTypeEnum = z.nativeEnum(MessageContentType);

// Structured Media Schema (Rule 4)
export const StructuredMediaSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  bytes: z.number().nonnegative(),
  format: z.string(),
  provider: z.string(),
});

// Query params for listing conversations
export const GetConversationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  tab: z
    .enum([
      "all",
      "unread",
      "starred",
      "assigned_to_me",
      "open",
      "pending",
      "resolved",
      "archived",
    ])
    .default("all"),
  channel: CommunicationChannelEnum.optional(),
  status: ConversationStatusEnum.optional(),
  priority: ConversationPriorityEnum.optional(),
  handlingMode: ConversationHandlingModeEnum.optional(),
  assignedEmployeeId: z.string().uuid().optional(),
  assignedTeamId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  isStarred: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((val) => (typeof val === "boolean" ? val : val === "true"))
    .optional(),
});

// Query params for fetching message history
export const GetMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
  direction: MessageDirectionEnum.optional(),
  replyChannel: CommunicationChannelEnum.optional(),
  contentType: MessageContentTypeEnum.optional(),
});

// Tri-Mode Reply Schema (WhatsApp, Email, Internal Note)
export const SendReplySchema = z
  .object({
    direction: z
      .nativeEnum(MessageDirection)
      .refine(
        (val) => val === MessageDirection.OUTGOING || val === MessageDirection.INTERNAL,
        { message: "Direction must be OUTGOING (for customer dispatch) or INTERNAL (for private team notes)" },
      ),
    replyChannel: CommunicationChannelEnum.default(CommunicationChannel.WHATSAPP),
    contentType: MessageContentTypeEnum.default(MessageContentType.TEXT),
    content: z.string().trim().default(""),
    media: StructuredMediaSchema.optional().nullable(),
    templateId: z.string().uuid().optional().nullable(),
    templateVariables: z.record(z.string(), z.unknown()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .refine(
    (data) => {
      // Must have either text content, media attachment, or a selected template
      return (
        data.content.length > 0 ||
        data.media !== undefined ||
        data.templateId !== undefined
      );
    },
    { message: "Reply must have at least text content, a media attachment, or a template selected" },
  );

// Outbound Initiating Conversation Schema
export const InitiateOutboundConversationSchema = z.object({
  channel: CommunicationChannelEnum.default(CommunicationChannel.WHATSAPP),
  recipientPhone: z.string().trim().min(7, "Phone number must be at least 7 digits"),
  recipientName: z.string().trim().optional().nullable(),
  recipientEmail: z.string().email().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  assignedEmployeeId: z.string().uuid().optional().nullable(),
  assignedTeamId: z.string().uuid().optional().nullable(),
  initialMessage: z.string().trim().min(1, "Initial message content is required"),
  contentType: MessageContentTypeEnum.default(MessageContentType.TEXT),
  media: StructuredMediaSchema.optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  templateVariables: z.record(z.string(), z.unknown()).optional().nullable(),
  additionalInformation: z.record(z.string(), z.unknown()).optional().nullable(),
});

// Update Status Schema
export const UpdateConversationStatusSchema = z.object({
  status: ConversationStatusEnum,
});

// Update Handling Mode Schema
export const UpdateHandlingModeSchema = z.object({
  handlingMode: ConversationHandlingModeEnum,
});

// Assign Conversation Schema
export const AssignConversationSchema = z.object({
  assignedEmployeeId: z.string().uuid().nullable().optional(),
  assignedTeamId: z.string().uuid().nullable().optional(),
});

// Toggle Starred Schema
export const ToggleStarredSchema = z.object({
  isStarred: z.boolean(),
});

// Toggle Pinned Schema
export const TogglePinnedSchema = z.object({
  isPinned: z.boolean(),
});

// Update Tags Schema
export const UpdateTagsSchema = z.object({
  tags: z.array(z.string().trim().min(1)),
});

// Type inferences
export type GetConversationsQueryInput = z.infer<typeof GetConversationsQuerySchema>;
export type GetMessagesQueryInput = z.infer<typeof GetMessagesQuerySchema>;
export type SendReplyInput = z.infer<typeof SendReplySchema>;
export type InitiateOutboundConversationInput = z.infer<typeof InitiateOutboundConversationSchema>;
export type UpdateConversationStatusInput = z.infer<typeof UpdateConversationStatusSchema>;
export type UpdateHandlingModeInput = z.infer<typeof UpdateHandlingModeSchema>;
export type AssignConversationInput = z.infer<typeof AssignConversationSchema>;
export type ToggleStarredInput = z.infer<typeof ToggleStarredSchema>;
export type TogglePinnedInput = z.infer<typeof TogglePinnedSchema>;
export type UpdateTagsInput = z.infer<typeof UpdateTagsSchema>;

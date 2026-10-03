import { z } from "zod";

/**
 * Clean and normalize phone number:
 * Strips whitespace, dashes, parentheses.
 * Ensures the string contains only digits (with optional leading +).
 */
export const phoneNumberSchema = z
  .string()
  .trim()
  .min(7, "Phone number must be at least 7 digits")
  .max(20, "Phone number cannot exceed 20 characters")
  .refine(
    (val) => /^\+?[1-9]\d{6,18}$/.test(val.replace(/[\s\-\(\)]/g, "")),
    "Invalid phone number format. Provide valid international format with country code (e.g. +919876543210 or 919876543210)"
  )
  .transform((val) => val.replace(/[\s\-\(\)]/g, ""));

/**
 * Schema for Contextual CRM Entities used in dynamic template variable resolution
 */
export const messageVariableContextSchema = z
  .object({
    leadId: z.string().uuid("leadId must be a valid UUID").optional().nullable(),
    customerId: z.string().uuid("customerId must be a valid UUID").optional().nullable(),
    projectId: z.string().uuid("projectId must be a valid UUID").optional().nullable(),
    quotationId: z.string().uuid("quotationId must be a valid UUID").optional().nullable(),
    meetingId: z.string().uuid("meetingId must be a valid UUID").optional().nullable(),
    employeeId: z.string().uuid("employeeId must be a valid UUID").optional().nullable(),
    recipientPhone: z.string().optional().nullable(),
    recipientName: z.string().optional().nullable(),
    customOverrides: z.record(z.string(), z.string()).optional(),
  })
  .optional();

/**
 * Validation schema for SENDING WHATSAPP TEMPLATE MESSAGE (POST /messages/template)
 */
export const sendWhatsAppTemplateMessageSchema = z.object({
  body: z
    .object({
      to: phoneNumberSchema,
      templateId: z.string().uuid("templateId must be a valid UUID").optional(),
      templateName: z
        .string()
        .regex(/^[a-z0-9_]+$/, "Template name must be lowercase alphanumeric with underscores")
        .optional(),
      language: z.string().min(2).max(10).optional(),
      mediaUrl: z.string().url("mediaUrl must be a valid URL").optional().nullable(),
      context: messageVariableContextSchema,
    })
    .refine((data) => Boolean(data.templateId || data.templateName), {
      message: "Either 'templateId' or 'templateName' must be provided to send a template message",
      path: ["templateId"],
    }),
});

export type SendWhatsAppTemplateMessageDto = z.infer<
  typeof sendWhatsAppTemplateMessageSchema
>["body"];

/**
 * Validation schema for SENDING WHATSAPP CUSTOM DIRECT MESSAGE (POST /messages/custom)
 */
export const sendWhatsAppCustomMessageSchema = z.object({
  body: z
    .object({
      to: phoneNumberSchema,
      messageType: z.enum(["text", "image", "video", "document"]).default("text"),
      text: z.string().max(4096, "Message text cannot exceed 4096 characters").optional(),
      mediaUrl: z.string().url("mediaUrl must be a valid URL").optional(),
      caption: z.string().max(1024, "Caption cannot exceed 1024 characters").optional(),
      previewUrl: z.boolean().default(true).optional(),
    })
    .refine(
      (data) => {
        if (data.messageType === "text") {
          return Boolean(data.text && data.text.trim().length > 0);
        }
        return Boolean(data.mediaUrl);
      },
      {
        message: "Field 'text' is required for text messages, and 'mediaUrl' is required for media messages",
      }
    ),
});

export type SendWhatsAppCustomMessageDto = z.infer<
  typeof sendWhatsAppCustomMessageSchema
>["body"];

import { z } from "zod";

/**
 * Validation schema for saving / upserting organization WhatsApp credentials
 */
export const saveWhatsAppIntegrationSchema = z.object({
  body: z.object({
    appId: z.string().trim().min(1, "Meta App ID cannot be empty"),
    appSecret: z.string().trim().min(1, "App Secret cannot be empty"),
    accountId: z.string().trim().min(1, "WhatsApp Business Account ID (WABA ID) cannot be empty"),
    phoneNumberId: z.string().trim().min(1, "Phone Number ID cannot be empty"),
    displayPhoneNumber: z.string().trim().min(1, "Display Phone Number cannot be empty"),
    accessToken: z.string().trim().min(1, "Access Token cannot be empty"),
    webhookVerifyToken: z.string().trim().min(1, "Webhook Verify Token cannot be empty"),
  }),
});

/**
 * Type definition for save WhatsApp integration payload
 */
export type SaveWhatsAppIntegrationDto = z.infer<typeof saveWhatsAppIntegrationSchema>["body"];

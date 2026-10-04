/**
 * Meta WhatsApp Cloud API Webhook Type Definitions
 */

export interface WhatsAppWebhookVerificationQuery {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
  mode?: string;
  verify_token?: string;
  challenge?: string;
  [key: string]: string | undefined;
}

export type MetaWebhookMessageType =
  | "text"
  | "image"
  | "video"
  | "document"
  | "audio"
  | "voice"
  | "location"
  | "contacts"
  | "button"
  | "interactive"
  | "sticker"
  | "order"
  | "system"
  | "unknown";

export interface MetaWebhookProfile {
  name?: string;
}

export interface MetaWebhookContact {
  profile?: MetaWebhookProfile;
  wa_id: string;
}

export interface MetaWebhookTextMessage {
  body: string;
}

export interface MetaWebhookMediaMessage {
  id: string;
  mime_type?: string;
  sha256?: string;
  caption?: string;
  filename?: string;
}

export interface MetaWebhookLocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MetaWebhookButtonMessage {
  text?: string;
  payload?: string;
}

export interface MetaWebhookInteractiveMessage {
  type?: "button_reply" | "list_reply";
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface MetaWebhookSharedContact {
  name?: {
    first_name?: string;
    last_name?: string;
    formatted_name?: string;
  };
  phones?: Array<{
    phone?: string;
    wa_id?: string;
    type?: string;
  }>;
}

export interface MetaWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: MetaWebhookMessageType;
  text?: MetaWebhookTextMessage;
  image?: MetaWebhookMediaMessage;
  video?: MetaWebhookMediaMessage;
  document?: MetaWebhookMediaMessage;
  audio?: MetaWebhookMediaMessage;
  voice?: MetaWebhookMediaMessage;
  location?: MetaWebhookLocationMessage;
  contacts?: MetaWebhookSharedContact[];
  button?: MetaWebhookButtonMessage;
  interactive?: MetaWebhookInteractiveMessage;
  context?: {
    forwarded?: boolean;
    frequently_forwarded?: boolean;
    from?: string;
    id?: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
}

export type MetaWebhookDeliveryStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "deleted";

export interface MetaWebhookStatus {
  id: string;
  status: MetaWebhookDeliveryStatus;
  timestamp: string;
  recipient_id: string;
  conversation?: {
    id: string;
    origin?: {
      type: string;
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricing_model: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
}

export interface MetaWebhookMetadata {
  display_phone_number?: string;
  phone_number_id?: string;
}

export interface MetaWebhookValue {
  messaging_product: "whatsapp";
  metadata?: MetaWebhookMetadata;
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: "messages" | string;
}

export interface MetaWebhookEntry {
  id: string; // WhatsApp Business Account ID (WABA ID)
  changes: MetaWebhookChange[];
}

export interface MetaWhatsAppWebhookPayload {
  object: "whatsapp_business_account" | string;
  entry?: MetaWebhookEntry[];
}

export interface IncomingMessageProcessingParams {
  organizationId: string;
  message: MetaWebhookMessage;
  contacts: MetaWebhookContact[];
  phoneNumberId?: string;
  displayPhoneNumber?: string;
}

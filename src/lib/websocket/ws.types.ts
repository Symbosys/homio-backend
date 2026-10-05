/**
 * WebSocket Real-Time Event & Payload Types for Homio CRM Omnichannel Inbox
 */

export enum WebSocketEventType {
  // Connection & Room Management
  SUBSCRIBE_CONVERSATION = "SUBSCRIBE_CONVERSATION",
  UNSUBSCRIBE_CONVERSATION = "UNSUBSCRIBE_CONVERSATION",
  PING = "PING",
  PONG = "PONG",

  // Real-Time Chat & Message Lifecycle Events
  MESSAGE_RECEIVED = "MESSAGE_RECEIVED",
  MESSAGE_SENT = "MESSAGE_SENT",
  NOTE_ADDED = "NOTE_ADDED",
  MESSAGE_STATUS_UPDATED = "MESSAGE_STATUS_UPDATED",

  // Conversation State Transitions
  CONVERSATION_CREATED = "CONVERSATION_CREATED",
  CONVERSATION_UPDATED = "CONVERSATION_UPDATED",
  CONVERSATION_ASSIGNED = "CONVERSATION_ASSIGNED",
  CONVERSATION_READ = "CONVERSATION_READ",

  // Live Agent Presence & Typing Indicators
  TYPING_START = "TYPING_START",
  TYPING_STOP = "TYPING_STOP",
  AGENT_ONLINE = "AGENT_ONLINE",
  AGENT_OFFLINE = "AGENT_OFFLINE",
}

export interface WebSocketClientSession {
  userId: string;
  email: string;
  organizationId: string;
  firstName: string;
  lastName?: string | null;
  rooms: Set<string>;
}

export interface WebSocketMessagePayload<T = unknown> {
  event: WebSocketEventType | string;
  timestamp: string;
  organizationId?: string;
  conversationId?: string;
  data: T;
}

export interface ClientInboundMessage {
  event: WebSocketEventType | string;
  conversationId?: string;
  data?: Record<string, unknown>;
}

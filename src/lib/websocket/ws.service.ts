import type { Server as HttpServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { ENV } from "../../config/env.js";
import { prisma } from "../prisma.js";
import {
  WebSocketEventType,
  type WebSocketClientSession,
  type WebSocketMessagePayload,
  type ClientInboundMessage,
} from "./ws.types.js";
import type { JwtUserPayload } from "../../middlewares/auth.middleware.js";

interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  session?: WebSocketClientSession;
}

/**
 * Real-Time WebSocket Service for Homio CRM
 * Powers real-time live inbox message synchronization, delivery receipt updates,
 * presence indicators, and omnichannel conversation state propagation across tenants.
 */
export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Initializes the WebSocket server attached to the Node/Bun HTTP server
   * @param server The active Node/Bun HTTP server instance
   */
  init(server: HttpServer): void {
    if (this.wss) {
      console.log("[WebSocket] Server already initialized.");
      return;
    }

    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      clientTracking: true,
      maxPayload: 1024 * 1024, // 1MB max payload
    });

    this.wss.on("connection", async (ws: WebSocket, req) => {
      const extWs = ws as ExtendedWebSocket;
      extWs.isAlive = true;

      extWs.on("pong", () => {
        extWs.isAlive = true;
      });

      try {
        // 1. Authenticate connection via query parameter ?token=<jwt> or Authorization header
        const url = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
        const token =
          url.searchParams.get("token") ||
          req.headers.authorization?.replace(/^Bearer\s+/i, "");

        if (!token) {
          extWs.close(4001, "Authentication token required");
          return;
        }

        if (!ENV.JWT_SECRET) {
          extWs.close(4500, "Server JWT configuration missing");
          return;
        }

        const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtUserPayload;
        if (!decoded?.userId) {
          extWs.close(4001, "Invalid authentication token");
          return;
        }

        // 2. Fetch user details and active organization context
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            organizationId: true,
            status: true,
            isDeleted: true,
          },
        });

        if (!user || user.isDeleted || user.status !== "ACTIVE" || !user.organizationId) {
          extWs.close(4003, "Account not authorized or inactive");
          return;
        }

        const session: WebSocketClientSession = {
          userId: user.id,
          email: user.email,
          organizationId: user.organizationId,
          firstName: user.firstName,
          lastName: user.lastName,
          rooms: new Set<string>([
            `org:${user.organizationId}`,
            `user:${user.id}`,
          ]),
        };

        extWs.session = session;

        console.log(
          `[WebSocket] Client connected: User "${user.email}" (${user.id}) | Org: "${user.organizationId}"`,
        );

        // 3. Send initial connected acknowledgment
        this.sendToSocket(extWs, {
          event: "CONNECTED",
          timestamp: new Date().toISOString(),
          organizationId: session.organizationId,
          data: {
            userId: session.userId,
            email: session.email,
            organizationId: session.organizationId,
            message: "Connected to Homio CRM Real-Time Engine",
          },
        });

        // 4. Handle inbound client messages (Room subscriptions, Typing indicators, Heartbeat)
        extWs.on("message", (rawMessage: string) => {
          this.handleClientMessage(extWs, rawMessage);
        });

        extWs.on("close", (code, reason) => {
          console.log(
            `[WebSocket] Client disconnected: User "${session.email}" (Code: ${code}, Reason: ${reason.toString()})`,
          );
        });

        extWs.on("error", (err) => {
          console.error(`[WebSocket] Client socket error (${session.email}):`, err.message);
        });
      } catch (err: any) {
        console.error("[WebSocket] Connection authentication error:", err.message);
        extWs.close(4001, "Authentication failed");
      }
    });

    // Setup heartbeat interval to detect stale/dead connections
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws) => {
        const extWs = ws as ExtendedWebSocket;
        if (!extWs.isAlive) {
          console.log("[WebSocket] Terminating inactive stale socket connection");
          return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30000);

    console.log("[WebSocket] Real-Time WebSocket Server initialized on endpoint /ws");
  }

  /**
   * Internal processor for inbound client messages (room joins, typing indicators)
   */
  private handleClientMessage(ws: ExtendedWebSocket, rawMessage: string): void {
    if (!ws.session) return;

    try {
      const payload = JSON.parse(rawMessage.toString()) as ClientInboundMessage;
      const { event, conversationId, data } = payload;

      switch (event) {
        case WebSocketEventType.SUBSCRIBE_CONVERSATION:
        case "SUBSCRIBE_CONVERSATION":
          if (conversationId) {
            ws.session.rooms.add(`conv:${conversationId}`);
            this.sendToSocket(ws, {
              event: "SUBSCRIBED_CONVERSATION",
              timestamp: new Date().toISOString(),
              conversationId,
              organizationId: ws.session.organizationId,
              data: { conversationId, success: true },
            });
          }
          break;

        case WebSocketEventType.UNSUBSCRIBE_CONVERSATION:
        case "UNSUBSCRIBE_CONVERSATION":
          if (conversationId) {
            ws.session.rooms.delete(`conv:${conversationId}`);
            this.sendToSocket(ws, {
              event: "UNSUBSCRIBED_CONVERSATION",
              timestamp: new Date().toISOString(),
              conversationId,
              organizationId: ws.session.organizationId,
              data: { conversationId, success: true },
            });
          }
          break;

        case WebSocketEventType.TYPING_START:
        case "TYPING_START":
          if (conversationId) {
            this.broadcastToConversation(
              conversationId,
              WebSocketEventType.TYPING_START,
              {
                conversationId,
                userId: ws.session.userId,
                userName: `${ws.session.firstName} ${ws.session.lastName || ""}`.trim(),
              },
              ws.session.userId, // Exclude sender
            );
          }
          break;

        case WebSocketEventType.TYPING_STOP:
        case "TYPING_STOP":
          if (conversationId) {
            this.broadcastToConversation(
              conversationId,
              WebSocketEventType.TYPING_STOP,
              {
                conversationId,
                userId: ws.session.userId,
              },
              ws.session.userId, // Exclude sender
            );
          }
          break;

        case WebSocketEventType.PING:
        case "PING":
          this.sendToSocket(ws, {
            event: WebSocketEventType.PONG,
            timestamp: new Date().toISOString(),
            data: { pong: true },
          });
          break;

        default:
          break;
      }
    } catch {
      // Ignore invalid JSON payloads from client
    }
  }

  /**
   * Broadcast an event to all connected sockets in a specific organization (Tenant Isolation)
   * @param organizationId Tenant organization UUID
   * @param event Event identifier
   * @param data Payload data
   * @param excludeUserId Optional user ID to exclude from broadcast (e.g. sender)
   */
  broadcastToOrganization<T = unknown>(
    organizationId: string,
    event: WebSocketEventType | string,
    data: T,
    excludeUserId?: string,
  ): void {
    if (!this.wss) return;

    const payload: WebSocketMessagePayload<T> = {
      event,
      timestamp: new Date().toISOString(),
      organizationId,
      conversationId: (data as any)?.conversationId,
      data,
    };

    const targetRoom = `org:${organizationId}`;
    const stringified = JSON.stringify(payload);

    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (
        extWs.readyState === WebSocket.OPEN &&
        extWs.session &&
        extWs.session.rooms.has(targetRoom) &&
        (!excludeUserId || extWs.session.userId !== excludeUserId)
      ) {
        extWs.send(stringified);
      }
    });
  }

  /**
   * Broadcast an event to all sockets currently viewing/subscribed to a specific conversation thread
   * @param conversationId Conversation UUID
   * @param event Event identifier
   * @param data Payload data
   * @param excludeUserId Optional user ID to exclude
   */
  broadcastToConversation<T = unknown>(
    conversationId: string,
    event: WebSocketEventType | string,
    data: T,
    excludeUserId?: string,
  ): void {
    if (!this.wss) return;

    const payload: WebSocketMessagePayload<T> = {
      event,
      timestamp: new Date().toISOString(),
      conversationId,
      data,
    };

    const targetRoom = `conv:${conversationId}`;
    const stringified = JSON.stringify(payload);

    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (
        extWs.readyState === WebSocket.OPEN &&
        extWs.session &&
        extWs.session.rooms.has(targetRoom) &&
        (!excludeUserId || extWs.session.userId !== excludeUserId)
      ) {
        extWs.send(stringified);
      }
    });
  }

  /**
   * Broadcast an event directly to a specific user across all their open device tabs
   * @param userId User UUID
   * @param event Event identifier
   * @param data Payload data
   */
  broadcastToUser<T = unknown>(
    userId: string,
    event: WebSocketEventType | string,
    data: T,
  ): void {
    if (!this.wss) return;

    const payload: WebSocketMessagePayload<T> = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };

    const targetRoom = `user:${userId}`;
    const stringified = JSON.stringify(payload);

    this.wss.clients.forEach((client) => {
      const extWs = client as ExtendedWebSocket;
      if (
        extWs.readyState === WebSocket.OPEN &&
        extWs.session &&
        extWs.session.rooms.has(targetRoom)
      ) {
        extWs.send(stringified);
      }
    });
  }

  /**
   * Safely send payload to a single WebSocket client
   */
  private sendToSocket(ws: ExtendedWebSocket, payload: WebSocketMessagePayload): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Gracefully close WebSocket server during application shutdown
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.wss) {
      this.wss.close(() => {
        console.log("[WebSocket] WebSocket Server successfully closed.");
      });
      this.wss = null;
    }
  }
}

export const wsService = new WebSocketService();

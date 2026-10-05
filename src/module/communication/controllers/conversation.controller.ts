import type { Request, Response, NextFunction } from "express";
import { conversationService } from "../services/conversation.service.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import {
  GetConversationsQuerySchema,
  GetMessagesQuerySchema,
  SendReplySchema,
  InitiateOutboundConversationSchema,
  UpdateConversationStatusSchema,
  UpdateHandlingModeSchema,
  AssignConversationSchema,
  ToggleStarredSchema,
  TogglePinnedSchema,
  UpdateTagsSchema,
} from "../validators/conversation.validator.js";

/**
 * Controller handling REST API endpoints for Omnichannel Conversations,
 * Tri-Mode Replies (WhatsApp, Email, Internal Notes), and Inbox Management.
 */
export class ConversationController {
  /**
   * @route   GET /api/v1/communication/conversations
   * @desc    List paginated conversations with tab presets, search, channel & status filters
   * @access  Private (Tenant User / Admin)
   */
  async listConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const query = GetConversationsQuerySchema.parse(req.query);

      const result = await conversationService.listConversations(
        organizationId,
        query,
        req.user?.id,
      );

      return SuccessResponse(
        res,
        "Conversations fetched successfully",
        result,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/v1/communication/conversations/analytics
   * @desc    Get aggregated KPI metrics for inbox header ribbon
   * @access  Private (Tenant User / Admin)
   */
  async getAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const analytics = await conversationService.getInboxAnalytics(organizationId);

      return SuccessResponse(
        res,
        "Inbox analytics fetched successfully",
        analytics,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/v1/communication/conversations/outbound
   * @desc    Initiate a new outbound conversation thread to a customer/lead
   * @access  Private (Tenant User / Admin)
   */
  async initiateOutbound(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const input = InitiateOutboundConversationSchema.parse(req.body);

      const result = await conversationService.initiateOutboundConversation(
        organizationId,
        req.user!,
        input,
      );

      return SuccessResponse(
        res,
        "Outbound conversation initiated successfully",
        result,
        statusCode.Created,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/v1/communication/conversations/:id
   * @desc    Get detailed conversation thread with full CRM 360° linkages & audit trail
   * @access  Private (Tenant User / Admin)
   */
  async getConversationById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const conversation = await conversationService.getConversationDetails(
        id,
        organizationId,
      );

      return SuccessResponse(
        res,
        "Conversation details retrieved successfully",
        conversation,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   GET /api/v1/communication/conversations/:id/messages
   * @desc    Get chronological message history for a conversation thread
   * @access  Private (Tenant User / Admin)
   */
  async getMessages(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const query = GetMessagesQuerySchema.parse(req.query);
      const messages = await conversationService.getMessages(
        id,
        organizationId,
        query,
      );

      return SuccessResponse(
        res,
        "Messages fetched successfully",
        messages,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   POST /api/v1/communication/conversations/:id/reply
   * @desc    Send a tri-mode reply (WhatsApp live dispatch, Email dispatch, or Private Internal Note)
   * @access  Private (Tenant User / Admin)
   */
  async sendReply(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = SendReplySchema.parse(req.body);
      const message = await conversationService.sendReply(
        id,
        organizationId,
        req.user!,
        input,
      );

      return SuccessResponse(
        res,
        input.direction === "INTERNAL"
          ? "Internal team note added successfully"
          : "Reply dispatched successfully",
        message,
        statusCode.Created,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/status
   * @desc    Update conversation status (OPEN, PENDING, RESOLVED, ARCHIVED)
   * @access  Private (Tenant User / Admin)
   */
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = UpdateConversationStatusSchema.parse(req.body);
      const updated = await conversationService.updateStatus(
        id,
        organizationId,
        req.user!,
        input.status,
      );

      return SuccessResponse(
        res,
        `Conversation status updated to ${input.status}`,
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/handling-mode
   * @desc    Switch conversation handling mode (MANUAL_HUMAN, AI_AUTONOMOUS, AI_COPILOT)
   * @access  Private (Tenant User / Admin)
   */
  async updateHandlingMode(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = UpdateHandlingModeSchema.parse(req.body);
      const updated = await conversationService.updateHandlingMode(
        id,
        organizationId,
        req.user!,
        input.handlingMode,
      );

      return SuccessResponse(
        res,
        `Conversation handling mode set to ${input.handlingMode}`,
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/assign
   * @desc    Assign conversation to an Employee and/or Team
   * @access  Private (Tenant User / Admin)
   */
  async assignConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = AssignConversationSchema.parse(req.body);
      const updated = await conversationService.assignConversation(
        id,
        organizationId,
        req.user!,
        input,
      );

      return SuccessResponse(
        res,
        "Conversation assigned successfully",
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/star
   * @desc    Toggle starred/favorite flag for a conversation
   * @access  Private (Tenant User / Admin)
   */
  async toggleStarred(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = ToggleStarredSchema.parse(req.body);
      const updated = await conversationService.toggleStarred(
        id,
        organizationId,
        input.isStarred,
      );

      return SuccessResponse(
        res,
        input.isStarred ? "Conversation starred" : "Conversation unstarred",
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/pin
   * @desc    Toggle pinned state for a conversation
   * @access  Private (Tenant User / Admin)
   */
  async togglePinned(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = TogglePinnedSchema.parse(req.body);
      const updated = await conversationService.togglePinned(
        id,
        organizationId,
        input.isPinned,
      );

      return SuccessResponse(
        res,
        input.isPinned ? "Conversation pinned" : "Conversation unpinned",
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/read
   * @desc    Mark conversation messages as read (clears unread badge counter)
   * @access  Private (Tenant User / Admin)
   */
  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const updated = await conversationService.markAsRead(id, organizationId);

      return SuccessResponse(
        res,
        "Conversation marked as read",
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route   PATCH /api/v1/communication/conversations/:id/tags
   * @desc    Update conversation tags
   * @access  Private (Tenant User / Admin)
   */
  async updateTags(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId!;
      const id = (Array.isArray(req.params.id) ? req.params.id[0] : req.params.id) as string;

      if (!id) {
        throw new ErrorResponse("Conversation ID is required", statusCode.Bad_Request);
      }

      const input = UpdateTagsSchema.parse(req.body);
      const updated = await conversationService.updateTags(
        id,
        organizationId,
        input.tags,
      );

      return SuccessResponse(
        res,
        "Conversation tags updated successfully",
        updated,
        statusCode.OK,
      );
    } catch (error) {
      next(error);
    }
  }
}

export const conversationController = new ConversationController();

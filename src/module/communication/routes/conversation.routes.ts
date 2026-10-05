import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller.js";
import { authenticate } from "../../../middlewares/auth.middleware.js";

const router = Router();

// Protect all conversation routes with JWT authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/communication/conversations
 * @desc    List paginated conversations with tab presets, search, channel & status filters
 */
router.get("/", (req, res, next) =>
  conversationController.listConversations(req, res, next),
);

/**
 * @route   GET /api/v1/communication/conversations/analytics
 * @desc    Get aggregated KPI metrics for inbox header ribbon
 */
router.get("/analytics", (req, res, next) =>
  conversationController.getAnalytics(req, res, next),
);

/**
 * @route   POST /api/v1/communication/conversations/outbound
 * @desc    Initiate a new outbound conversation thread to a customer/lead
 */
router.post("/outbound", (req, res, next) =>
  conversationController.initiateOutbound(req, res, next),
);

/**
 * @route   GET /api/v1/communication/conversations/:id
 * @desc    Get single detailed conversation thread
 */
router.get("/:id", (req, res, next) =>
  conversationController.getConversationById(req, res, next),
);

/**
 * @route   GET /api/v1/communication/conversations/:id/messages
 * @desc    Get chronological message history for a conversation thread
 */
router.get("/:id/messages", (req, res, next) =>
  conversationController.getMessages(req, res, next),
);

/**
 * @route   POST /api/v1/communication/conversations/:id/reply
 * @desc    Send a tri-mode reply (WhatsApp live dispatch, Email dispatch, or Private Internal Note)
 */
router.post("/:id/reply", (req, res, next) =>
  conversationController.sendReply(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/status
 * @desc    Update conversation status (OPEN, PENDING, RESOLVED, ARCHIVED)
 */
router.patch("/:id/status", (req, res, next) =>
  conversationController.updateStatus(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/handling-mode
 * @desc    Switch conversation handling mode (MANUAL_HUMAN, AI_AUTONOMOUS, AI_COPILOT)
 */
router.patch("/:id/handling-mode", (req, res, next) =>
  conversationController.updateHandlingMode(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/assign
 * @desc    Assign conversation to an Employee and/or Team
 */
router.patch("/:id/assign", (req, res, next) =>
  conversationController.assignConversation(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/star
 * @desc    Toggle starred/favorite flag for a conversation
 */
router.patch("/:id/star", (req, res, next) =>
  conversationController.toggleStarred(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/pin
 * @desc    Toggle pinned state for a conversation
 */
router.patch("/:id/pin", (req, res, next) =>
  conversationController.togglePinned(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/read
 * @desc    Mark conversation messages as read (clears unread badge counter)
 */
router.patch("/:id/read", (req, res, next) =>
  conversationController.markAsRead(req, res, next),
);

/**
 * @route   PATCH /api/v1/communication/conversations/:id/tags
 * @desc    Update conversation tags
 */
router.patch("/:id/tags", (req, res, next) =>
  conversationController.updateTags(req, res, next),
);

export default router;

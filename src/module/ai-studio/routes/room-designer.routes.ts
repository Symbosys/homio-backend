import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getRoomDesignerRate,
  generateRoomDesign,
  listRoomDesignSessions,
  getRoomDesignSession,
  updateRoomDesignSession,
  deleteRoomDesignSession,
} from "../controllers/room-designer.controller.js";

export const roomDesignerRouter = Router();

// Enforce authentication across all Room Designer endpoints
roomDesignerRouter.use(authenticate);

/**
 * @route   GET /api/v1/ai-studio/room-designer/rate
 * @desc    Get active credit deduction rate per room render
 */
roomDesignerRouter.get("/rate", getRoomDesignerRate);

/**
 * @route   POST /api/v1/ai-studio/room-designer/generate
 * @desc    Generate room design render using LangChain & OpenAI DALL-E, deduct credits
 */
roomDesignerRouter.post("/generate", generateRoomDesign);

/**
 * @route   GET /api/v1/ai-studio/room-designer/sessions
 * @desc    List past room design renders for the caller organization
 */
roomDesignerRouter.get("/sessions", listRoomDesignSessions);

/**
 * @route   GET /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @desc    Get details and asset URLs of a specific room design render
 */
roomDesignerRouter.get("/sessions/:sessionId", getRoomDesignSession);

/**
 * @route   PATCH /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @desc    Update room design metadata
 */
roomDesignerRouter.patch("/sessions/:sessionId", updateRoomDesignSession);

/**
 * @route   DELETE /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @desc    Delete room design session and cleanup cloud media assets
 */
roomDesignerRouter.delete("/sessions/:sessionId", deleteRoomDesignSession);

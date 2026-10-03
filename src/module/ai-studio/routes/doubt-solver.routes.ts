import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getDoubtSolverRate,
  createDoubtSolverSession,
  listDoubtSolverSessions,
  getDoubtSolverSession,
  askDoubtSolverQuestion,
  rateDoubtSolverMessage,
  updateDoubtSolverSession,
  deleteDoubtSolverSession,
} from "../controllers/doubt-solver.controller.js";

export const doubtSolverRouter = Router();

// Enforce authentication across all Doubt Solver endpoints
doubtSolverRouter.use(authenticate);

/**
 * @route   GET /api/v1/ai-studio/doubt-solver/rate
 * @desc    Get active credit deduction rate per question
 */
doubtSolverRouter.get("/rate", getDoubtSolverRate);

/**
 * @route   POST /api/v1/ai-studio/doubt-solver/sessions
 * @desc    Create new doubt solver consultation session
 */
doubtSolverRouter.post("/sessions", createDoubtSolverSession);

/**
 * @route   GET /api/v1/ai-studio/doubt-solver/sessions
 * @desc    List past doubt solver consultation threads
 */
doubtSolverRouter.get("/sessions", listDoubtSolverSessions);

/**
 * @route   GET /api/v1/ai-studio/doubt-solver/sessions/:sessionId
 * @desc    Get session details and complete chat message history
 */
doubtSolverRouter.get("/sessions/:sessionId", getDoubtSolverSession);

/**
 * @route   POST /api/v1/ai-studio/doubt-solver/sessions/:sessionId/messages
 * @desc    Ask a question in an existing thread, invoke LangChain, and deduct credits
 */
doubtSolverRouter.post("/sessions/:sessionId/messages", askDoubtSolverQuestion);

/**
 * @route   POST /api/v1/ai-studio/doubt-solver/messages/:messageId/rate
 * @desc    Submit feedback rating (1 or 5) for an AI response
 */
doubtSolverRouter.post("/messages/:messageId/rate", rateDoubtSolverMessage);

/**
 * @route   PATCH /api/v1/ai-studio/doubt-solver/sessions/:sessionId
 * @desc    Update consultation thread title or category
 */
doubtSolverRouter.patch("/sessions/:sessionId", updateDoubtSolverSession);

/**
 * @route   DELETE /api/v1/ai-studio/doubt-solver/sessions/:sessionId
 * @desc    Delete consultation thread and message history
 */
doubtSolverRouter.delete("/sessions/:sessionId", deleteDoubtSolverSession);

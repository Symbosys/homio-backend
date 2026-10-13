import type { Request, Response, NextFunction } from "express";
import { DoubtSolverService } from "../services/doubt-solver.service.js";
import { statusCode } from "../../../types/types.js";
import { resolveAiTargetUser } from "../utils/ai-auth.util.js";
import {
  CreateDoubtSolverSessionSchema,
  AskDoubtSolverQuestionSchema,
  RateDoubtSolverMessageSchema,
  UpdateDoubtSolverSessionSchema,
  QueryDoubtSolverSessionsSchema,
} from "../validators/doubt-solver.validator.js";

const service = new DoubtSolverService();

/**
 * @controller  getDoubtSolverRate
 * @desc        Retrieve active per-question credit rate for Doubt Solver
 * @route       GET /api/v1/ai-studio/doubt-solver/rate
 * @access      Authenticated Users
 */
export async function getDoubtSolverRate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cost = await service.getPerQuestionCost();
    return res.status(statusCode.OK).json({
      success: true,
      data: {
        creditCost: cost,
        billingUnit: "per question asked",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  createDoubtSolverSession
 * @desc        Create a new consultation session thread
 * @route       POST /api/v1/ai-studio/doubt-solver/sessions
 * @access      Authenticated Users (Clients, Org Admins, and Employees)
 */
export async function createDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const validatedInput = CreateDoubtSolverSessionSchema.parse(req.body);
    const { targetUserId, actorUserId, actorEmployeeId } =
      await resolveAiTargetUser(req.user, validatedInput.orgUserId);

    const result = await service.createSession({
      userId: targetUserId,
      createdById: actorUserId,
      employeeId: actorEmployeeId,
      input: validatedInput,
    });

    return res.status(statusCode.Created).json({
      success: true,
      message: "Doubt Solver session created successfully",
      data: result,
    });
  } catch (error: any) {
    if (error?.code === "INSUFFICIENT_CREDITS" || error?.statusCode === 402) {
      return res.status(402).json({
        success: false,
        code: "INSUFFICIENT_CREDITS",
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @controller  listDoubtSolverSessions
 * @desc        List paginated consultation session history for the user / organization
 * @route       GET /api/v1/ai-studio/doubt-solver/sessions
 * @access      Authenticated Users
 */
export async function listDoubtSolverSessions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const query = QueryDoubtSolverSessionsSchema.parse(req.query);
    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      query.orgUserId
    );

    const result = await service.listSessions(targetUserId, query);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Sessions retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getDoubtSolverSession
 * @desc        Retrieve single consultation session with full chat history
 * @route       GET /api/v1/ai-studio/doubt-solver/sessions/:sessionId
 * @access      Authenticated Users
 */
export async function getDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const sessionId = (req.params.sessionId || "") as string;
    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      req.query.orgUserId as string | undefined
    );

    const session = await service.getSessionById(sessionId, targetUserId);

    return res.status(statusCode.OK).json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return res.status(statusCode.Not_Found).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @controller  askDoubtSolverQuestion
 * @desc        Post a question to the AI Doubt Solver, invoke LangChain and atomically deduct credits
 * @route       POST /api/v1/ai-studio/doubt-solver/sessions/:sessionId/messages
 * @access      Authenticated Users
 */
export async function askDoubtSolverQuestion(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const sessionId = (req.params.sessionId || "") as string;
    const validatedInput = AskDoubtSolverQuestionSchema.parse(req.body);
    const { targetUserId, actorEmployeeId } = await resolveAiTargetUser(
      req.user,
      validatedInput.orgUserId
    );

    const result = await service.askQuestion({
      sessionId,
      userId: targetUserId,
      employeeId: actorEmployeeId,
      input: validatedInput,
    });

    return res.status(statusCode.OK).json({
      success: true,
      message: "AI response generated successfully",
      data: result,
    });
  } catch (error: any) {
    if (error?.code === "INSUFFICIENT_CREDITS" || error?.statusCode === 402) {
      return res.status(402).json({
        success: false,
        code: "INSUFFICIENT_CREDITS",
        message: error.message,
      });
    }
    if (error?.statusCode === 404) {
      return res.status(statusCode.Not_Found).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @controller  rateDoubtSolverMessage
 * @desc        Rate helpfulness of an AI response (1 or 5)
 * @route       POST /api/v1/ai-studio/doubt-solver/messages/:messageId/rate
 * @access      Authenticated Users
 */
export async function rateDoubtSolverMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const messageId = (req.params.messageId || "") as string;
    const validatedInput = RateDoubtSolverMessageSchema.parse(req.body);
    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      validatedInput.orgUserId || (req.query.orgUserId as string | undefined)
    );

    const result = await service.rateMessage(
      messageId,
      validatedInput.rating,
      targetUserId
    );

    return res.status(statusCode.OK).json({
      success: true,
      message: "Rating submitted successfully",
      data: result,
    });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return res.status(statusCode.Not_Found).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @controller  updateDoubtSolverSession
 * @desc        Update session title or attributes
 * @route       PATCH /api/v1/ai-studio/doubt-solver/sessions/:sessionId
 * @access      Authenticated Users
 */
export async function updateDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const sessionId = (req.params.sessionId || "") as string;
    const input = UpdateDoubtSolverSessionSchema.parse(req.body);
    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      input.orgUserId || (req.query.orgUserId as string | undefined)
    );

    const result = await service.updateSession(
      sessionId,
      targetUserId,
      input
    );

    return res.status(statusCode.OK).json({
      success: true,
      message: "Session updated successfully",
      data: result,
    });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return res.status(statusCode.Not_Found).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @controller  deleteDoubtSolverSession
 * @desc        Delete consultation session and all associated messages
 * @route       DELETE /api/v1/ai-studio/doubt-solver/sessions/:sessionId
 * @access      Authenticated Users
 */
export async function deleteDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const sessionId = (req.params.sessionId || "") as string;
    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      req.query.orgUserId as string | undefined
    );

    await service.deleteSession(sessionId, targetUserId);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error: any) {
    if (error?.statusCode === 404) {
      return res.status(statusCode.Not_Found).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}


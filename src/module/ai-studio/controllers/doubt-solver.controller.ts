import type { Request, Response, NextFunction } from "express";
import { DoubtSolverService } from "../services/doubt-solver.service.js";
import { statusCode } from "../../../types/types.js";
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
 * @access      Authenticated Organization Users
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
 * @access      Authenticated Organization Users
 */
export async function createDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    const employeeId = (req.user as any)?.employeeId || null;

    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const validatedInput = CreateDoubtSolverSessionSchema.parse(req.body);
    const result = await service.createSession(
      organizationId,
      employeeId,
      validatedInput
    );

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
 * @desc        List paginated consultation session history for the caller organization
 * @route       GET /api/v1/ai-studio/doubt-solver/sessions
 * @access      Authenticated Organization Users
 */
export async function listDoubtSolverSessions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const query = QueryDoubtSolverSessionsSchema.parse(req.query);
    const result = await service.listSessions(organizationId, query);

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
 * @access      Authenticated Organization Users
 */
export async function getDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    const sessionId = (req.params.sessionId || "") as string;

    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const session = await service.getSessionById(sessionId, organizationId);

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
 * @access      Authenticated Organization Users
 */
export async function askDoubtSolverQuestion(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    const employeeId = (req.user as any)?.employeeId || null;
    const sessionId = (req.params.sessionId || "") as string;

    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const validatedInput = AskDoubtSolverQuestionSchema.parse(req.body);
    const result = await service.askQuestion(
      sessionId,
      organizationId,
      employeeId,
      validatedInput
    );

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
 * @access      Authenticated Organization Users
 */
export async function rateDoubtSolverMessage(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    const messageId = (req.params.messageId || "") as string;

    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const { rating } = RateDoubtSolverMessageSchema.parse(req.body);
    const result = await service.rateMessage(
      messageId,
      rating,
      organizationId
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
 * @access      Authenticated Organization Users
 */
export async function updateDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    const sessionId = (req.params.sessionId || "") as string;

    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const input = UpdateDoubtSolverSessionSchema.parse(req.body);
    const result = await service.updateSession(
      sessionId,
      organizationId,
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
 * @access      Authenticated Organization Users
 */
export async function deleteDoubtSolverSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const organizationId = req.user?.organizationId;
    const sessionId = (req.params.sessionId || "") as string;

    if (!organizationId) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Organization context is required",
      });
    }

    await service.deleteSession(sessionId, organizationId);

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

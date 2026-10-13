import type { Request, Response, NextFunction } from "express";
import { RoomDesignerService } from "../services/room-designer.service.js";
import { statusCode } from "../../../types/types.js";
import { resolveAiTargetUser } from "../utils/ai-auth.util.js";
import {
  GenerateRoomDesignSchema,
  QueryRoomDesignSessionsSchema,
  UpdateRoomDesignSessionSchema,
} from "../validators/room-designer.validator.js";

const service = new RoomDesignerService();

/**
 * @controller  getRoomDesignerRate
 * @desc        Retrieve active per-render credit rate for AI Room Designer
 * @route       GET /api/v1/ai-studio/room-designer/rate
 * @access      Authenticated Users
 */
export async function getRoomDesignerRate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const cost = await service.getPerRenderCost();
    return res.status(statusCode.OK).json({
      success: true,
      data: {
        creditCost: cost,
        billingUnit: "per render",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  generateRoomDesign
 * @desc        Generate a photorealistic room render using LangChain prompt synthesis & OpenAI DALL-E, deduct credits
 * @route       POST /api/v1/ai-studio/room-designer/generate
 * @access      Authenticated Users (Clients, Org Admins, and Employees)
 */
export async function generateRoomDesign(
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

    const validatedInput = GenerateRoomDesignSchema.parse(req.body);
    const { targetUserId, actorEmployeeId, actorUserId } = await resolveAiTargetUser(
      req.user,
      validatedInput.orgUserId
    );

    const result = await service.generateRoomDesign({
      userId: targetUserId,
      createdById: actorUserId,
      employeeId: actorEmployeeId,
      input: validatedInput,
    });

    return res.status(statusCode.Created).json({
      success: true,
      message: "Room design generated successfully",
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
 * @controller  listRoomDesignSessions
 * @desc        List paginated room design generations for the target user / organization
 * @route       GET /api/v1/ai-studio/room-designer/sessions
 * @access      Authenticated Users
 */
export async function listRoomDesignSessions(
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

    const query = QueryRoomDesignSessionsSchema.parse(req.query);
    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      query.orgUserId
    );

    const result = await service.listSessions(targetUserId, query);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Room designs retrieved successfully",
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getRoomDesignSession
 * @desc        Retrieve single room design session details with high-res asset URLs
 * @route       GET /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @access      Authenticated Users
 */
export async function getRoomDesignSession(
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
 * @controller  updateRoomDesignSession
 * @desc        Update room design session metadata
 * @route       PATCH /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @access      Authenticated Users
 */
export async function updateRoomDesignSession(
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
      req.body.orgUserId as string | undefined
    );

    const input = UpdateRoomDesignSessionSchema.parse(req.body);
    const result = await service.updateSession(
      sessionId,
      targetUserId,
      input
    );

    return res.status(statusCode.OK).json({
      success: true,
      message: "Room design updated successfully",
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
 * @controller  deleteRoomDesignSession
 * @desc        Delete room design session and cleanup associated cloud storage assets
 * @route       DELETE /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @access      Authenticated Users
 */
export async function deleteRoomDesignSession(
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
      message: "Room design deleted successfully",
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

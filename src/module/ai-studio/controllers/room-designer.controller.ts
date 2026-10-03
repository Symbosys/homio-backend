import type { Request, Response, NextFunction } from "express";
import { RoomDesignerService } from "../services/room-designer.service.js";
import { statusCode } from "../../../types/types.js";
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
 * @access      Authenticated Organization Users
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
 * @access      Authenticated Organization Users
 */
export async function generateRoomDesign(
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

    const validatedInput = GenerateRoomDesignSchema.parse(req.body);
    const result = await service.generateRoomDesign(
      organizationId,
      employeeId,
      validatedInput
    );

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
 * @desc        List paginated room design generations for the caller organization
 * @route       GET /api/v1/ai-studio/room-designer/sessions
 * @access      Authenticated Organization Users
 */
export async function listRoomDesignSessions(
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

    const query = QueryRoomDesignSessionsSchema.parse(req.query);
    const result = await service.listSessions(organizationId, query);

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
 * @access      Authenticated Organization Users
 */
export async function getRoomDesignSession(
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
 * @controller  updateRoomDesignSession
 * @desc        Update room design session metadata
 * @route       PATCH /api/v1/ai-studio/room-designer/sessions/:sessionId
 * @access      Authenticated Organization Users
 */
export async function updateRoomDesignSession(
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

    const input = UpdateRoomDesignSessionSchema.parse(req.body);
    const result = await service.updateSession(
      sessionId,
      organizationId,
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
 * @access      Authenticated Organization Users
 */
export async function deleteRoomDesignSession(
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

import type { Request, Response } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { whatsAppMessageService } from "../services/whatsapp-message.service.js";
import {
  sendWhatsAppTemplateMessageSchema,
  sendWhatsAppCustomMessageSchema,
} from "../validators/whatsapp-message.validator.js";

/**
 * Controller: Dispatch a pre-approved WhatsApp message template to any recipient
 * Resolves dynamic parameters from CRM records (Lead, Customer, Project, Quotation, Meeting, Employee, Org)
 * @route   POST /api/v1/communication/messages/template
 */
export const sendTemplateMessage = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  let employeeId: string | null = null;
  const userId = req.user?.id;
  if (userId) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
      select: { id: true },
    });
    employeeId = employee?.id || null;
  }

  const parsed = sendWhatsAppTemplateMessageSchema.parse({ body: req.body });
  const result = await whatsAppMessageService.sendTemplateMessage(
    organizationId,
    parsed.body,
    employeeId
  );

  return SuccessResponse(
    res,
    "WhatsApp template message dispatched successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Dispatch a direct custom message (Text, Image, Video, Document) to any recipient
 * @route   POST /api/v1/communication/messages/custom
 */
export const sendCustomMessage = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  let employeeId: string | null = null;
  const userId = req.user?.id;
  if (userId) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
      select: { id: true },
    });
    employeeId = employee?.id || null;
  }

  const parsed = sendWhatsAppCustomMessageSchema.parse({ body: req.body });
  const result = await whatsAppMessageService.sendCustomMessage(
    organizationId,
    parsed.body,
    employeeId
  );

  return SuccessResponse(
    res,
    "WhatsApp custom message dispatched successfully",
    result,
    statusCode.OK
  );
});

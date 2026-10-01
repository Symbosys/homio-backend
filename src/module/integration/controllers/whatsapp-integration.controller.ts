import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { whatsAppIntegrationService } from "../services/whatsapp-integration.service.js";
import { saveWhatsAppIntegrationSchema } from "../validators/whatsapp-integration.validator.js";

/**
 * Controller: Retrieve current organization's WhatsApp Cloud API integration
 * @route   GET /api/v1/integrations/whatsapp
 * @desc    Fetch tenant WhatsApp configuration and connection status
 */
export const getWhatsAppIntegration = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const integration = await whatsAppIntegrationService.getIntegration(organizationId);
  return SuccessResponse(
    res,
    integration ? "WhatsApp integration retrieved successfully" : "No WhatsApp integration configured",
    integration,
    statusCode.OK
  );
});

/**
 * Controller: Save / Update organization's WhatsApp credentials
 * @route   POST /api/v1/integrations/whatsapp
 * @desc    Upsert Meta App ID, App Secret, WABA ID, Phone ID, Access Token, and Webhook Verify Token
 */
export const saveWhatsAppIntegration = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const parsed = saveWhatsAppIntegrationSchema.parse({ body: req.body });
  const result = await whatsAppIntegrationService.saveIntegration(organizationId, parsed.body);

  return SuccessResponse(res, "WhatsApp credentials saved successfully", result, statusCode.OK);
});

/**
 * Controller: Test & Verify live WhatsApp credentials with Meta Graph API
 * @route   POST /api/v1/integrations/whatsapp/verify
 * @desc    Verifies Phone Number ID and Access Token validity with Meta Graph API and activates integration
 */
export const verifyWhatsAppIntegration = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const result = await whatsAppIntegrationService.verifyIntegration(organizationId);
  return SuccessResponse(res, "WhatsApp integration verified and connected successfully!", result, statusCode.OK);
});

/**
 * Controller: Disconnect WhatsApp integration
 * @route   DELETE /api/v1/integrations/whatsapp
 * @desc    Removes WhatsApp credentials for the tenant organization
 */
export const disconnectWhatsAppIntegration = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const result = await whatsAppIntegrationService.disconnectIntegration(organizationId);
  return SuccessResponse(res, result.message, null, statusCode.OK);
});

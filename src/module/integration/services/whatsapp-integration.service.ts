import { axiosClient } from "../../../lib/axios.js";
import { whatsAppIntegrationRepo } from "../repos/whatsapp-integration.repo.js";
import { ChannelIntegrationStatus, statusCode } from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type { SaveWhatsAppIntegrationDto } from "../validators/whatsapp-integration.validator.js";

/**
 * Service handling WhatsApp Cloud API Integration business logic & Meta verification
 */
export class WhatsAppIntegrationService {
  /**
   * Retrieve organization's WhatsApp integration settings
   * @param organizationId Tenant organization ID
   */
  async getIntegration(organizationId: string) {
    const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
    if (!integration) {
      return null;
    }

    return integration;
  }

  /**
   * Save or update WhatsApp integration credentials
   * @param organizationId Tenant organization ID
   * @param data Validated credentials payload
   */
  async saveIntegration(organizationId: string, data: SaveWhatsAppIntegrationDto) {
    // Check if phone number ID is already registered under another organization
    const existingByPhone = await whatsAppIntegrationRepo.findByPhoneNumberId(data.phoneNumberId);
    if (existingByPhone && existingByPhone.organizationId !== organizationId) {
      throw new ErrorResponse(
        "This Phone Number ID is already registered under another organization. Each WhatsApp Phone Number ID must be unique.",
        statusCode.Conflict
      );
    }

    const saved = await whatsAppIntegrationRepo.upsert(organizationId, data);
    return saved;
  }

  /**
   * Test & verify live credentials with Meta Graph API using central axiosClient.
   * All network and Meta Graph API errors bubble up directly to the global errorMiddleware.
   * @param organizationId Tenant organization ID
   */
  async verifyIntegration(organizationId: string) {
    const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
    if (!integration) {
      throw new ErrorResponse(
        "WhatsApp integration not configured. Please enter and save credentials first.",
        statusCode.Not_Found
      );
    }

    const { phoneNumberId, accountId, accessToken, displayPhoneNumber } = integration;

    // 1. Verify Phone Number ID & Token with Meta Graph API
    const metaPhoneUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}`;
    const phoneResponse = await axiosClient.get<{
      id?: string;
      verified_name?: string;
      display_phone_number?: string;
      quality_rating?: string;
      code_verification_status?: string;
    }>(metaPhoneUrl, {
      params: {
        fields: "verified_name,display_phone_number,quality_rating,code_verification_status",
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 15000,
    });

    const phoneData = phoneResponse.data;

    // 2. Verify WhatsApp Business Account ID (WABA ID) if provided
    if (accountId) {
      const metaWabaUrl = `https://graph.facebook.com/v21.0/${accountId}`;
      await axiosClient.get<{ id?: string; name?: string }>(metaWabaUrl, {
        params: {
          fields: "id,name,timezone_id",
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 15000,
      });
    }

    // 3. Update status to ACTIVE upon successful verification
    const updated = await whatsAppIntegrationRepo.updateStatus(
      organizationId,
      ChannelIntegrationStatus.ACTIVE
    );

    return {
      verified: true,
      status: ChannelIntegrationStatus.ACTIVE,
      metaVerifiedName: phoneData.verified_name || null,
      metaDisplayPhoneNumber: phoneData.display_phone_number || displayPhoneNumber,
      qualityRating: phoneData.quality_rating || "UNKNOWN",
      integration: updated,
    };
  }

  /**
   * Disconnect and remove WhatsApp integration
   * @param organizationId Tenant organization ID
   */
  async disconnectIntegration(organizationId: string) {
    const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
    if (!integration) {
      throw new ErrorResponse("No WhatsApp integration found to disconnect", statusCode.Not_Found);
    }

    await whatsAppIntegrationRepo.delete(organizationId);
    return { success: true, message: "WhatsApp integration disconnected successfully" };
  }
}

export const whatsAppIntegrationService = new WhatsAppIntegrationService();

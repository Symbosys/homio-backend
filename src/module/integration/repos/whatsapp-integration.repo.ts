import { prisma } from "../../../lib/prisma.js";
import { ChannelIntegrationStatus, ChannelProvider } from "../../../types/types.js";
import type { SaveWhatsAppIntegrationDto } from "../validators/whatsapp-integration.validator.js";

/**
 * Repository for organization-scoped WhatsApp Cloud API Integration
 */
export class WhatsAppIntegrationRepository {
  /**
   * Find WhatsApp integration by organization ID
   */
  async findByOrganizationId(organizationId: string) {
    return prisma.whatsAppIntegration.findUnique({
      where: { organizationId },
    });
  }

  /**
   * Find WhatsApp integration by phone number ID (used for unique check and webhook lookup)
   */
  async findByPhoneNumberId(phoneNumberId: string) {
    return prisma.whatsAppIntegration.findUnique({
      where: { phoneNumberId },
    });
  }

  /**
   * Upsert WhatsApp integration credentials for an organization
   */
  async upsert(organizationId: string, data: SaveWhatsAppIntegrationDto) {
    return prisma.whatsAppIntegration.upsert({
      where: { organizationId },
      create: {
        organizationId,
        provider: ChannelProvider.WHATSAPP,
        status: ChannelIntegrationStatus.PENDING_VERIFICATION,
        appId: data.appId,
        appSecret: data.appSecret,
        accountId: data.accountId,
        phoneNumberId: data.phoneNumberId,
        displayPhoneNumber: data.displayPhoneNumber,
        accessToken: data.accessToken,
        webhookVerifyToken: data.webhookVerifyToken,
      },
      update: {
        provider: ChannelProvider.WHATSAPP,
        status: ChannelIntegrationStatus.PENDING_VERIFICATION,
        appId: data.appId,
        appSecret: data.appSecret,
        accountId: data.accountId,
        phoneNumberId: data.phoneNumberId,
        displayPhoneNumber: data.displayPhoneNumber,
        accessToken: data.accessToken,
        webhookVerifyToken: data.webhookVerifyToken,
      },
    });
  }

  /**
   * Update integration status (e.g. ACTIVE, ERROR, DISCONNECTED)
   */
  async updateStatus(organizationId: string, status: ChannelIntegrationStatus) {
    return prisma.whatsAppIntegration.update({
      where: { organizationId },
      data: { status },
    });
  }

  /**
   * Delete WhatsApp integration for an organization
   */
  async delete(organizationId: string) {
    return prisma.whatsAppIntegration.delete({
      where: { organizationId },
    });
  }
}

export const whatsAppIntegrationRepo = new WhatsAppIntegrationRepository();

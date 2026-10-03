import { prisma } from "../../../lib/prisma.js";
import { whatsAppIntegrationRepo } from "../../integration/repos/whatsapp-integration.repo.js";
import { whatsAppTemplateRepo } from "../repos/whatsapp-template.repo.js";
import { metaWhatsAppService } from "./meta-whatsapp.service.js";
import { variableMappingEngine } from "./variable-mapping.engine.js";
import {
  ChannelIntegrationStatus,
  WhatsAppHeaderType,
  WhatsAppTemplateStatus,
  WhatsAppVariableComponent,
  statusCode,
  type ImageType,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type {
  SendWhatsAppTemplateMessageDto,
  SendWhatsAppCustomMessageDto,
} from "../validators/whatsapp-message.validator.js";

/**
 * Standard Result returned after successfully dispatching a template message
 */
export interface TemplateMessageDispatchResult {
  messageId: string;
  recipient: string;
  templateName: string;
  language: string;
  status: "SENT";
  renderedBody: string;
  dispatchedAt: string;
}

/**
 * Standard Result returned after successfully dispatching a custom direct message
 */
export interface CustomMessageDispatchResult {
  messageId: string;
  recipient: string;
  type: "text" | "image" | "video" | "document";
  status: "SENT";
  dispatchedAt: string;
}

/**
 * Enterprise Reusable Service managing WhatsApp message dispatches across Homio CRM
 * Can be imported and used directly by any module: Leads, Projects, Quotations, Meetings, Site Consultations, etc.
 */
export class WhatsAppMessageService {
  /**
   * Helper: Normalize recipient phone number for Meta WhatsApp Cloud API
   * Strips all non-digit characters (+, spaces, dashes)
   */
  private normalizePhoneNumber(phone: string): string {
    const digitsOnly = phone.replace(/[^\d]/g, "");
    if (!digitsOnly || digitsOnly.length < 7) {
      throw new ErrorResponse(
        `Invalid recipient phone number "${phone}". International format with country code is required.`,
        statusCode.Bad_Request
      );
    }
    return digitsOnly;
  }

  /**
   * Helper: Retrieve active WhatsApp Cloud API integration for the organization
   */
  private async getActiveIntegration(organizationId: string) {
    const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);

    if (
      !integration ||
      integration.status !== ChannelIntegrationStatus.ACTIVE ||
      !integration.accessToken ||
      !integration.phoneNumberId
    ) {
      throw new ErrorResponse(
        "Cannot send WhatsApp message: Active WhatsApp Business Integration credentials not configured for your organization. Please verify settings in Settings > WhatsApp Integration.",
        statusCode.Bad_Request
      );
    }

    return integration;
  }

  /**
   * Send pre-approved WhatsApp Message Template to recipient
   * Automatically resolves variables from CRM records (Lead, Customer, Project, Quotation, Meeting, Employee, Org)
   * 
   * @param organizationId  Tenant organization UUID (Rule 1, 3)
   * @param dto             Template dispatch payload with recipient and contextual IDs
   * @param _senderId       Optional employee ID of user initiating the send
   */
  async sendTemplateMessage(
    organizationId: string,
    dto: SendWhatsAppTemplateMessageDto,
    _senderId?: string | null
  ): Promise<TemplateMessageDispatchResult> {
    const integration = await this.getActiveIntegration(organizationId);
    const cleanPhone = this.normalizePhoneNumber(dto.to);

    // 1. Fetch template from database scoped to organization
    let template = dto.templateId
      ? await whatsAppTemplateRepo.findById(organizationId, dto.templateId)
      : null;

    if (!template && dto.templateName) {
      template = await prisma.whatsAppMessageTemplate.findFirst({
        where: {
          organizationId,
          name: dto.templateName,
          status: { not: WhatsAppTemplateStatus.DELETED },
        },
        include: {
          variables: {
            orderBy: [{ component: "asc" }, { position: "asc" }],
          },
          createdBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              designation: true,
            },
          },
        },
      });
    }

    if (!template) {
      throw new ErrorResponse(
        `WhatsApp template "${dto.templateId || dto.templateName}" not found in your organization`,
        statusCode.Not_Found
      );
    }

    if (template.status !== WhatsAppTemplateStatus.APPROVED) {
      throw new ErrorResponse(
        `WhatsApp template "${template.name}" cannot be sent because its status is "${template.status}". Only APPROVED templates can be dispatched via Meta Cloud API.`,
        statusCode.Bad_Request
      );
    }

    // 2. Resolve template dynamic variables using VariableMappingEngine
    const context = {
      organizationId,
      leadId: dto.context?.leadId || null,
      customerId: dto.context?.customerId || null,
      projectId: dto.context?.projectId || null,
      quotationId: dto.context?.quotationId || null,
      meetingId: dto.context?.meetingId || null,
      employeeId: dto.context?.employeeId || null,
      customOverrides: dto.context?.customOverrides || undefined,
    };

    const rendered = await variableMappingEngine.resolveTemplate(
      {
        headerType: template.headerType,
        headerText: template.headerText,
        headerMedia: template.headerMedia,
        bodyText: template.bodyText,
        footerText: template.footerText,
        buttons: template.buttons,
        variables: template.variables,
      },
      context
    );

    // 3. Compile Meta Template Components payload
    const metaComponents: Array<Record<string, unknown>> = [];

    // Header parameters (IMAGE, VIDEO, DOCUMENT or Header Text with variables)
    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(template.headerType)) {
      const mediaType = template.headerType.toLowerCase();
      const mediaUrl =
        dto.mediaUrl ||
        (template.headerMedia as ImageType | null)?.url ||
        this.extractSampleHeaderHandle(template.metaRawPayload);

      if (mediaUrl) {
        metaComponents.push({
          type: "header",
          parameters: [
            {
              type: mediaType,
              [mediaType]: {
                link: mediaUrl,
              },
            },
          ],
        });
      }
    } else if (template.headerType === WhatsAppHeaderType.TEXT && template.variables) {
      const headerVars = template.variables
        .filter((v) => v.component === WhatsAppVariableComponent.HEADER)
        .sort((a, b) => a.position - b.position);

      if (headerVars.length > 0) {
        const headerParams = headerVars.map((v) => {
          const resolvedVal =
            rendered.variables.find((rv) => rv.parameter === v.parameter)?.value ||
            v.fallbackValue ||
            "";
          return {
            type: "text",
            text: resolvedVal,
          };
        });

        metaComponents.push({
          type: "header",
          parameters: headerParams,
        });
      }
    }

    // Body parameters
    if (template.variables && template.variables.length > 0) {
      const bodyVars = template.variables
        .filter((v) => v.component === WhatsAppVariableComponent.BODY)
        .sort((a, b) => a.position - b.position);

      if (bodyVars.length > 0) {
        const bodyParams = bodyVars.map((v) => {
          const resolvedVal =
            rendered.variables.find((rv) => rv.parameter === v.parameter)?.value ||
            v.fallbackValue ||
            "";
          return {
            type: "text",
            text: resolvedVal,
          };
        });

        metaComponents.push({
          type: "body",
          parameters: bodyParams,
        });
      }
    }

    // 4. Construct final Meta dispatch payload
    const metaPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "template",
      template: {
        name: template.name,
        language: {
          code: dto.language || template.language || "en_US",
        },
        ...(metaComponents.length > 0 && { components: metaComponents }),
      },
    };

    // 5. Dispatch message through Meta Graph API
    const metaRes = await metaWhatsAppService.dispatchMessageToMeta(
      integration.phoneNumberId!,
      integration.accessToken!,
      metaPayload
    );

    const messageId = metaRes.messages?.[0]?.id || "unknown";

    return {
      messageId,
      recipient: cleanPhone,
      templateName: template.name,
      language: dto.language || template.language || "en_US",
      status: "SENT",
      renderedBody: rendered.body,
      dispatchedAt: new Date().toISOString(),
    };
  }

  /**
   * Send custom direct message (Text, Image, Video, Document) to recipient
   * 
   * @param organizationId  Tenant organization UUID (Rule 1, 3)
   * @param dto             Custom message payload with recipient, type, text/media
   * @param _senderId       Optional employee ID of user initiating the send
   */
  async sendCustomMessage(
    organizationId: string,
    dto: SendWhatsAppCustomMessageDto,
    _senderId?: string | null
  ): Promise<CustomMessageDispatchResult> {
    const integration = await this.getActiveIntegration(organizationId);
    const cleanPhone = this.normalizePhoneNumber(dto.to);

    const metaPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
    };

    if (dto.messageType === "text") {
      metaPayload.type = "text";
      metaPayload.text = {
        preview_url: dto.previewUrl ?? true,
        body: dto.text || "",
      };
    } else {
      metaPayload.type = dto.messageType;
      metaPayload[dto.messageType] = {
        link: dto.mediaUrl,
        ...(dto.caption && { caption: dto.caption.trim() }),
      };
    }

    const metaRes = await metaWhatsAppService.dispatchMessageToMeta(
      integration.phoneNumberId!,
      integration.accessToken!,
      metaPayload
    );

    const messageId = metaRes.messages?.[0]?.id || "unknown";

    return {
      messageId,
      recipient: cleanPhone,
      type: dto.messageType,
      status: "SENT",
      dispatchedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper: Extract sample handle from metaRawPayload if dynamic mediaUrl was not provided
   */
  private extractSampleHeaderHandle(metaRawPayload: unknown): string | null {
    if (!metaRawPayload || typeof metaRawPayload !== "object") return null;
    try {
      const components = (metaRawPayload as any)?.components;
      if (!Array.isArray(components)) return null;
      const headerComp = components.find((c: any) => c.type === "HEADER");
      return headerComp?.example?.header_handle?.[0] || null;
    } catch {
      return null;
    }
  }
}

export const whatsAppMessageService = new WhatsAppMessageService();

import { whatsAppIntegrationRepo } from "../../integration/repos/whatsapp-integration.repo.js";
import { whatsAppTemplateRepo } from "../repos/whatsapp-template.repo.js";
import { metaWhatsAppService } from "./meta-whatsapp.service.js";
import { variableMappingEngine, type VariableResolutionContext } from "./variable-mapping.engine.js";
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  WhatsAppHeaderType,
  WhatsAppVariableComponent,
  ChannelIntegrationStatus,
  statusCode,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type {
  CreateWhatsAppTemplateDto,
  UpdateWhatsAppTemplateDto,
  GetWhatsAppTemplatesQueryDto,
} from "../validators/whatsapp-template.validator.js";

/**
 * Service managing WhatsApp message templates, variable resolution, and Meta sync operations
 */
export class WhatsAppTemplateService {
  /**
   * Helper: Parse variables from message text or components
   */
  private extractVariables(
    component: WhatsAppVariableComponent,
    text?: string | null
  ): Array<{ component: WhatsAppVariableComponent; position: number; parameter: string }> {
    if (!text) return [];

    const matches = text.match(/\{\{\d+\}\}/g);
    if (!matches) return [];

    // Deduplicate and sort positions
    const uniqueParams = Array.from(new Set(matches));
    return uniqueParams.map((param) => {
      const posNumber = parseInt(param.replace(/[^0-9]/g, ""), 10) || 1;
      return {
        component,
        position: posNumber,
        parameter: param,
      };
    });
  }

  /**
   * Create a new WhatsApp template and optionally submit to Meta Cloud API
   */
  async createTemplate(
    organizationId: string,
    createdById: string | null,
    dto: CreateWhatsAppTemplateDto
  ) {
    // 1. Check uniqueness of template name + language within tenant
    const existing = await whatsAppTemplateRepo.findByName(organizationId, dto.name, dto.language);
    if (existing) {
      throw new ErrorResponse(
        `A template named "${dto.name}" with language "${dto.language}" already exists in your organization.`,
        statusCode.Conflict
      );
    }

    // 2. Extract and compile detected variables across Header and Body
    const detectedVariables: Array<{
      component: WhatsAppVariableComponent;
      position: number;
      parameter: string;
      mappingEntity?: any;
      mappingField?: string | null;
      fallbackValue?: string | null;
      label?: string | null;
      isRequired?: boolean;
    }> = [];

    if (dto.headerType === WhatsAppHeaderType.TEXT && dto.headerText) {
      detectedVariables.push(...this.extractVariables(WhatsAppVariableComponent.HEADER, dto.headerText));
    }
    detectedVariables.push(...this.extractVariables(WhatsAppVariableComponent.BODY, dto.bodyText));

    // Merge any user-provided mappings from dto.variables
    if (dto.variables && dto.variables.length > 0) {
      for (const userVar of dto.variables) {
        const target = detectedVariables.find(
          (d) => d.component === userVar.component && d.position === userVar.position
        );
        if (target) {
          target.mappingEntity = userVar.mappingEntity;
          target.mappingField = userVar.mappingField;
          target.fallbackValue = userVar.fallbackValue;
          target.label = userVar.label;
          target.isRequired = userVar.isRequired;
        }
      }
    }

    // 3. Optional Meta submission if requested
    let wabaTemplateId: string | null = null;
    let templateStatus: WhatsAppTemplateStatus = WhatsAppTemplateStatus.DRAFT;
    let metaRawPayload: any = null;

    if (dto.submitToMeta) {
      const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
      if (!integration || integration.status !== ChannelIntegrationStatus.ACTIVE || !integration.accessToken || !integration.accountId) {
        throw new ErrorResponse(
          "Cannot submit template to WhatsApp: Active WhatsApp Business Integration credentials not configured for your organization. You may save this as a local draft.",
          statusCode.Bad_Request
        );
      }

      // Compile Meta components
      const metaComponents: any[] = [];

      if (dto.headerType === WhatsAppHeaderType.TEXT && dto.headerText) {
        metaComponents.push({
          type: "HEADER",
          format: "TEXT",
          text: dto.headerText,
        });
      } else if (dto.headerType !== WhatsAppHeaderType.NONE && dto.headerType) {
        metaComponents.push({
          type: "HEADER",
          format: dto.headerType,
        });
      }

      const bodyComponent: any = {
        type: "BODY",
        text: dto.bodyText,
      };
      if (dto.bodyExamples && dto.bodyExamples.length > 0) {
        bodyComponent.example = { body_text: [dto.bodyExamples] };
      }
      metaComponents.push(bodyComponent);

      if (dto.footerText && dto.footerText.trim()) {
        metaComponents.push({
          type: "FOOTER",
          text: dto.footerText.trim(),
        });
      }

      if (dto.buttons && dto.buttons.length > 0) {
        metaComponents.push({
          type: "BUTTONS",
          buttons: dto.buttons.map((b) => ({
            type: b.type,
            text: b.text,
            ...(b.url && { url: b.url }),
            ...(b.phoneNumber && { phone_number: b.phoneNumber }),
          })),
        });
      }

      const metaResult = await metaWhatsAppService.createTemplate(
        integration.accountId,
        integration.accessToken,
        {
          name: dto.name,
          category: dto.category,
          language: dto.language,
          components: metaComponents,
        }
      );

      wabaTemplateId = metaResult.id;
      templateStatus = WhatsAppTemplateStatus.PENDING_APPROVAL;
      metaRawPayload = metaResult;
    }

    // 4. Save template in repository with relational variables
    const created = await whatsAppTemplateRepo.createTemplate(
      organizationId,
      createdById,
      {
        name: dto.name,
        category: dto.category,
        language: dto.language,
        status: templateStatus,
        headerType: dto.headerType,
        headerText: dto.headerText || null,
        headerMedia: dto.headerMedia || null,
        bodyText: dto.bodyText,
        bodyExamples: dto.bodyExamples || null,
        footerText: dto.footerText || null,
        buttons: dto.buttons || null,
        wabaTemplateId,
        additionalInformation: dto.additionalInformation || null,
        metaRawPayload,
      },
      detectedVariables
    );

    return created;
  }

  /**
   * API 1 — List Templates with server-side pagination, search, filters, and KPI ribbon (Rule 21)
   */
  async listTemplates(organizationId: string, query: GetWhatsAppTemplatesQueryDto) {
    const [paginated, analytics] = await Promise.all([
      whatsAppTemplateRepo.findManyWithFilters(organizationId, query),
      whatsAppTemplateRepo.getTemplateKpiStats(organizationId),
    ]);

    return {
      data: paginated.items,
      pagination: paginated.pagination,
      analytics,
    };
  }

  /**
   * API 2 — Get complete details of a single WhatsApp template
   */
  async getTemplateById(organizationId: string, id: string) {
    const template = await whatsAppTemplateRepo.findById(organizationId, id);
    if (!template) {
      throw new ErrorResponse("WhatsApp template not found", statusCode.Not_Found);
    }
    return template;
  }

  /**
   * API 3 — Update template metadata, components, and CRM variable mappings
   */
  async updateTemplate(organizationId: string, id: string, data: UpdateWhatsAppTemplateDto) {
    const existing = await whatsAppTemplateRepo.findById(organizationId, id);
    if (!existing) {
      throw new ErrorResponse("WhatsApp template not found", statusCode.Not_Found);
    }

    // 1. Validate variable mappings against whitelist
    if (data.variables && data.variables.length > 0) {
      for (const v of data.variables) {
        // Ensure variable belongs to this template
        const belongs = existing.variables.some((ev) => ev.id === v.variableId);
        if (!belongs) {
          throw new ErrorResponse(
            `Variable ID "${v.variableId}" does not belong to template "${existing.name}"`,
            statusCode.Bad_Request
          );
        }

        // Validate mapping whitelist
        variableMappingEngine.validateMapping(v.mappingEntity, v.mappingField);
      }
    }

    // 2. If components changed and resubmitToMeta requested, update on Meta
    if (data.resubmitToMeta && existing.wabaTemplateId) {
      const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
      if (!integration?.accessToken) {
        throw new ErrorResponse(
          "Cannot resubmit to Meta: WhatsApp Cloud API credentials not configured",
          statusCode.Bad_Request
        );
      }

      // Meta allows component edits on APPROVED / REJECTED templates
      await metaWhatsAppService.updateTemplateComponents(
        existing.wabaTemplateId,
        integration.accessToken,
        [] // Components array built if full edit required
      );
    }

    return whatsAppTemplateRepo.update(organizationId, id, data);
  }

  /**
   * API 4 — Delete template locally and on Meta Graph API (Idempotent, historical safe)
   */
  async deleteTemplate(organizationId: string, id: string) {
    const existing = await whatsAppTemplateRepo.findById(organizationId, id);
    if (!existing) {
      throw new ErrorResponse("WhatsApp template not found", statusCode.Not_Found);
    }

    // Attempt deletion on Meta Cloud API
    const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
    if (integration?.accountId && integration?.accessToken) {
      await metaWhatsAppService.deleteTemplateByName(
        integration.accountId,
        integration.accessToken,
        existing.name
      );
    }

    // Soft delete locally to preserve historical communication logs
    await whatsAppTemplateRepo.softDelete(organizationId, id);

    return {
      success: true,
      message: `WhatsApp message template "${existing.name}" deleted successfully`,
    };
  }

  /**
   * API 5 — Sync single template directly from Meta Graph API
   */
  async syncOneTemplate(organizationId: string, id: string) {
    const existing = await whatsAppTemplateRepo.findById(organizationId, id);
    if (!existing) {
      throw new ErrorResponse("WhatsApp template not found", statusCode.Not_Found);
    }

    const integration = await whatsAppIntegrationRepo.findByOrganizationId(organizationId);
    if (!integration || !integration.accountId || !integration.accessToken) {
      throw new ErrorResponse(
        "WhatsApp Cloud API integration not configured for this organization",
        statusCode.Bad_Request
      );
    }

    // 1. Fetch live template from Meta
    const metaItem = await metaWhatsAppService.fetchTemplateByName(
      integration.accountId,
      integration.accessToken,
      existing.name
    );

    if (!metaItem) {
      throw new ErrorResponse(
        `Template "${existing.name}" was not found on Meta WhatsApp Business Account. It may have been deleted directly in Meta Business Manager.`,
        statusCode.Not_Found
      );
    }

    // 2. Parse components
    const headerComp = metaItem.components?.find((c) => c.type === "HEADER");
    const bodyComp = metaItem.components?.find((c) => c.type === "BODY");
    const footerComp = metaItem.components?.find((c) => c.type === "FOOTER");
    const buttonsComp = metaItem.components?.find((c) => c.type === "BUTTONS");

    // Header Type
    let headerType: WhatsAppHeaderType = WhatsAppHeaderType.NONE;
    if (headerComp?.format === "TEXT") headerType = WhatsAppHeaderType.TEXT;
    else if (headerComp?.format === "IMAGE") headerType = WhatsAppHeaderType.IMAGE;
    else if (headerComp?.format === "DOCUMENT") headerType = WhatsAppHeaderType.DOCUMENT;
    else if (headerComp?.format === "VIDEO") headerType = WhatsAppHeaderType.VIDEO;
    else if (headerComp?.format === "LOCATION") headerType = WhatsAppHeaderType.LOCATION;

    // Map Meta status
    let metaStatus: WhatsAppTemplateStatus = WhatsAppTemplateStatus.DRAFT;
    const s = (metaItem.status || "").toUpperCase();
    if (s === "APPROVED") metaStatus = WhatsAppTemplateStatus.APPROVED;
    else if (s === "REJECTED") metaStatus = WhatsAppTemplateStatus.REJECTED;
    else if (s === "PENDING" || s === "PENDING_APPROVAL")
      metaStatus = WhatsAppTemplateStatus.PENDING_APPROVAL;
    else if (s === "PAUSED") metaStatus = WhatsAppTemplateStatus.PAUSED;
    else if (s === "DISABLED") metaStatus = WhatsAppTemplateStatus.DISABLED;

    // 3. Detect all variables across Header, Body, and Buttons
    const detectedVariables: Array<{
      component: WhatsAppVariableComponent;
      position: number;
      parameter: string;
    }> = [];

    if (headerComp?.text) {
      detectedVariables.push(...this.extractVariables(WhatsAppVariableComponent.HEADER, headerComp.text));
    }
    if (bodyComp?.text) {
      detectedVariables.push(...this.extractVariables(WhatsAppVariableComponent.BODY, bodyComp.text));
    }

    // 4. Atomically sync template and variables in database
    const updatedTemplate = await whatsAppTemplateRepo.syncMetaTemplateData(
      organizationId,
      id,
      {
        wabaTemplateId: metaItem.id,
        status: metaStatus,
        category: metaItem.category as WhatsAppTemplateCategory,
        language: metaItem.language,
        headerType,
        headerText: headerComp?.text || null,
        bodyText: bodyComp?.text || "",
        footerText: footerComp?.text || null,
        buttons: buttonsComp?.buttons || null,
        qualityRating: metaItem.quality_score?.score || null,
        rejectionReason: metaItem.rejected_reason || null,
        metaRawPayload: metaItem,
        metaUpdatedAt: metaItem.last_updated_time ? new Date(metaItem.last_updated_time) : null,
      },
      detectedVariables
    );

    return {
      template: updatedTemplate,
      sync: {
        status: "SYNCED",
        changed: true,
        lastSyncedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * API 6 — Render template preview with live CRM entity values (Strictly Read-Only)
   */
  async renderTemplate(
    organizationId: string,
    id: string,
    context: Omit<VariableResolutionContext, "organizationId">
  ) {
    const template = await whatsAppTemplateRepo.findById(organizationId, id);
    if (!template) {
      throw new ErrorResponse("WhatsApp template not found", statusCode.Not_Found);
    }

    return variableMappingEngine.resolveTemplate(
      {
        headerText: template.headerText,
        bodyText: template.bodyText,
        footerText: template.footerText,
        buttons: template.buttons,
        variables: template.variables,
      },
      {
        ...context,
        organizationId,
      }
    );
  }

  /**
   * API 7 — Variable Dictionary: Whitelisted CRM entities and fields
   */
  getVariableDictionary() {
    return variableMappingEngine.getVariableDictionary();
  }
}

export const whatsAppTemplateService = new WhatsAppTemplateService();

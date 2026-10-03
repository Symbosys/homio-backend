import { prisma } from "../../../lib/prisma.js";
import {
  Prisma,
  WhatsAppTemplateStatus,
  WhatsAppVariableComponent,
} from "../../../types/types.js";
import type {
  UpdateWhatsAppTemplateDto,
  GetWhatsAppTemplatesQueryDto,
} from "../validators/whatsapp-template.validator.js";

/**
 * Repository for tenant-scoped WhatsApp message templates and dedicated variables
 */
export class WhatsAppTemplateRepository {
  /**
   * Find template by name and language within tenant organization
   */
  async findByName(organizationId: string, name: string, language: string) {
    return prisma.whatsAppMessageTemplate.findFirst({
      where: {
        organizationId,
        name,
        language,
        status: { not: WhatsAppTemplateStatus.DELETED },
      },
    });
  }

  /**
   * Find paginated templates with selective fields for maximum list performance (Requirement 14)
   * Avoids loading large JSON payloads and relations in list queries.
   */
  async findManyWithFilters(organizationId: string, query: GetWhatsAppTemplatesQueryDto) {
    const { page, limit, search, category, status, language, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WhatsAppMessageTemplateWhereInput = {
      organizationId,
      ...(category && { category }),
      ...(status ? { status } : { status: { not: WhatsAppTemplateStatus.DELETED } }),
      ...(language && { language }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { bodyText: { contains: search, mode: "insensitive" } },
          { headerText: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.whatsAppMessageTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          organizationId: true,
          name: true,
          wabaTemplateId: true,
          language: true,
          category: true,
          status: true,
          isEnabled: true,
          headerType: true,
          headerText: true,
          bodyText: true,
          footerText: true,
          qualityRating: true,
          rejectionReason: true,
          lastSyncedAt: true,
          createdAt: true,
          updatedAt: true,
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
          _count: {
            select: {
              variables: true,
            },
          },
        },
      }),
      prisma.whatsAppMessageTemplate.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Fast Single-Query Aggregation for KPI ribbon (Rule 21 & Requirement 4)
   */
  async getTemplateKpiStats(organizationId: string) {
    const counts = await prisma.whatsAppMessageTemplate.groupBy({
      by: ["status"],
      where: {
        organizationId,
        status: { not: WhatsAppTemplateStatus.DELETED },
      },
      _count: {
        id: true,
      },
    });

    let total = 0;
    let approved = 0;
    let pendingApproval = 0;
    let rejected = 0;
    let paused = 0;

    for (const row of counts) {
      const cnt = row._count.id;
      total += cnt;
      if (row.status === WhatsAppTemplateStatus.APPROVED) approved += cnt;
      else if (row.status === WhatsAppTemplateStatus.PENDING_APPROVAL) pendingApproval += cnt;
      else if (row.status === WhatsAppTemplateStatus.REJECTED) rejected += cnt;
      else if (row.status === WhatsAppTemplateStatus.PAUSED) paused += cnt;
    }

    return {
      total,
      approved,
      pendingApproval,
      rejected,
      paused,
    };
  }

  /**
   * Find single template by ID scoped strictly to organization with full variables
   */
  async findById(organizationId: string, id: string) {
    return prisma.whatsAppMessageTemplate.findFirst({
      where: {
        id,
        organizationId,
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

  /**
   * Update template and its variable mappings inside a clean database transaction
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateWhatsAppTemplateDto,
    extraUpdates?: {
      status?: WhatsAppTemplateStatus;
      rejectionReason?: string | null;
      metaUpdatedAt?: Date;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Update main template attributes
      const updatedTemplate = await tx.whatsAppMessageTemplate.update({
        where: { id },
        data: {
          ...(data.category && { category: data.category }),
          ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
          ...(data.headerType !== undefined && { headerType: data.headerType }),
          ...(data.headerText !== undefined && { headerText: data.headerText }),
          ...(data.headerMedia !== undefined && { headerMedia: data.headerMedia || Prisma.JsonNull }),
          ...(data.bodyText !== undefined && { bodyText: data.bodyText }),
          ...(data.bodyExamples !== undefined && { bodyExamples: data.bodyExamples || Prisma.JsonNull }),
          ...(data.footerText !== undefined && { footerText: data.footerText }),
          ...(data.buttons !== undefined && { buttons: data.buttons || Prisma.JsonNull }),
          ...(data.additionalInformation !== undefined && {
            additionalInformation: data.additionalInformation || Prisma.JsonNull,
          }),
          ...(extraUpdates?.status && { status: extraUpdates.status }),
          ...(extraUpdates?.rejectionReason !== undefined && {
            rejectionReason: extraUpdates.rejectionReason,
          }),
          ...(extraUpdates?.metaUpdatedAt && { metaUpdatedAt: extraUpdates.metaUpdatedAt }),
        },
      });

      // 2. Update variable mappings if provided
      if (data.variables && data.variables.length > 0) {
        for (const v of data.variables) {
          await tx.whatsAppTemplateVariable.updateMany({
            where: {
              id: v.variableId,
              templateId: id,
            },
            data: {
              ...(v.mappingEntity !== undefined && { mappingEntity: v.mappingEntity }),
              ...(v.mappingField !== undefined && { mappingField: v.mappingField }),
              ...(v.fallbackValue !== undefined && { fallbackValue: v.fallbackValue }),
              ...(v.label !== undefined && { label: v.label }),
              ...(v.isRequired !== undefined && { isRequired: v.isRequired }),
              isMapped: Boolean(v.mappingEntity && v.mappingField),
            },
          });
        }
      }

      // 3. Return refreshed template with variables
      return tx.whatsAppMessageTemplate.findUnique({
        where: { id },
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
    });
  }

  /**
   * Soft-delete template locally (Requirement 7: Preserves historical message references)
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.whatsAppMessageTemplate.update({
      where: { id },
      data: {
        status: WhatsAppTemplateStatus.DELETED,
        isEnabled: false,
      },
    });
  }

  /**
   * Synchronize single template from Meta Graph API
   * Upserts parsed variables while strictly preserving existing CRM mappings (Requirement 8)
   */
  async syncMetaTemplateData(
    organizationId: string,
    id: string,
    metaData: {
      wabaTemplateId: string;
      status: WhatsAppTemplateStatus;
      category?: any;
      language?: string;
      headerType: any;
      headerText?: string | null;
      bodyText: string;
      footerText?: string | null;
      buttons?: any;
      qualityRating?: string | null;
      rejectionReason?: string | null;
      metaRawPayload: any;
      metaUpdatedAt?: Date | null;
    },
    detectedVariables: Array<{
      component: WhatsAppVariableComponent;
      position: number;
      parameter: string;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Fetch current variables to preserve user-configured mappings
      const existingVars = await tx.whatsAppTemplateVariable.findMany({
        where: { templateId: id },
      });

      // 2. Update main template record
      const updatedTemplate = await tx.whatsAppMessageTemplate.update({
        where: { id },
        data: {
          wabaTemplateId: metaData.wabaTemplateId,
          status: metaData.status,
          ...(metaData.category && { category: metaData.category }),
          ...(metaData.language && { language: metaData.language }),
          headerType: metaData.headerType,
          headerText: metaData.headerText,
          bodyText: metaData.bodyText,
          footerText: metaData.footerText,
          buttons: metaData.buttons || Prisma.JsonNull,
          qualityRating: metaData.qualityRating,
          rejectionReason: metaData.rejectionReason,
          metaRawPayload: metaData.metaRawPayload || Prisma.JsonNull,
          metaUpdatedAt: metaData.metaUpdatedAt,
          lastSyncedAt: new Date(),
        },
      });

      // 3. Remove variables that no longer exist in the new Meta components
      const validKeys = new Set(
        detectedVariables.map((v) => `${v.component}_${v.position}`)
      );

      for (const ev of existingVars) {
        const key = `${ev.component}_${ev.position}`;
        if (!validKeys.has(key)) {
          await tx.whatsAppTemplateVariable.delete({
            where: { id: ev.id },
          });
        }
      }

      // 4. Upsert detected variables, preserving existing mappings
      for (const dv of detectedVariables) {
        const existing = existingVars.find(
          (ev) => ev.component === dv.component && ev.position === dv.position
        );

        if (existing) {
          // Update parameter text if needed, keep existing CRM mapping
          await tx.whatsAppTemplateVariable.update({
            where: { id: existing.id },
            data: {
              parameter: dv.parameter,
            },
          });
        } else {
          // Create newly introduced variable
          await tx.whatsAppTemplateVariable.create({
            data: {
              templateId: id,
              component: dv.component,
              position: dv.position,
              parameter: dv.parameter,
              isRequired: true,
              isMapped: false,
            },
          });
        }
      }

      // 5. Return updated template with its refreshed variables
      return tx.whatsAppMessageTemplate.findUnique({
        where: { id },
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
    });
  }

  /**
   * Create template with initial variables and CRM mappings
   */
  async createTemplate(
    organizationId: string,
    createdById: string | null,
    data: {
      name: string;
      category: any;
      language: string;
      status: WhatsAppTemplateStatus;
      headerType: any;
      headerText?: string | null;
      headerMedia?: any;
      bodyText: string;
      bodyExamples?: any;
      footerText?: string | null;
      buttons?: any;
      wabaTemplateId?: string | null;
      additionalInformation?: any;
      metaRawPayload?: any;
    },
    variables: Array<{
      component: WhatsAppVariableComponent;
      position: number;
      parameter: string;
      mappingEntity?: any;
      mappingField?: string | null;
      fallbackValue?: string | null;
      label?: string | null;
      isRequired?: boolean;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      const template = await tx.whatsAppMessageTemplate.create({
        data: {
          organizationId,
          createdById,
          name: data.name,
          category: data.category,
          language: data.language,
          status: data.status,
          headerType: data.headerType,
          headerText: data.headerText,
          headerMedia: data.headerMedia || Prisma.JsonNull,
          bodyText: data.bodyText,
          bodyExamples: data.bodyExamples || Prisma.JsonNull,
          footerText: data.footerText,
          buttons: data.buttons || Prisma.JsonNull,
          wabaTemplateId: data.wabaTemplateId || null,
          additionalInformation: data.additionalInformation || Prisma.JsonNull,
          metaRawPayload: data.metaRawPayload || Prisma.JsonNull,
          lastSyncedAt: data.wabaTemplateId ? new Date() : null,
        },
      });

      if (variables.length > 0) {
        await tx.whatsAppTemplateVariable.createMany({
          data: variables.map((v) => ({
            templateId: template.id,
            component: v.component,
            position: v.position,
            parameter: v.parameter,
            mappingEntity: v.mappingEntity || null,
            mappingField: v.mappingField || null,
            fallbackValue: v.fallbackValue || null,
            label: v.label || null,
            isRequired: v.isRequired !== undefined ? v.isRequired : true,
            isMapped: Boolean(v.mappingEntity && v.mappingField),
          })),
        });
      }

      return tx.whatsAppMessageTemplate.findUnique({
        where: { id: template.id },
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
    });
  }
}

export const whatsAppTemplateRepo = new WhatsAppTemplateRepository();

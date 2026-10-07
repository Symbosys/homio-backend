import { prisma } from "../../../lib/prisma.js";
import { Prisma, FollowUpConfigType } from "../../../types/types.js";
import type {
  CreateFollowUpConfigInput,
  UpdateFollowUpConfigInput,
} from "../validators/auto-followup.validator.js";

export type OrgFollowUpConfigWithSteps = Prisma.OrgFollowUpConfigGetPayload<{
  include: {
    leadSteps: {
      include: { template: { include: { variables: true } } };
    };
    meetingSteps: {
      include: { template: { include: { variables: true } } };
    };
    createdBy?: {
      select: { id: true; firstName: true; lastName: true; email: true };
    };
  };
}>;

/**
 * Auto Follow-Up Configuration Repository
 * Handles tenant-scoped CRUD operations for follow-up configurations and nested step rules.
 */
export class AutoFollowUpConfigRepository {
  /**
   * Create a new organization follow-up configuration with nested step rules.
   *
   * @param organizationId - Tenant organization UUID
   * @param data - Configuration payload with steps
   * @param createdById - User ID creating the configuration
   * @param tx - Optional transactional client
   * @returns Newly created OrgFollowUpConfig with nested steps
   */
  async createConfig(
    organizationId: string,
    data: CreateFollowUpConfigInput,
    createdById?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx || prisma;

    // If marked as default, unset any other default for this type within the organization
    if (data.isDefault) {
      await db.orgFollowUpConfig.updateMany({
        where: {
          organizationId,
          type: data.type,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    return db.orgFollowUpConfig.create({
      data: {
        organizationId,
        type: data.type,
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true,
        isDefault: data.isDefault ?? false,
        preferredSendTime: data.preferredSendTime ?? "10:00",
        meetingTypes: data.meetingTypes ?? [],
        additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
        createdById,
        leadSteps:
          data.type === FollowUpConfigType.LEAD_NO_RESPONSE && data.leadSteps?.length
            ? {
                create: data.leadSteps.map((step, idx) => ({
                  organizationId,
                  stepOrder: step.stepOrder ?? idx + 1,
                  dayOffset: Number(step.dayOffset) || 1,
                  channel: step.channel,
                  templateId:
                    step.templateId && typeof step.templateId === "string" && step.templateId.trim()
                      ? step.templateId.trim()
                      : null,
                  customVariables: step.customVariables as Prisma.InputJsonValue,
                  isFinalStep: step.isFinalStep ?? idx === data.leadSteps!.length - 1,
                  isActive: step.isActive ?? true,
                  additionalInformation: step.additionalInformation as Prisma.InputJsonValue,
                })),
              }
            : undefined,
        meetingSteps:
          data.type === FollowUpConfigType.MEETING_REMINDER && data.meetingSteps?.length
            ? {
                create: data.meetingSteps.map((step, idx) => ({
                  organizationId,
                  stepOrder: step.stepOrder ?? idx + 1,
                  intervalUnit: step.intervalUnit,
                  intervalValue: Number(step.intervalValue) || 1,
                  channel: step.channel,
                  templateId:
                    step.templateId && typeof step.templateId === "string" && step.templateId.trim()
                      ? step.templateId.trim()
                      : null,
                  dynamicTimeVariableFormat: step.dynamicTimeVariableFormat,
                  customVariables: step.customVariables as Prisma.InputJsonValue,
                  isActive: step.isActive ?? true,
                  additionalInformation: step.additionalInformation as Prisma.InputJsonValue,
                })),
              }
            : undefined,
      },
      include: {
        leadSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: true },
        },
        meetingSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: true },
        },
      },
    });
  }

  /**
   * Update an existing configuration and replace/synchronize its steps if provided.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Configuration UUID
   * @param data - Partial update payload
   * @returns Updated OrgFollowUpConfig
   */
  async updateConfig(
    organizationId: string,
    id: string,
    data: UpdateFollowUpConfigInput,
  ) {
    return prisma.$transaction(async (tx) => {
      // If setting as default, clear existing defaults for this type
      if (data.isDefault) {
        const existing = await tx.orgFollowUpConfig.findUnique({
          where: { id },
          select: { type: true },
        });

        const targetType = data.type || existing?.type;
        if (targetType) {
          await tx.orgFollowUpConfig.updateMany({
            where: {
              organizationId,
              type: targetType,
              isDefault: true,
              id: { not: id },
            },
            data: { isDefault: false },
          });
        }
      }

      // If leadSteps are explicitly supplied, replace existing steps
      if (data.leadSteps !== undefined) {
        await tx.leadFollowUpStep.deleteMany({
          where: { configId: id, organizationId },
        });

        if (data.leadSteps.length > 0) {
          await tx.leadFollowUpStep.createMany({
            data: data.leadSteps.map((step, idx) => ({
              configId: id,
              organizationId,
              stepOrder: step.stepOrder ?? idx + 1,
              dayOffset: Number(step.dayOffset) || 1,
              channel: step.channel,
              templateId:
                step.templateId && typeof step.templateId === "string" && step.templateId.trim()
                  ? step.templateId.trim()
                  : null,
              customVariables: step.customVariables as Prisma.InputJsonValue,
              isFinalStep: step.isFinalStep ?? idx === data.leadSteps!.length - 1,
              isActive: step.isActive ?? true,
              additionalInformation: step.additionalInformation as Prisma.InputJsonValue,
            })),
          });
        }
      }

      // If meetingSteps are explicitly supplied, replace existing steps
      if (data.meetingSteps !== undefined) {
        await tx.meetingFollowUpStep.deleteMany({
          where: { configId: id, organizationId },
        });

        if (data.meetingSteps.length > 0) {
          await tx.meetingFollowUpStep.createMany({
            data: data.meetingSteps.map((step, idx) => ({
              configId: id,
              organizationId,
              stepOrder: step.stepOrder ?? idx + 1,
              intervalUnit: step.intervalUnit,
              intervalValue: Number(step.intervalValue) || 1,
              channel: step.channel,
              templateId:
                step.templateId && typeof step.templateId === "string" && step.templateId.trim()
                  ? step.templateId.trim()
                  : null,
              dynamicTimeVariableFormat: step.dynamicTimeVariableFormat,
              customVariables: step.customVariables as Prisma.InputJsonValue,
              isActive: step.isActive ?? true,
              additionalInformation: step.additionalInformation as Prisma.InputJsonValue,
            })),
          });
        }
      }

      const { leadSteps, meetingSteps, ...directUpdates } = data;

      return tx.orgFollowUpConfig.update({
        where: { id },
        data: {
          ...directUpdates,
          additionalInformation: directUpdates.additionalInformation as Prisma.InputJsonValue,
        },
        include: {
          leadSteps: {
            orderBy: { stepOrder: "asc" },
            include: { template: true },
          },
          meetingSteps: {
            orderBy: { stepOrder: "asc" },
            include: { template: true },
          },
        },
      });
    });
  }

  /**
   * Get configuration by ID scoped to tenant.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Configuration UUID
   * @returns OrgFollowUpConfig with nested steps and templates or null
   */
  async getConfigById(
    organizationId: string,
    id: string,
  ): Promise<OrgFollowUpConfigWithSteps | null> {
    const config = await prisma.orgFollowUpConfig.findFirst({
      where: { id, organizationId },
      include: {
        leadSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
        meetingSteps: {
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
      },
    });
    return config as OrgFollowUpConfigWithSteps | null;
  }

  /**
   * Get the default active configuration for a specific follow-up type within an organization.
   * Falls back to the latest active config if no explicit default is marked.
   *
   * @param organizationId - Tenant organization UUID
   * @param type - FollowUpConfigType
   * @returns Active default OrgFollowUpConfig or null
   */
  async getDefaultConfig(
    organizationId: string,
    type: FollowUpConfigType,
  ): Promise<OrgFollowUpConfigWithSteps | null> {
    // 1. First attempt to find explicit default
    const explicitDefault = await prisma.orgFollowUpConfig.findFirst({
      where: {
        organizationId,
        type,
        isActive: true,
        isDefault: true,
      },
      include: {
        leadSteps: {
          where: { isActive: true },
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
        meetingSteps: {
          where: { isActive: true },
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
      },
    });

    if (explicitDefault) return explicitDefault as OrgFollowUpConfigWithSteps;

    // 2. Fall back to any active config of that type
    const fallback = await prisma.orgFollowUpConfig.findFirst({
      where: {
        organizationId,
        type,
        isActive: true,
      },
      include: {
        leadSteps: {
          where: { isActive: true },
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
        meetingSteps: {
          where: { isActive: true },
          orderBy: { stepOrder: "asc" },
          include: { template: { include: { variables: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return fallback as OrgFollowUpConfigWithSteps | null;
  }

  /**
   * List paginated configurations with optional search and type filters.
   *
   * @param organizationId - Tenant organization UUID
   * @param params - Filtering and pagination parameters
   */
  async listConfigs(
    organizationId: string,
    params: {
      type?: FollowUpConfigType;
      isActive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 20;
    const skip = (page - 1) * limit;

    const where: Prisma.OrgFollowUpConfigWhereInput = {
      organizationId,
      ...(params.type ? { type: params.type } : {}),
      ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { description: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.orgFollowUpConfig.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        include: {
          leadSteps: {
            orderBy: { stepOrder: "asc" },
            include: { template: { select: { id: true, name: true, status: true } } },
          },
          meetingSteps: {
            orderBy: { stepOrder: "asc" },
            include: { template: { select: { id: true, name: true, status: true } } },
          },
          _count: {
            select: { enrollments: true },
          },
        },
      }),
      prisma.orgFollowUpConfig.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Delete a configuration and its step cascades.
   *
   * @param organizationId - Tenant organization UUID
   * @param id - Configuration UUID
   */
  async deleteConfig(organizationId: string, id: string) {
    return prisma.orgFollowUpConfig.deleteMany({
      where: { id, organizationId },
    });
  }
}

export const autoFollowUpConfigRepo = new AutoFollowUpConfigRepository();

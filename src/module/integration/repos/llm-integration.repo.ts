import { prisma } from "../../../lib/prisma.js";
import {
  LlmCredentialAuditAction,
  LlmCredentialStatus,
  LlmModelType,
  LlmProvider,
  LlmUsageStatus,
  Prisma,
} from "../../../types/types.js";

/**
 * Fields returned to API clients. The raw `apiKey` is loaded only for verification.
 */
const publicCredentialSelect = {
  id: true,
  organizationId: true,
  provider: true,
  status: true,
  externalAccountId: true,
  verifiedAt: true,
  lastVerifiedAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  secretUpdatedAt: true,
  createdById: true,
  updatedById: true,
  additionalInformation: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrganizationLlmCredentialSelect;

/**
 * Partial write payload for `OrganizationLlmSetting`.
 * Undefined keys are omitted by the caller so unmodified columns stay unchanged.
 */
export type LlmSettingPatch = {
  isAutoReplyEnabled?: boolean;
  activeProvider?: LlmProvider | null;
  activeModelId?: string | null;
  activeEmbeddingProvider?: LlmProvider | null;
  activeEmbeddingModelId?: string | null;
  systemInstruction?: string | null;
  temperature?: Prisma.Decimal | null;
  maxOutputTokens?: number | null;
  additionalInformation?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  updatedById?: string | null;
};

const settingInclude = {
  activeModel: {
    select: {
      id: true,
      provider: true,
      modelType: true,
      modelKey: true,
      displayName: true,
      description: true,
      contextWindow: true,
      maxOutputTokens: true,
      embeddingDimensions: true,
      supportsVision: true,
      supportsTools: true,
      isActive: true,
      isDeprecated: true,
      sortOrder: true,
    },
  },
  activeEmbeddingModel: {
    select: {
      id: true,
      provider: true,
      modelType: true,
      modelKey: true,
      displayName: true,
      description: true,
      contextWindow: true,
      maxOutputTokens: true,
      embeddingDimensions: true,
      supportsVision: true,
      supportsTools: true,
      isActive: true,
      isDeprecated: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.OrganizationLlmSettingInclude;

/**
 * Repository for tenant LLM credentials, the platform model catalog, and org reply settings.
 * Every credential and setting query is scoped by `organizationId`.
 */
export class LlmIntegrationRepository {
  /**
   * Lists catalog rows the organization may select.
   * Inactive and deprecated rows are hidden unless `includeInactive` is true.
   * @param filters Provider, modelType and search filters from the query string
   */
  async listModels(filters: {
    provider?: LlmProvider;
    modelType?: LlmModelType;
    search?: string;
    includeInactive?: boolean;
  }) {
    return prisma.llmModelCatalog.findMany({
      where: {
        ...(filters.provider ? { provider: filters.provider } : {}),
        ...(filters.modelType ? { modelType: filters.modelType } : {}),
        ...(filters.includeInactive ? {} : { isActive: true, isDeprecated: false }),
        ...(filters.search
          ? {
              OR: [
                { modelKey: { contains: filters.search, mode: "insensitive" } },
                { displayName: { contains: filters.search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ provider: "asc" }, { sortOrder: "asc" }, { displayName: "asc" }],
    });
  }

  /**
   * Loads one catalog row by id. Inactive rows remain readable so a saved setting can still render.
   * @param modelId Catalog primary key
   */
  async findModelById(modelId: string) {
    return prisma.llmModelCatalog.findUnique({
      where: { id: modelId },
    });
  }

  /**
   * Lists the organization's saved provider keys without selecting `apiKey`.
   * @param organizationId Tenant id from the authenticated user
   */
  async listCredentials(organizationId: string) {
    return prisma.organizationLlmCredential.findMany({
      where: { organizationId },
      orderBy: { provider: "asc" },
    });
  }

  /**
   * Loads one credential including the raw key. Callers must mask the key before responding.
   * @param organizationId Tenant id
   * @param provider Vendor
   */
  async findCredential(organizationId: string, provider: LlmProvider) {
    return prisma.organizationLlmCredential.findUnique({
      where: {
        organizationId_provider: { organizationId, provider },
      },
    });
  }

  /**
   * Inserts or replaces the API key for one organization and provider.
   * A replaced key returns to `PENDING_VERIFICATION` until a live check succeeds.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param data Key fields and the acting employee
   * @param isCreate True when no row exists yet
   */
  async saveCredential(
    organizationId: string,
    provider: LlmProvider,
    data: {
      apiKey: string;
      externalAccountId?: string | null;
      additionalInformation?: Prisma.InputJsonValue | null;
      employeeId: string | null;
    },
    isCreate: boolean,
  ) {
    const now = new Date();
    const additionalInformation =
      data.additionalInformation === undefined
        ? undefined
        : data.additionalInformation === null
          ? Prisma.JsonNull
          : data.additionalInformation;

    if (isCreate) {
      return prisma.organizationLlmCredential.create({
        data: {
          organizationId,
          provider,
          status: LlmCredentialStatus.PENDING_VERIFICATION,
          apiKey: data.apiKey,
          externalAccountId: data.externalAccountId ?? null,
          additionalInformation: additionalInformation ?? Prisma.JsonNull,
          secretUpdatedAt: now,
          verifiedAt: null,
          lastVerifiedAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
          createdById: data.employeeId,
          updatedById: data.employeeId,
        },
        select: publicCredentialSelect,
      });
    }

    return prisma.organizationLlmCredential.update({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      data: {
        status: LlmCredentialStatus.PENDING_VERIFICATION,
        apiKey: data.apiKey,
        secretUpdatedAt: now,
        verifiedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedById: data.employeeId,
        ...(data.externalAccountId !== undefined
          ? { externalAccountId: data.externalAccountId }
          : {}),
        ...(additionalInformation !== undefined ? { additionalInformation } : {}),
      },
      select: publicCredentialSelect,
    });
  }

  /**
   * Marks a credential active after the provider accepts the key.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param employeeId Acting employee, when the user has an employee profile
   */
  async markCredentialVerified(
    organizationId: string,
    provider: LlmProvider,
    employeeId: string | null,
  ) {
    const now = new Date();
    return prisma.organizationLlmCredential.update({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      data: {
        status: LlmCredentialStatus.ACTIVE,
        verifiedAt: now,
        lastVerifiedAt: now,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedById: employeeId,
      },
      select: publicCredentialSelect,
    });
  }

  /**
   * Marks a credential invalid after the provider rejects the key.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param errorCode Provider status code
   * @param errorMessage Scrubbed provider message
   * @param employeeId Acting employee
   */
  async markCredentialInvalid(
    organizationId: string,
    provider: LlmProvider,
    errorCode: string,
    errorMessage: string,
    employeeId: string | null,
  ) {
    return prisma.organizationLlmCredential.update({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      data: {
        status: LlmCredentialStatus.INVALID,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        lastVerifiedAt: new Date(),
        updatedById: employeeId,
      },
      select: publicCredentialSelect,
    });
  }

  /**
   * Stores a verification error without changing credential status.
   * Used for rate limits and provider outages.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param errorCode Provider status code
   * @param errorMessage Scrubbed provider message
   */
  async recordCredentialError(
    organizationId: string,
    provider: LlmProvider,
    errorCode: string,
    errorMessage: string,
  ) {
    return prisma.organizationLlmCredential.update({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      data: {
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        lastVerifiedAt: new Date(),
      },
      select: publicCredentialSelect,
    });
  }

  /**
   * Disables a credential. The key remains stored until the organization deletes it.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param employeeId Acting employee
   */
  async disableCredential(
    organizationId: string,
    provider: LlmProvider,
    employeeId: string | null,
  ) {
    return prisma.organizationLlmCredential.update({
      where: {
        organizationId_provider: { organizationId, provider },
      },
      data: {
        status: LlmCredentialStatus.DISABLED,
        updatedById: employeeId,
      },
      select: publicCredentialSelect,
    });
  }

  /**
   * Deletes the credential row. Audit rows keep `provider` after `credentialId` is set null.
   * @param credentialId Credential primary key
   */
  async deleteCredential(credentialId: string) {
    return prisma.organizationLlmCredential.delete({
      where: { id: credentialId },
    });
  }

  /**
   * Loads the organization's single reply setting, including the selected catalog model.
   * @param organizationId Tenant id
   */
  async findSetting(organizationId: string) {
    return prisma.organizationLlmSetting.findUnique({
      where: { organizationId },
      include: settingInclude,
    });
  }

  /**
   * Creates or updates the organization reply setting.
   * On update, only keys present on `patch` are written.
   * @param organizationId Tenant id
   * @param patch Partial column patch
   */
  async saveSetting(organizationId: string, patch: LlmSettingPatch) {
    const existing = await prisma.organizationLlmSetting.findUnique({
      where: { organizationId },
      select: { id: true },
    });

    if (!existing) {
      return prisma.organizationLlmSetting.create({
        data: {
          organizationId,
          isAutoReplyEnabled: patch.isAutoReplyEnabled ?? false,
          activeProvider: patch.activeProvider ?? null,
          activeModelId: patch.activeModelId ?? null,
          activeEmbeddingProvider: patch.activeEmbeddingProvider ?? null,
          activeEmbeddingModelId: patch.activeEmbeddingModelId ?? null,
          systemInstruction: patch.systemInstruction ?? null,
          temperature: patch.temperature ?? null,
          maxOutputTokens: patch.maxOutputTokens ?? null,
          additionalInformation: patch.additionalInformation ?? Prisma.JsonNull,
          updatedById: patch.updatedById ?? null,
        },
        include: settingInclude,
      });
    }

    return prisma.organizationLlmSetting.update({
      where: { organizationId },
      data: patch,
      include: settingInclude,
    });
  }

  /**
   * Turns auto-reply off when the active provider is the one being changed.
   * The selected model is kept so the organization can verify the key and turn replies back on.
   * @param organizationId Tenant id
   * @param provider Provider whose key changed or failed verification
   * @param employeeId Acting employee
   * @returns True when a setting row was updated
   */
  async disableAutoReplyForProvider(
    organizationId: string,
    provider: LlmProvider,
    employeeId: string | null,
  ) {
    const setting = await prisma.organizationLlmSetting.findUnique({
      where: { organizationId },
      select: { id: true, activeProvider: true, isAutoReplyEnabled: true },
    });

    if (!setting || setting.activeProvider !== provider || !setting.isAutoReplyEnabled) {
      return false;
    }

    await prisma.organizationLlmSetting.update({
      where: { organizationId },
      data: {
        isAutoReplyEnabled: false,
        updatedById: employeeId,
      },
    });
    return true;
  }

  /**
   * Clears active chat or embedding model when its provider credential is deleted.
   * @param organizationId Tenant id
   * @param provider Deleted provider
   * @param employeeId Acting employee
   */
  async clearActiveProvider(
    organizationId: string,
    provider: LlmProvider,
    employeeId: string | null,
  ) {
    const setting = await prisma.organizationLlmSetting.findUnique({
      where: { organizationId },
      select: { activeProvider: true, activeEmbeddingProvider: true },
    });

    if (!setting) return false;

    const clearsChat = setting.activeProvider === provider;
    const clearsEmbedding = setting.activeEmbeddingProvider === provider;

    if (!clearsChat && !clearsEmbedding) {
      return false;
    }

    await prisma.organizationLlmSetting.update({
      where: { organizationId },
      data: {
        ...(clearsChat
          ? {
              isAutoReplyEnabled: false,
              activeProvider: null,
              activeModelId: null,
            }
          : {}),
        ...(clearsEmbedding
          ? {
              activeEmbeddingProvider: null,
              activeEmbeddingModelId: null,
            }
          : {}),
        updatedById: employeeId,
      },
    });
    return true;
  }

  /**
   * Appends a credential audit row. The raw API key is never written here.
   * @param input Audit payload scoped to the tenant
   */
  async createAudit(input: {
    organizationId: string;
    provider: LlmProvider;
    credentialId?: string | null;
    action: LlmCredentialAuditAction;
    actorEmployeeId?: string | null;
    detail?: Prisma.InputJsonValue | null;
  }) {
    return prisma.organizationLlmCredentialAudit.create({
      data: {
        organizationId: input.organizationId,
        provider: input.provider,
        credentialId: input.credentialId ?? null,
        action: input.action,
        actorEmployeeId: input.actorEmployeeId ?? null,
        detail: input.detail ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Lists audit events for one provider inside the tenant.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param page 1-based page
   * @param limit Page size
   */
  async listAudits(organizationId: string, provider: LlmProvider, page: number, limit: number) {
    const where = { organizationId, provider };
    const [items, total] = await Promise.all([
      prisma.organizationLlmCredentialAudit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organizationLlmCredentialAudit.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Lists recorded LLM calls for the tenant. This table is written later by the reply worker.
   * @param organizationId Tenant id
   * @param page 1-based page
   * @param limit Page size
   * @param provider Optional vendor filter
   */
  async listUsages(
    organizationId: string,
    page: number,
    limit: number,
    provider?: LlmProvider,
  ) {
    const where = {
      organizationId,
      ...(provider ? { provider } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.organizationLlmUsage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organizationLlmUsage.count({ where }),
    ]);
    return { items, total };
  }

  /**
   * Appends an LLM usage call row in organization_llm_usages table.
   * Invoked whenever an AI inference or WhatsApp auto-reply is generated.
   * @param data Full usage metrics and contextual IDs
   */
  async recordUsage(data: {
    organizationId: string;
    provider: LlmProvider;
    modelKey: string;
    modelCatalogId?: string | null;
    credentialId?: string | null;
    conversationId?: string | null;
    chatMessageId?: string | null;
    status: LlmUsageStatus;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    latencyMs?: number | null;
    providerRequestId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    additionalInformation?: Prisma.InputJsonValue | null;
  }) {
    return prisma.organizationLlmUsage.create({
      data: {
        organizationId: data.organizationId,
        provider: data.provider,
        modelKey: data.modelKey,
        modelCatalogId: data.modelCatalogId ?? null,
        credentialId: data.credentialId ?? null,
        conversationId: data.conversationId ?? null,
        chatMessageId: data.chatMessageId ?? null,
        status: data.status,
        promptTokens: data.promptTokens ?? null,
        completionTokens: data.completionTokens ?? null,
        totalTokens: data.totalTokens ?? null,
        latencyMs: data.latencyMs ?? null,
        providerRequestId: data.providerRequestId ?? null,
        errorCode: data.errorCode ?? null,
        errorMessage: data.errorMessage ?? null,
        additionalInformation: data.additionalInformation ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Inserts a platform catalog model.

   * @param data Validated catalog fields
   */
  async createModel(data: {
    provider: LlmProvider;
    modelType?: LlmModelType;
    modelKey: string;
    displayName: string;
    description?: string | null;
    contextWindow: number;
    maxOutputTokens?: number | null;
    embeddingDimensions?: number | null;
    supportsVision?: boolean;
    supportsTools?: boolean;
    isActive?: boolean;
    isDeprecated?: boolean;
    sortOrder?: number;
    additionalInformation?: Prisma.InputJsonValue | null;
  }) {
    return prisma.llmModelCatalog.create({
      data: {
        provider: data.provider,
        modelType: data.modelType ?? LlmModelType.CHAT,
        modelKey: data.modelKey,
        displayName: data.displayName,
        description: data.description ?? null,
        contextWindow: data.contextWindow,
        maxOutputTokens: data.maxOutputTokens ?? null,
        embeddingDimensions: data.embeddingDimensions ?? null,
        supportsVision: data.supportsVision ?? false,
        supportsTools: data.supportsTools ?? false,
        isActive: data.isActive ?? true,
        isDeprecated: data.isDeprecated ?? false,
        sortOrder: data.sortOrder ?? 0,
        additionalInformation: data.additionalInformation ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Updates a catalog model. Provider cannot change after creation.
   * @param modelId Catalog id
   * @param data Partial fields
   */
  async updateModel(
    modelId: string,
    data: Prisma.LlmModelCatalogUpdateInput,
  ) {
    return prisma.llmModelCatalog.update({
      where: { id: modelId },
      data,
    });
  }

  /**
   * Deletes a catalog model that is not selected by any organization.
   * @param modelId Catalog id
   */
  async deleteModel(modelId: string) {
    return prisma.llmModelCatalog.delete({
      where: { id: modelId },
    });
  }
}

export const llmIntegrationRepo = new LlmIntegrationRepository();

import {
  LlmCredentialAuditAction,
  LlmCredentialStatus,
  LlmModelType,
  LlmProvider,
  Prisma,
  statusCode,
} from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { llmIntegrationRepo, type LlmSettingPatch } from "../repos/llm-integration.repo.js";
import type { UpdateLlmSettingDto, UpsertLlmCredentialDto, CreateLlmModelDto, UpdateLlmModelDto } from "../validators/llm-integration.validator.js";
import { LlmProviderVerificationError, llmProviderVerifier } from "./llm-provider-verifier.js";

/**
 * Last four characters of a raw API key, safe to show in the integration panel.
 * @param apiKey Raw provider key
 */
export function maskApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  const last4 = trimmed.slice(-4);
  return `••••${last4}`;
}

type CredentialWithKey = { apiKey: string };

/**
 * Strips the raw key and adds the display hint.
 * @param row Credential row that includes `apiKey`
 */
export function toPublicCredential<T extends CredentialWithKey>(row: T) {
  const { apiKey, ...rest } = row;
  return {
    ...rest,
    keyHint: maskApiKey(apiKey),
  };
}

type SettingRow = {
  temperature: Prisma.Decimal | null;
};

/**
 * Converts Prisma Decimal temperature to a JSON number.
 * @param row Setting row
 */
export function serializeSetting<T extends SettingRow>(row: T) {
  return {
    ...row,
    temperature: row.temperature === null ? null : Number(row.temperature),
  };
}

/**
 * Builds a page envelope for audit and usage lists.
 * @param items Page rows
 * @param total Matching row count
 * @param page 1-based page
 * @param limit Page size
 */
function toPage<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}

/**
 * Tenant LLM integration: catalog, bring-your-own API keys, and the active model.
 * Responses never include `apiKey`. Auto-reply stays off until the selected provider key is ACTIVE.
 */
export class LlmIntegrationService {
  /**
   * Lists models the organization can select.
   * @param filters Catalog query
   */
  async listModels(filters: { provider?: LlmProvider; modelType?: LlmModelType; search?: string; includeInactive?: boolean }) {
    return llmIntegrationRepo.listModels(filters);
  }

  /**
   * Returns one catalog model, including inactive rows so a saved selection can still render.
   * @param modelId Catalog id
   */
  async getModel(modelId: string) {
    const model = await llmIntegrationRepo.findModelById(modelId);
    if (!model) {
      throw new ErrorResponse("LLM model not found", statusCode.Not_Found);
    }
    return model;
  }

  /**
   * Lists saved provider credentials for the tenant. Raw keys are not selected.
   * @param organizationId Tenant id
   */
  async listCredentials(organizationId: string) {
    const rows = await llmIntegrationRepo.listCredentials(organizationId);
    return rows.map((row) => toPublicCredential(row));
  }

  /**
   * Returns one credential without the raw key.
   * The list endpoint cannot show a hint because it does not load `apiKey`.
   * This endpoint loads the key only to build `keyHint`, then drops it.
   * @param organizationId Tenant id
   * @param provider Vendor
   */
  async getCredential(organizationId: string, provider: LlmProvider) {
    const row = await llmIntegrationRepo.findCredential(organizationId, provider);
    if (!row) {
      throw new ErrorResponse("LLM credential not found for this provider", statusCode.Not_Found);
    }
    return toPublicCredential(row);
  }

  /**
   * Saves the raw API key for one provider and writes a CREATED or ROTATED audit row.
   * Replacing a key moves it back to pending verification and turns auto-reply off for that provider.
   * @param organizationId Tenant id
   * @param provider Vendor from the route
   * @param input Validated body
   * @param employeeId Acting employee, or null when the user has no employee profile
   */
  async saveCredential(
    organizationId: string,
    provider: LlmProvider,
    input: UpsertLlmCredentialDto,
    employeeId: string | null,
  ) {
    const existing = await llmIntegrationRepo.findCredential(organizationId, provider);
    const saved = await llmIntegrationRepo.saveCredential(
      organizationId,
      provider,
      {
        apiKey: input.apiKey,
        externalAccountId: input.externalAccountId,
        additionalInformation: input.additionalInformation as Prisma.InputJsonValue | null | undefined,
        employeeId,
      },
      !existing,
    );

    await llmIntegrationRepo.createAudit({
      organizationId,
      provider,
      credentialId: saved.id,
      action: existing ? LlmCredentialAuditAction.ROTATED : LlmCredentialAuditAction.CREATED,
      actorEmployeeId: employeeId,
      detail: { status: saved.status },
    });

    await llmIntegrationRepo.disableAutoReplyForProvider(organizationId, provider, employeeId);

    return {
      ...saved,
      keyHint: maskApiKey(input.apiKey),
    };
  }

  /**
   * Checks the stored key with the provider and marks the credential ACTIVE or INVALID.
   * Rate limits and provider outages do not mark the key invalid.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param employeeId Acting employee
   */
  async verifyCredential(organizationId: string, provider: LlmProvider, employeeId: string | null) {
    const credential = await llmIntegrationRepo.findCredential(organizationId, provider);
    if (!credential) {
      throw new ErrorResponse("LLM credential not found for this provider", statusCode.Not_Found);
    }

    try {
      await llmProviderVerifier.verify(provider, credential.apiKey);
    } catch (error) {
      if (!(error instanceof LlmProviderVerificationError)) {
        throw error;
      }

      const rejected = error.httpStatus === 401 || error.httpStatus === 403;
      if (rejected) {
        await llmIntegrationRepo.markCredentialInvalid(
          organizationId,
          provider,
          error.errorCode,
          error.message,
          employeeId,
        );
        await llmIntegrationRepo.disableAutoReplyForProvider(organizationId, provider, employeeId);
        await llmIntegrationRepo.createAudit({
          organizationId,
          provider,
          credentialId: credential.id,
          action: LlmCredentialAuditAction.VERIFICATION_FAILED,
          actorEmployeeId: employeeId,
          detail: { errorCode: error.errorCode },
        });
        throw new ErrorResponse("API key was rejected by the provider", statusCode.Bad_Request);
      }

      await llmIntegrationRepo.recordCredentialError(
        organizationId,
        provider,
        error.errorCode,
        error.message,
      );

      if (error.httpStatus === 429) {
        throw new ErrorResponse(
          "The provider rate limit was reached. Try verification again shortly.",
          statusCode.Too_Many_Requests,
        );
      }

      throw new ErrorResponse(
        "The provider could not be reached to verify this API key",
        statusCode.Bad_Request,
      );
    }

    const updated = await llmIntegrationRepo.markCredentialVerified(
      organizationId,
      provider,
      employeeId,
    );
    await llmIntegrationRepo.createAudit({
      organizationId,
      provider,
      credentialId: credential.id,
      action: LlmCredentialAuditAction.VERIFIED,
      actorEmployeeId: employeeId,
      detail: { status: LlmCredentialStatus.ACTIVE },
    });

    return {
      ...updated,
      keyHint: maskApiKey(credential.apiKey),
    };
  }

  /**
   * Disables a credential without deleting the key.
   * Auto-reply is turned off when this provider is the active one.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param employeeId Acting employee
   */
  async disableCredential(organizationId: string, provider: LlmProvider, employeeId: string | null) {
    const existing = await llmIntegrationRepo.findCredential(organizationId, provider);
    if (!existing) {
      throw new ErrorResponse("LLM credential not found for this provider", statusCode.Not_Found);
    }

    if (existing.status === LlmCredentialStatus.DISABLED) {
      return toPublicCredential(existing);
    }

    const updated = await llmIntegrationRepo.disableCredential(organizationId, provider, employeeId);
    await llmIntegrationRepo.disableAutoReplyForProvider(organizationId, provider, employeeId);
    await llmIntegrationRepo.createAudit({
      organizationId,
      provider,
      credentialId: existing.id,
      action: LlmCredentialAuditAction.DISABLED,
      actorEmployeeId: employeeId,
      detail: { previousStatus: existing.status },
    });

    return {
      ...updated,
      keyHint: maskApiKey(existing.apiKey),
    };
  }

  /**
   * Deletes the provider key. When that provider is selected, the active model is cleared
   * and auto-reply is turned off. The audit row survives with `credentialId` set null by the database.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param employeeId Acting employee
   */
  async deleteCredential(organizationId: string, provider: LlmProvider, employeeId: string | null) {
    const existing = await llmIntegrationRepo.findCredential(organizationId, provider);
    if (!existing) {
      throw new ErrorResponse("LLM credential not found for this provider", statusCode.Not_Found);
    }

    await llmIntegrationRepo.createAudit({
      organizationId,
      provider,
      credentialId: existing.id,
      action: LlmCredentialAuditAction.DELETED,
      actorEmployeeId: employeeId,
      detail: { previousStatus: existing.status },
    });
    await llmIntegrationRepo.clearActiveProvider(organizationId, provider, employeeId);
    await llmIntegrationRepo.deleteCredential(existing.id);

    return { provider, deleted: true };
  }

  /**
   * Lists credential audit events for one provider.
   * @param organizationId Tenant id
   * @param provider Vendor
   * @param page 1-based page
   * @param limit Page size
   */
  async listAudits(organizationId: string, provider: LlmProvider, page: number, limit: number) {
    const { items, total } = await llmIntegrationRepo.listAudits(organizationId, provider, page, limit);
    return toPage(items, total, page, limit);
  }

  /**
   * Returns the organization reply setting. Missing settings are represented as null.
   * @param organizationId Tenant id
   */
  async getSetting(organizationId: string) {
    const setting = await llmIntegrationRepo.findSetting(organizationId);
    return setting ? serializeSetting(setting) : null;
  }

  /**
   * Updates the active model and reply options.
   * `activeProvider` is taken from the catalog row so a Gemini model cannot be stored as OpenAI.
   * Auto-reply can be enabled only when that provider's credential status is ACTIVE.
   * @param organizationId Tenant id
   * @param input Partial body
   * @param employeeId Acting employee
   */
  async updateSetting(
    organizationId: string,
    input: UpdateLlmSettingDto,
    employeeId: string | null,
  ) {
    const existing = await llmIntegrationRepo.findSetting(organizationId);
    const nextModelId =
      input.activeModelId !== undefined ? input.activeModelId : (existing?.activeModelId ?? null);

    const nextModel = nextModelId ? await llmIntegrationRepo.findModelById(nextModelId) : null;
    if (nextModelId && !nextModel) {
      throw new ErrorResponse("LLM model not found", statusCode.Not_Found);
    }

    if (input.activeModelId && nextModel && (!nextModel.isActive || nextModel.isDeprecated)) {
      throw new ErrorResponse(
        "This model is inactive or deprecated and cannot be selected",
        statusCode.Bad_Request,
      );
    }

    if (input.activeModelId && nextModel && nextModel.modelType !== LlmModelType.CHAT) {
      throw new ErrorResponse(
        "Only chat models can be selected as the auto-reply model",
        statusCode.Bad_Request,
      );
    }

    let nextEmbeddingModel = null;
    if (input.activeEmbeddingModelId !== undefined) {
      if (input.activeEmbeddingModelId !== null) {
        nextEmbeddingModel = await llmIntegrationRepo.findModelById(input.activeEmbeddingModelId);
        if (!nextEmbeddingModel) {
          throw new ErrorResponse("Embedding model not found", statusCode.Not_Found);
        }
        if (nextEmbeddingModel.modelType !== LlmModelType.EMBEDDING) {
          throw new ErrorResponse(
            "Only embedding models can be selected as the vector embedding model",
            statusCode.Bad_Request,
          );
        }
        if (!nextEmbeddingModel.isActive || nextEmbeddingModel.isDeprecated) {
          throw new ErrorResponse(
            "This embedding model is inactive or deprecated and cannot be selected",
            statusCode.Bad_Request,
          );
        }
        const credential = await llmIntegrationRepo.findCredential(organizationId, nextEmbeddingModel.provider);
        if (!credential || credential.status !== LlmCredentialStatus.ACTIVE) {
          throw new ErrorResponse(
            `Verify ${nextEmbeddingModel.provider} API key before selecting this embedding model`,
            statusCode.Bad_Request,
          );
        }
      }
    }

    const requestedEnabled =
      input.isAutoReplyEnabled !== undefined
        ? input.isAutoReplyEnabled
        : (existing?.isAutoReplyEnabled ?? false);

    if (input.isAutoReplyEnabled === true && !nextModelId) {
      throw new ErrorResponse(
        "Select an active model before enabling AI auto-reply",
        statusCode.Bad_Request,
      );
    }

    const nextEnabled = nextModelId ? requestedEnabled : false;

    if (nextEnabled) {
      if (!nextModel || !nextModel.isActive || nextModel.isDeprecated) {
        throw new ErrorResponse(
          "Select an active model before enabling AI auto-reply",
          statusCode.Bad_Request,
        );
      }
      const credential = await llmIntegrationRepo.findCredential(organizationId, nextModel.provider);
      if (!credential || credential.status !== LlmCredentialStatus.ACTIVE) {
        throw new ErrorResponse(
          "Verify this provider's API key before enabling AI auto-reply",
          statusCode.Bad_Request,
        );
      }
    }

    const tokenCap = nextModel?.maxOutputTokens ?? null;
    if (
      input.maxOutputTokens != null &&
      tokenCap != null &&
      input.maxOutputTokens > tokenCap
    ) {
      throw new ErrorResponse(
        `Max output tokens cannot exceed ${tokenCap} for the selected model`,
        statusCode.Bad_Request,
      );
    }

    const patch: LlmSettingPatch = {
      updatedById: employeeId,
    };

    if (input.isAutoReplyEnabled !== undefined || !nextModelId) {
      patch.isAutoReplyEnabled = nextEnabled;
    }

    if (input.activeModelId !== undefined) {
      patch.activeModelId = nextModel ? nextModel.id : null;
      patch.activeProvider = nextModel ? nextModel.provider : null;
    }

    if (input.activeEmbeddingModelId !== undefined) {
      patch.activeEmbeddingModelId = nextEmbeddingModel ? nextEmbeddingModel.id : null;
      patch.activeEmbeddingProvider = nextEmbeddingModel ? nextEmbeddingModel.provider : null;
    }

    if (input.systemInstruction !== undefined) {
      patch.systemInstruction = input.systemInstruction ? input.systemInstruction : null;
    }

    if (input.temperature !== undefined) {
      patch.temperature =
        input.temperature === null ? null : new Prisma.Decimal(input.temperature);
    }

    if (input.maxOutputTokens !== undefined) {
      patch.maxOutputTokens = input.maxOutputTokens;
    }

    if (input.additionalInformation !== undefined) {
      patch.additionalInformation =
        input.additionalInformation === null
          ? Prisma.JsonNull
          : (input.additionalInformation as Prisma.InputJsonValue);
    }

    const saved = await llmIntegrationRepo.saveSetting(organizationId, patch);
    return serializeSetting(saved);
  }

  /**
   * Lists LLM usage rows for the tenant. The reply worker writes these later.
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
    const { items, total } = await llmIntegrationRepo.listUsages(
      organizationId,
      page,
      limit,
      provider,
    );
    return toPage(items, total, page, limit);
  }

  /**
   * Creates a catalog model for every organization to select.
   * @param input Validated create body
   */
  async createModel(input: CreateLlmModelDto) {
    return llmIntegrationRepo.createModel({
      ...input,
      additionalInformation: input.additionalInformation as Prisma.InputJsonValue | null | undefined,
    });
  }

  /**
   * Updates catalog display and availability fields.
   * A selected model cannot be hard-deleted; callers should deprecate it instead.
   * @param modelId Catalog id
   * @param input Partial body
   */
  async updateModel(modelId: string, input: UpdateLlmModelDto) {
    const existing = await llmIntegrationRepo.findModelById(modelId);
    if (!existing) {
      throw new ErrorResponse("LLM model not found", statusCode.Not_Found);
    }

    const data: Prisma.LlmModelCatalogUpdateInput = {};
    if (input.modelType !== undefined) data.modelType = input.modelType;
    if (input.modelKey !== undefined) data.modelKey = input.modelKey;
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.description !== undefined) data.description = input.description;
    if (input.contextWindow !== undefined) data.contextWindow = input.contextWindow;
    if (input.maxOutputTokens !== undefined) data.maxOutputTokens = input.maxOutputTokens;
    if (input.embeddingDimensions !== undefined) data.embeddingDimensions = input.embeddingDimensions;
    if (input.supportsVision !== undefined) data.supportsVision = input.supportsVision;
    if (input.supportsTools !== undefined) data.supportsTools = input.supportsTools;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.isDeprecated !== undefined) data.isDeprecated = input.isDeprecated;
    if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
    if (input.additionalInformation !== undefined) {
      data.additionalInformation =
        input.additionalInformation === null
          ? Prisma.JsonNull
          : (input.additionalInformation as Prisma.InputJsonValue);
    }

    return llmIntegrationRepo.updateModel(modelId, data);
  }

  /**
   * Deletes an unused catalog model. Models referenced by an organization setting are rejected.
   * @param modelId Catalog id
   */
  async deleteModel(modelId: string) {
    const existing = await llmIntegrationRepo.findModelById(modelId);
    if (!existing) {
      throw new ErrorResponse("LLM model not found", statusCode.Not_Found);
    }

    try {
      await llmIntegrationRepo.deleteModel(modelId);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2003"
      ) {
        throw new ErrorResponse(
          "This model is selected by an organization. Mark it deprecated instead of deleting it.",
          statusCode.Conflict,
        );
      }
      throw error;
    }

    return { id: modelId, deleted: true };
  }
}

export const llmIntegrationService = new LlmIntegrationService();

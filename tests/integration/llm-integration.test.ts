import { describe, expect, it } from "bun:test";
import { AxiosError } from "axios";
import { axiosClient } from "../../src/lib/axios.js";
import { llmIntegrationRepo, type LlmSettingPatch } from "../../src/module/integration/repos/llm-integration.repo.js";
import {
  llmIntegrationService,
  maskApiKey,
} from "../../src/module/integration/services/llm-integration.service.js";
import {
  LlmProviderVerificationError,
  llmProviderVerifier,
  verifyLlmProviderKey,
} from "../../src/module/integration/services/llm-provider-verifier.js";
import {
  listLlmModelsQuerySchema,
  llmCredentialAuditQuerySchema,
  llmPagedQuerySchema,
  updateLlmSettingSchema,
  upsertLlmCredentialSchema,
  validateProviderApiKey,
} from "../../src/module/integration/validators/llm-integration.validator.js";
import {
  LlmCredentialAuditAction,
  LlmCredentialStatus,
  LlmModelType,
  LlmProvider,
  statusCode,
} from "../../src/types/types.js";
import { ErrorResponse } from "../../src/utils/response.util.js";

const ORG_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const OTHER_ORG_ID = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const EMPLOYEE_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
const MODEL_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
const CREDENTIAL_ID = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
const OPENAI_KEY = "sk-proj-test-key-value-1234";
const GEMINI_KEY = "AIzaSyTestGeminiKeyValue5678";
const ANTHROPIC_KEY = "sk-ant-api03-test-key-value-9012";

function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CREDENTIAL_ID,
    organizationId: ORG_ID,
    provider: LlmProvider.OPENAI,
    status: LlmCredentialStatus.PENDING_VERIFICATION,
    apiKey: OPENAI_KEY,
    externalAccountId: null,
    verifiedAt: null,
    lastVerifiedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    secretUpdatedAt: new Date("2026-10-05T00:00:00.000Z"),
    createdById: EMPLOYEE_ID,
    updatedById: EMPLOYEE_ID,
    additionalInformation: null,
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
    updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    ...overrides,
  };
}

function modelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MODEL_ID,
    provider: LlmProvider.OPENAI,
    modelType: LlmModelType.CHAT,
    modelKey: "gpt-4o",
    displayName: "GPT-4o",
    description: null,
    contextWindow: 128000,
    maxOutputTokens: 16384,
    embeddingDimensions: null,
    supportsVision: true,
    supportsTools: true,
    isActive: true,
    isDeprecated: false,
    sortOrder: 1,
    additionalInformation: null,
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
    updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    ...overrides,
  };
}

function settingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66",
    organizationId: ORG_ID,
    isAutoReplyEnabled: false,
    activeProvider: LlmProvider.OPENAI,
    activeModelId: MODEL_ID,
    activeEmbeddingProvider: null,
    activeEmbeddingModelId: null,
    systemInstruction: null,
    temperature: null,
    maxOutputTokens: null,
    updatedById: EMPLOYEE_ID,
    additionalInformation: null,
    createdAt: new Date("2026-10-05T00:00:00.000Z"),
    updatedAt: new Date("2026-10-05T00:00:00.000Z"),
    activeModel: modelRow(),
    activeEmbeddingModel: null,
    ...overrides,
  };
}

describe("LLM integration validators", () => {
  it("accepts a well-formed OpenAI key and optional account id", () => {
    const parsed = upsertLlmCredentialSchema.safeParse({
      params: { provider: LlmProvider.OPENAI },
      body: {
        apiKey: `  ${OPENAI_KEY}  `,
        externalAccountId: "org-openai-1",
        additionalInformation: { label: "production" },
      },
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body.apiKey).toBe(OPENAI_KEY);
    }
  });

  it("rejects a Gemini key saved against OpenAI", () => {
    const parsed = upsertLlmCredentialSchema.safeParse({
      params: { provider: LlmProvider.OPENAI },
      body: { apiKey: GEMINI_KEY },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an OpenAI key saved against Gemini or Anthropic", () => {
    expect(validateProviderApiKey(LlmProvider.GEMINI, OPENAI_KEY)).toContain("AIza");
    expect(validateProviderApiKey(LlmProvider.ANTHROPIC, OPENAI_KEY)).toContain("sk-ant-");
  });

  it("rejects keys that contain whitespace in the middle", () => {
    const parsed = upsertLlmCredentialSchema.safeParse({
      params: { provider: LlmProvider.ANTHROPIC },
      body: { apiKey: "sk-ant-api03-bad key-value" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an unknown provider param", () => {
    const parsed = upsertLlmCredentialSchema.safeParse({
      params: { provider: "MISTRAL" },
      body: { apiKey: OPENAI_KEY },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an empty settings body and an out-of-range temperature", () => {
    expect(updateLlmSettingSchema.safeParse({ body: {} }).success).toBe(false);
    expect(
      updateLlmSettingSchema.safeParse({ body: { temperature: 2.5 } }).success,
    ).toBe(false);
    expect(
      updateLlmSettingSchema.safeParse({
        body: { activeModelId: MODEL_ID, isAutoReplyEnabled: false, maxOutputTokens: 512 },
      }).success,
    ).toBe(true);
  });

  it("coerces catalog and page queries", () => {
    const models = listLlmModelsQuerySchema.safeParse({
      query: { provider: LlmProvider.GEMINI, search: "flash", includeInactive: "true" },
    });
    expect(models.success).toBe(true);
    if (models.success) {
      expect(models.data.query.includeInactive).toBe(true);
      expect(models.data.query.provider).toBe(LlmProvider.GEMINI);
    }

    const audits = llmCredentialAuditQuerySchema.safeParse({
      params: { provider: LlmProvider.OPENAI },
      query: { page: "2", limit: "10" },
    });
    expect(audits.success).toBe(true);
    if (audits.success) {
      expect(audits.data.query.page).toBe(2);
      expect(audits.data.query.limit).toBe(10);
    }

    const usages = llmPagedQuerySchema.safeParse({ query: {} });
    expect(usages.success).toBe(true);
    if (usages.success) {
      expect(usages.data.query.page).toBe(1);
      expect(usages.data.query.limit).toBe(25);
    }
  });

  it("rejects an audit page size above 100", () => {
    const parsed = llmCredentialAuditQuerySchema.safeParse({
      params: { provider: LlmProvider.OPENAI },
      query: { limit: "500" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("LLM provider verifier", () => {
  it("calls OpenAI, Gemini, and Anthropic with the key in headers", async () => {
    const originalGet = axiosClient.get;
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    axiosClient.get = (async (url: string, config?: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: config?.headers ?? {} });
      return { data: { data: [] } };
    }) as typeof axiosClient.get;

    try {
      await verifyLlmProviderKey(LlmProvider.OPENAI, OPENAI_KEY);
      await verifyLlmProviderKey(LlmProvider.GEMINI, GEMINI_KEY);
      await verifyLlmProviderKey(LlmProvider.ANTHROPIC, ANTHROPIC_KEY);
    } finally {
      axiosClient.get = originalGet;
    }

    expect(calls[0]?.url).toBe("https://api.openai.com/v1/models");
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(calls[1]?.url).toContain("generativelanguage.googleapis.com");
    expect(calls[1]?.headers["x-goog-api-key"]).toBe(GEMINI_KEY);
    expect(calls[1]?.url.includes(GEMINI_KEY)).toBe(false);
    expect(calls[2]?.headers["x-api-key"]).toBe(ANTHROPIC_KEY);
    expect(calls[2]?.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("scrubs the raw key from a provider error", async () => {
    const originalGet = axiosClient.get;
    axiosClient.get = (async () => {
      throw new AxiosError(
        "rejected",
        "401",
        undefined,
        undefined,
        {
          status: 401,
          statusText: "Unauthorized",
          headers: {},
          config: {} as never,
          data: { error: { message: `Invalid key ${OPENAI_KEY}` } },
        },
      );
    }) as typeof axiosClient.get;

    try {
      await expect(verifyLlmProviderKey(LlmProvider.OPENAI, OPENAI_KEY)).rejects.toBeInstanceOf(
        LlmProviderVerificationError,
      );
      try {
        await verifyLlmProviderKey(LlmProvider.OPENAI, OPENAI_KEY);
      } catch (error) {
        expect(error).toBeInstanceOf(LlmProviderVerificationError);
        expect((error as LlmProviderVerificationError).message.includes(OPENAI_KEY)).toBe(false);
        expect((error as LlmProviderVerificationError).httpStatus).toBe(401);
      }
    } finally {
      axiosClient.get = originalGet;
    }
  });
});

describe("LLM integration service", () => {
  it("masks the key and never returns apiKey from list or get", async () => {
    const originalList = llmIntegrationRepo.listCredentials;
    const originalFind = llmIntegrationRepo.findCredential;
    llmIntegrationRepo.listCredentials = async () => [credentialRow()] as never;
    llmIntegrationRepo.findCredential = async () => credentialRow() as never;

    try {
      const listed = await llmIntegrationService.listCredentials(ORG_ID);
      const fetched = await llmIntegrationService.getCredential(ORG_ID, LlmProvider.OPENAI);
      expect(listed[0]?.keyHint).toBe(maskApiKey(OPENAI_KEY));
      expect("apiKey" in (listed[0] ?? {})).toBe(false);
      expect(fetched.keyHint).toBe("••••1234");
      expect("apiKey" in fetched).toBe(false);
    } finally {
      llmIntegrationRepo.listCredentials = originalList;
      llmIntegrationRepo.findCredential = originalFind;
    }
  });

  it("creates a credential, writes CREATED, and does not echo the raw key", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalSave = llmIntegrationRepo.saveCredential;
    const originalAudit = llmIntegrationRepo.createAudit;
    const originalDisable = llmIntegrationRepo.disableAutoReplyForProvider;
    const audits: Array<{ action: LlmCredentialAuditAction }> = [];

    llmIntegrationRepo.findCredential = async () => null;
    llmIntegrationRepo.saveCredential = async () => {
      const { apiKey: _apiKey, ...rest } = credentialRow({ status: LlmCredentialStatus.PENDING_VERIFICATION });
      return rest as never;
    };
    llmIntegrationRepo.createAudit = async (input) => {
      audits.push({ action: input.action });
      return {} as never;
    };
    llmIntegrationRepo.disableAutoReplyForProvider = async () => false;

    try {
      const result = await llmIntegrationService.saveCredential(
        ORG_ID,
        LlmProvider.OPENAI,
        { apiKey: OPENAI_KEY },
        EMPLOYEE_ID,
      );
      expect(result.keyHint).toBe("••••1234");
      expect("apiKey" in result).toBe(false);
      expect(result.status).toBe(LlmCredentialStatus.PENDING_VERIFICATION);
      expect(audits[0]?.action).toBe(LlmCredentialAuditAction.CREATED);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmIntegrationRepo.saveCredential = originalSave;
      llmIntegrationRepo.createAudit = originalAudit;
      llmIntegrationRepo.disableAutoReplyForProvider = originalDisable;
    }
  });

  it("rotates an existing key and turns auto-reply off for that provider", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalSave = llmIntegrationRepo.saveCredential;
    const originalAudit = llmIntegrationRepo.createAudit;
    const originalDisable = llmIntegrationRepo.disableAutoReplyForProvider;
    const captured: { action?: LlmCredentialAuditAction; provider?: LlmProvider } = {};

    llmIntegrationRepo.findCredential = async () => credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;
    llmIntegrationRepo.saveCredential = async (_org, _provider, _data, isCreate) => {
      expect(isCreate).toBe(false);
      const { apiKey: _apiKey, ...rest } = credentialRow();
      return rest as never;
    };
    llmIntegrationRepo.createAudit = async (input) => {
      captured.action = input.action;
      return {} as never;
    };
    llmIntegrationRepo.disableAutoReplyForProvider = async (_org, provider) => {
      captured.provider = provider;
      return true;
    };

    try {
      await llmIntegrationService.saveCredential(
        ORG_ID,
        LlmProvider.OPENAI,
        { apiKey: OPENAI_KEY },
        EMPLOYEE_ID,
      );
      expect(captured.action).toBe(LlmCredentialAuditAction.ROTATED);
      expect(captured.provider).toBe(LlmProvider.OPENAI);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmIntegrationRepo.saveCredential = originalSave;
      llmIntegrationRepo.createAudit = originalAudit;
      llmIntegrationRepo.disableAutoReplyForProvider = originalDisable;
    }
  });

  it("marks the credential active after the provider accepts the key", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalVerify = llmProviderVerifier.verify;
    const originalMark = llmIntegrationRepo.markCredentialVerified;
    const originalAudit = llmIntegrationRepo.createAudit;

    llmIntegrationRepo.findCredential = async (organizationId) => {
      expect(organizationId).toBe(ORG_ID);
      return credentialRow() as never;
    };
    llmProviderVerifier.verify = async () => undefined;
    llmIntegrationRepo.markCredentialVerified = async () => {
      const { apiKey: _apiKey, ...rest } = credentialRow({ status: LlmCredentialStatus.ACTIVE });
      return rest as never;
    };
    llmIntegrationRepo.createAudit = async (input) => {
      expect(input.action).toBe(LlmCredentialAuditAction.VERIFIED);
      expect(JSON.stringify(input.detail).includes(OPENAI_KEY)).toBe(false);
      return {} as never;
    };

    try {
      const result = await llmIntegrationService.verifyCredential(ORG_ID, LlmProvider.OPENAI, EMPLOYEE_ID);
      expect(result.status).toBe(LlmCredentialStatus.ACTIVE);
      expect("apiKey" in result).toBe(false);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmProviderVerifier.verify = originalVerify;
      llmIntegrationRepo.markCredentialVerified = originalMark;
      llmIntegrationRepo.createAudit = originalAudit;
    }
  });

  it("marks the key invalid and disables auto-reply when the provider returns 401", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalVerify = llmProviderVerifier.verify;
    const originalInvalid = llmIntegrationRepo.markCredentialInvalid;
    const originalDisable = llmIntegrationRepo.disableAutoReplyForProvider;
    const originalAudit = llmIntegrationRepo.createAudit;
    let markedInvalid = false;
    let disabled = false;

    llmIntegrationRepo.findCredential = async () => credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;
    llmProviderVerifier.verify = async () => {
      throw new LlmProviderVerificationError(401, "HTTP_401", "Incorrect API key");
    };
    llmIntegrationRepo.markCredentialInvalid = async () => {
      markedInvalid = true;
      const { apiKey: _apiKey, ...rest } = credentialRow({ status: LlmCredentialStatus.INVALID });
      return rest as never;
    };
    llmIntegrationRepo.disableAutoReplyForProvider = async () => {
      disabled = true;
      return true;
    };
    llmIntegrationRepo.createAudit = async (input) => {
      expect(input.action).toBe(LlmCredentialAuditAction.VERIFICATION_FAILED);
      return {} as never;
    };

    try {
      await expect(
        llmIntegrationService.verifyCredential(ORG_ID, LlmProvider.OPENAI, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });
      expect(markedInvalid).toBe(true);
      expect(disabled).toBe(true);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmProviderVerifier.verify = originalVerify;
      llmIntegrationRepo.markCredentialInvalid = originalInvalid;
      llmIntegrationRepo.disableAutoReplyForProvider = originalDisable;
      llmIntegrationRepo.createAudit = originalAudit;
    }
  });

  it("does not mark the key invalid when the provider rate limits verification", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalVerify = llmProviderVerifier.verify;
    const originalRecord = llmIntegrationRepo.recordCredentialError;
    const originalInvalid = llmIntegrationRepo.markCredentialInvalid;
    let markedInvalid = false;

    llmIntegrationRepo.findCredential = async () => credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;
    llmProviderVerifier.verify = async () => {
      throw new LlmProviderVerificationError(429, "HTTP_429", "Rate limit");
    };
    llmIntegrationRepo.recordCredentialError = async () => credentialRow() as never;
    llmIntegrationRepo.markCredentialInvalid = async () => {
      markedInvalid = true;
      return credentialRow() as never;
    };

    try {
      await expect(
        llmIntegrationService.verifyCredential(ORG_ID, LlmProvider.OPENAI, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Too_Many_Requests });
      expect(markedInvalid).toBe(false);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmProviderVerifier.verify = originalVerify;
      llmIntegrationRepo.recordCredentialError = originalRecord;
      llmIntegrationRepo.markCredentialInvalid = originalInvalid;
    }
  });

  it("returns not found when verifying a provider the organization has not saved", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    llmIntegrationRepo.findCredential = async (organizationId) => {
      expect(organizationId).not.toBe(OTHER_ORG_ID);
      return null;
    };

    try {
      await expect(
        llmIntegrationService.verifyCredential(ORG_ID, LlmProvider.GEMINI, EMPLOYEE_ID),
      ).rejects.toBeInstanceOf(ErrorResponse);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
    }
  });

  it("disables a credential once and keeps the key", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalDisableCredential = llmIntegrationRepo.disableCredential;
    const originalDisableReply = llmIntegrationRepo.disableAutoReplyForProvider;
    const originalAudit = llmIntegrationRepo.createAudit;

    llmIntegrationRepo.findCredential = async () => credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;
    llmIntegrationRepo.disableCredential = async () => {
      const { apiKey: _apiKey, ...rest } = credentialRow({ status: LlmCredentialStatus.DISABLED });
      return rest as never;
    };
    llmIntegrationRepo.disableAutoReplyForProvider = async () => true;
    llmIntegrationRepo.createAudit = async (input) => {
      expect(input.action).toBe(LlmCredentialAuditAction.DISABLED);
      expect(JSON.stringify(input.detail).includes("sk-")).toBe(false);
      return {} as never;
    };

    try {
      const result = await llmIntegrationService.disableCredential(ORG_ID, LlmProvider.OPENAI, EMPLOYEE_ID);
      expect(result.status).toBe(LlmCredentialStatus.DISABLED);
      expect("apiKey" in result).toBe(false);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmIntegrationRepo.disableCredential = originalDisableCredential;
      llmIntegrationRepo.disableAutoReplyForProvider = originalDisableReply;
      llmIntegrationRepo.createAudit = originalAudit;
    }
  });

  it("deletes the credential and clears the active provider", async () => {
    const originalFind = llmIntegrationRepo.findCredential;
    const originalAudit = llmIntegrationRepo.createAudit;
    const originalClear = llmIntegrationRepo.clearActiveProvider;
    const originalDelete = llmIntegrationRepo.deleteCredential;
    const order: string[] = [];

    llmIntegrationRepo.findCredential = async () => credentialRow() as never;
    llmIntegrationRepo.createAudit = async (input) => {
      order.push("audit");
      expect(input.action).toBe(LlmCredentialAuditAction.DELETED);
      expect(input.credentialId).toBe(CREDENTIAL_ID);
      return {} as never;
    };
    llmIntegrationRepo.clearActiveProvider = async (_org, provider) => {
      order.push("clear");
      expect(provider).toBe(LlmProvider.OPENAI);
      return true;
    };
    llmIntegrationRepo.deleteCredential = async (id) => {
      order.push("delete");
      expect(id).toBe(CREDENTIAL_ID);
      return {} as never;
    };

    try {
      const result = await llmIntegrationService.deleteCredential(ORG_ID, LlmProvider.OPENAI, EMPLOYEE_ID);
      expect(result).toEqual({ provider: LlmProvider.OPENAI, deleted: true });
      expect(order).toEqual(["audit", "clear", "delete"]);
    } finally {
      llmIntegrationRepo.findCredential = originalFind;
      llmIntegrationRepo.createAudit = originalAudit;
      llmIntegrationRepo.clearActiveProvider = originalClear;
      llmIntegrationRepo.deleteCredential = originalDelete;
    }
  });

  it("stores the catalog provider with the selected model and blocks auto-reply until the key is active", async () => {
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalFindModel = llmIntegrationRepo.findModelById;
    const originalFindCredential = llmIntegrationRepo.findCredential;
    const originalSave = llmIntegrationRepo.saveSetting;
    const captured: { patch: LlmSettingPatch | null } = { patch: null };

    llmIntegrationRepo.findSetting = async () => null;
    llmIntegrationRepo.findModelById = async () => modelRow() as never;
    llmIntegrationRepo.findCredential = async () =>
      credentialRow({ status: LlmCredentialStatus.PENDING_VERIFICATION }) as never;
    llmIntegrationRepo.saveSetting = async (_org, patch) => {
      captured.patch = patch;
      return settingRow({ isAutoReplyEnabled: false, activeProvider: LlmProvider.OPENAI }) as never;
    };

    try {
      await expect(
        llmIntegrationService.updateSetting(
          ORG_ID,
          { activeModelId: MODEL_ID, isAutoReplyEnabled: true },
          EMPLOYEE_ID,
        ),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });

      llmIntegrationRepo.findCredential = async () =>
        credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;

      const saved = await llmIntegrationService.updateSetting(
        ORG_ID,
        { activeModelId: MODEL_ID, isAutoReplyEnabled: true, temperature: 0.4 },
        EMPLOYEE_ID,
      );

      expect(captured.patch?.activeProvider).toBe(LlmProvider.OPENAI);
      expect(captured.patch?.activeModelId).toBe(MODEL_ID);
      expect(captured.patch?.isAutoReplyEnabled).toBe(true);
      expect(Number(captured.patch?.temperature)).toBeCloseTo(0.4);
      expect(saved.isAutoReplyEnabled).toBe(false);
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.findModelById = originalFindModel;
      llmIntegrationRepo.findCredential = originalFindCredential;
      llmIntegrationRepo.saveSetting = originalSave;
    }
  });

  it("rejects an inactive model and a token limit above the catalog cap", async () => {
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalFindModel = llmIntegrationRepo.findModelById;
    llmIntegrationRepo.findSetting = async () => null;
    llmIntegrationRepo.findModelById = async () => modelRow({ isActive: false }) as never;

    try {
      await expect(
        llmIntegrationService.updateSetting(ORG_ID, { activeModelId: MODEL_ID }, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });

      llmIntegrationRepo.findModelById = async () => modelRow({ maxOutputTokens: 1024 }) as never;
      await expect(
        llmIntegrationService.updateSetting(ORG_ID, { activeModelId: MODEL_ID, maxOutputTokens: 5000 }, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.findModelById = originalFindModel;
    }
  });

  it("clears the active model and forces auto-reply off when the model is removed", async () => {
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalSave = llmIntegrationRepo.saveSetting;
    const captured: { patch: LlmSettingPatch | null } = { patch: null };

    llmIntegrationRepo.findSetting = async () =>
      settingRow({ isAutoReplyEnabled: true, activeProvider: LlmProvider.OPENAI }) as never;
    llmIntegrationRepo.saveSetting = async (_org, patch) => {
      captured.patch = patch;
      return settingRow({
        isAutoReplyEnabled: false,
        activeProvider: null,
        activeModelId: null,
        activeModel: null,
        temperature: null,
      }) as never;
    };

    try {
      const saved = await llmIntegrationService.updateSetting(
        ORG_ID,
        { activeModelId: null },
        EMPLOYEE_ID,
      );
      expect(captured.patch?.activeProvider).toBeNull();
      expect(captured.patch?.activeModelId).toBeNull();
      expect(captured.patch?.isAutoReplyEnabled).toBe(false);
      expect(saved.temperature).toBeNull();
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.saveSetting = originalSave;
    }
  });

  it("returns not found for an unknown catalog model", async () => {
    const originalFind = llmIntegrationRepo.findModelById;
    llmIntegrationRepo.findModelById = async () => null;
    try {
      await expect(llmIntegrationService.getModel(MODEL_ID)).rejects.toMatchObject({
        statusCode: statusCode.Not_Found,
      });
    } finally {
      llmIntegrationRepo.findModelById = originalFind;
    }
  });

  it("pages usage rows for the calling organization only", async () => {
    const originalList = llmIntegrationRepo.listUsages;
    llmIntegrationRepo.listUsages = async (organizationId, page, limit, provider) => {
      expect(organizationId).toBe(ORG_ID);
      expect(page).toBe(1);
      expect(limit).toBe(25);
      expect(provider).toBe(LlmProvider.ANTHROPIC);
      return {
        items: [{ id: "usage-1", organizationId: ORG_ID, provider: LlmProvider.ANTHROPIC, modelKey: "claude-sonnet-4-5" }],
        total: 1,
      } as never;
    };

    try {
      const page = await llmIntegrationService.listUsages(ORG_ID, 1, 25, LlmProvider.ANTHROPIC);
      expect(page.totalPages).toBe(1);
      expect(page.items).toHaveLength(1);
    } finally {
      llmIntegrationRepo.listUsages = originalList;
    }
  });

  it("validates and stores active vector embedding model when provider key is active", async () => {
    const EMBEDDING_MODEL_ID = "e1eebc99-9c0b-4ef8-bb6d-6bb9bd380a77";
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalFindModel = llmIntegrationRepo.findModelById;
    const originalFindCredential = llmIntegrationRepo.findCredential;
    const originalSave = llmIntegrationRepo.saveSetting;
    const captured: { patch: LlmSettingPatch | null } = { patch: null };

    const embeddingModel = modelRow({
      id: EMBEDDING_MODEL_ID,
      modelType: LlmModelType.EMBEDDING,
      modelKey: "text-embedding-3-small",
      displayName: "Text Embedding 3 (Small)",
      embeddingDimensions: 1536,
      provider: LlmProvider.OPENAI,
    });

    llmIntegrationRepo.findSetting = async () => null;
    llmIntegrationRepo.findModelById = async (id) => (id === EMBEDDING_MODEL_ID ? embeddingModel : modelRow()) as never;
    llmIntegrationRepo.findCredential = async () =>
      credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;
    llmIntegrationRepo.saveSetting = async (_org, patch) => {
      captured.patch = patch;
      return settingRow({
        activeEmbeddingProvider: LlmProvider.OPENAI,
        activeEmbeddingModelId: EMBEDDING_MODEL_ID,
        activeEmbeddingModel: embeddingModel,
      }) as never;
    };

    try {
      const saved = await llmIntegrationService.updateSetting(
        ORG_ID,
        { activeEmbeddingModelId: EMBEDDING_MODEL_ID },
        EMPLOYEE_ID,
      );

      expect(captured.patch?.activeEmbeddingProvider).toBe(LlmProvider.OPENAI);
      expect(captured.patch?.activeEmbeddingModelId).toBe(EMBEDDING_MODEL_ID);
      expect(saved.activeEmbeddingModelId).toBe(EMBEDDING_MODEL_ID);
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.findModelById = originalFindModel;
      llmIntegrationRepo.findCredential = originalFindCredential;
      llmIntegrationRepo.saveSetting = originalSave;
    }
  });

  it("rejects selecting a chat model as activeEmbeddingModelId and an embedding model as activeModelId", async () => {
    const CHAT_MODEL_ID = MODEL_ID;
    const EMBEDDING_MODEL_ID = "e2eebc99-9c0b-4ef8-bb6d-6bb9bd380a88";
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalFindModel = llmIntegrationRepo.findModelById;
    const originalFindCredential = llmIntegrationRepo.findCredential;

    const chatModel = modelRow({ id: CHAT_MODEL_ID, modelType: LlmModelType.CHAT });
    const embeddingModel = modelRow({ id: EMBEDDING_MODEL_ID, modelType: LlmModelType.EMBEDDING });

    llmIntegrationRepo.findSetting = async () => null;
    llmIntegrationRepo.findModelById = async (id) => {
      if (id === CHAT_MODEL_ID) return chatModel as never;
      if (id === EMBEDDING_MODEL_ID) return embeddingModel as never;
      return null;
    };
    llmIntegrationRepo.findCredential = async () =>
      credentialRow({ status: LlmCredentialStatus.ACTIVE }) as never;

    try {
      // Trying to select a CHAT model as embedding model -> Rejected
      await expect(
        llmIntegrationService.updateSetting(ORG_ID, { activeEmbeddingModelId: CHAT_MODEL_ID }, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });

      // Trying to select an EMBEDDING model as auto-reply chat model -> Rejected
      await expect(
        llmIntegrationService.updateSetting(ORG_ID, { activeModelId: EMBEDDING_MODEL_ID }, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.findModelById = originalFindModel;
      llmIntegrationRepo.findCredential = originalFindCredential;
    }
  });

  it("blocks selecting an embedding model if the provider API key is not active", async () => {
    const EMBEDDING_MODEL_ID = "e3eebc99-9c0b-4ef8-bb6d-6bb9bd380a99";
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalFindModel = llmIntegrationRepo.findModelById;
    const originalFindCredential = llmIntegrationRepo.findCredential;

    const embeddingModel = modelRow({
      id: EMBEDDING_MODEL_ID,
      modelType: LlmModelType.EMBEDDING,
      provider: LlmProvider.GEMINI,
    });

    llmIntegrationRepo.findSetting = async () => null;
    llmIntegrationRepo.findModelById = async () => embeddingModel as never;
    llmIntegrationRepo.findCredential = async () =>
      credentialRow({ status: LlmCredentialStatus.PENDING_VERIFICATION }) as never;

    try {
      await expect(
        llmIntegrationService.updateSetting(ORG_ID, { activeEmbeddingModelId: EMBEDDING_MODEL_ID }, EMPLOYEE_ID),
      ).rejects.toMatchObject({ statusCode: statusCode.Bad_Request });
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.findModelById = originalFindModel;
      llmIntegrationRepo.findCredential = originalFindCredential;
    }
  });

  it("allows clearing the active embedding model by passing activeEmbeddingModelId: null", async () => {
    const originalFindSetting = llmIntegrationRepo.findSetting;
    const originalFindModel = llmIntegrationRepo.findModelById;
    const originalSave = llmIntegrationRepo.saveSetting;
    const captured: { patch: LlmSettingPatch | null } = { patch: null };

    llmIntegrationRepo.findSetting = async () =>
      settingRow({
        activeEmbeddingProvider: LlmProvider.OPENAI,
        activeEmbeddingModelId: "some-embed-id",
      }) as never;
    llmIntegrationRepo.findModelById = async () => modelRow() as never;
    llmIntegrationRepo.saveSetting = async (_org, patch) => {
      captured.patch = patch;
      return settingRow({
        activeEmbeddingProvider: null,
        activeEmbeddingModelId: null,
        activeEmbeddingModel: null,
      }) as never;
    };

    try {
      const saved = await llmIntegrationService.updateSetting(
        ORG_ID,
        { activeEmbeddingModelId: null },
        EMPLOYEE_ID,
      );
      expect(captured.patch?.activeEmbeddingProvider).toBeNull();
      expect(captured.patch?.activeEmbeddingModelId).toBeNull();
      expect(saved.activeEmbeddingModelId).toBeNull();
    } finally {
      llmIntegrationRepo.findSetting = originalFindSetting;
      llmIntegrationRepo.findModelById = originalFindModel;
      llmIntegrationRepo.saveSetting = originalSave;
    }
  });
});

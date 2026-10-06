import { z } from "zod";
import { LlmModelType, LlmProvider } from "../../../types/types.js";

/**
 * Zod enum kept in lockstep with the Prisma `LlmProvider` enum.
 */
export const LlmProviderEnum = z.nativeEnum(LlmProvider);

/**
 * Zod enum kept in lockstep with the Prisma `LlmModelType` enum.
 */
export const LlmModelTypeEnum = z.nativeEnum(LlmModelType);

const additionalInformationSchema = z.record(z.string(), z.any()).optional().nullable();

const pageQuery = z.coerce.number().int().min(1).default(1);
const limitQuery = z.coerce.number().int().min(1).max(100).default(25);

/**
 * Rejects whitespace and enforces the public key prefix for each provider.
 * Prefix checks stop a Gemini key from being saved against OpenAI, and the reverse.
 * @param provider Selected LLM vendor
 * @param apiKey Trimmed secret from the request body
 * @returns A human-readable validation error, or null when the key shape is acceptable
 */
export function validateProviderApiKey(provider: LlmProvider, apiKey: string): string | null {
  if (/\s/.test(apiKey)) {
    return "API key cannot contain whitespace";
  }

  if (provider === LlmProvider.OPENAI && !apiKey.startsWith("sk-")) {
    return "OpenAI API keys must start with sk-";
  }

  if (provider === LlmProvider.GEMINI && !apiKey.startsWith("AIza")) {
    return "Gemini API keys must start with AIza";
  }

  if (provider === LlmProvider.ANTHROPIC && !apiKey.startsWith("sk-ant-")) {
    return "Anthropic API keys must start with sk-ant-";
  }

  return null;
}

/**
 * @route GET /api/v1/integrations/llm/models
 * Query validation for the platform model catalog.
 */
export const listLlmModelsQuerySchema = z.object({
  query: z.object({
    provider: LlmProviderEnum.optional(),
    modelType: LlmModelTypeEnum.optional(),
    search: z.string().trim().min(1).max(100).optional(),
    includeInactive: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  }),
});

/**
 * @route GET /api/v1/integrations/llm/models/:modelId
 */
export const llmModelIdParamsSchema = z.object({
  params: z.object({
    modelId: z.string().uuid("Invalid model id"),
  }),
});

/**
 * @route PUT /api/v1/integrations/llm/credentials/:provider
 * Saves the organization's raw API key for one provider.
 */
export const upsertLlmCredentialSchema = z
  .object({
    params: z.object({
      provider: LlmProviderEnum,
    }),
    body: z.object({
      apiKey: z
        .string()
        .trim()
        .min(20, "API key is too short")
        .max(4096, "API key is too long"),
      externalAccountId: z
        .string()
        .trim()
        .max(128, "External account id cannot exceed 128 characters")
        .optional()
        .nullable(),
      additionalInformation: additionalInformationSchema,
    }),
  })
  .superRefine((value, ctx) => {
    const message = validateProviderApiKey(value.params.provider, value.body.apiKey);
    if (message) {
      ctx.addIssue({
        code: "custom",
        message,
        path: ["body", "apiKey"],
      });
    }
  });

/**
 * @route GET|POST|PATCH|DELETE /api/v1/integrations/llm/credentials/:provider
 */
export const llmProviderParamsSchema = z.object({
  params: z.object({
    provider: LlmProviderEnum,
  }),
});

/**
 * @route GET /api/v1/integrations/llm/credentials/:provider/audits
 * @route GET /api/v1/integrations/llm/usages
 */
export const llmPagedQuerySchema = z.object({
  query: z.object({
    page: pageQuery,
    limit: limitQuery,
    provider: LlmProviderEnum.optional(),
  }),
});

/**
 * @route GET /api/v1/integrations/llm/credentials/:provider/audits
 */
export const llmCredentialAuditQuerySchema = z.object({
  params: z.object({
    provider: LlmProviderEnum,
  }),
  query: z.object({
    page: pageQuery,
    limit: limitQuery,
  }),
});

/**
 * @route PUT /api/v1/integrations/llm/settings
 * Partial update. Only fields present in the body are written.
 */
export const updateLlmSettingSchema = z.object({
  body: z
    .object({
      isAutoReplyEnabled: z.boolean().optional(),
      activeModelId: z.string().uuid("Invalid model id").nullable().optional(),
      activeEmbeddingModelId: z.string().uuid("Invalid embedding model id").nullable().optional(),
      systemInstruction: z
        .string()
        .trim()
        .max(8000, "System instruction cannot exceed 8000 characters")
        .nullable()
        .optional(),
      temperature: z
        .number()
        .min(0, "Temperature must be between 0 and 2")
        .max(2, "Temperature must be between 0 and 2")
        .nullable()
        .optional(),
      maxOutputTokens: z
        .number()
        .int("Max output tokens must be a whole number")
        .min(1, "Max output tokens must be at least 1")
        .max(128000, "Max output tokens cannot exceed 128000")
        .nullable()
        .optional(),
      additionalInformation: additionalInformationSchema,
    })
    .refine((body) => Object.values(body).some((value) => value !== undefined), {
      message: "At least one setting field is required",
    }),
});

export type ListLlmModelsQuery = z.infer<typeof listLlmModelsQuerySchema>["query"];
export type UpsertLlmCredentialDto = z.infer<typeof upsertLlmCredentialSchema>["body"];
export type UpdateLlmSettingDto = z.infer<typeof updateLlmSettingSchema>["body"];
export type LlmPagedQuery = z.infer<typeof llmPagedQuerySchema>["query"];

/**
 * @route POST /api/v1/platform/llm/models
 * Platform admin creates a catalog row organizations can later select.
 */
export const createLlmModelSchema = z.object({
  body: z.object({
    provider: LlmProviderEnum,
    modelType: LlmModelTypeEnum.default(LlmModelType.CHAT),
    modelKey: z.string().trim().min(1, "Model key is required").max(200),
    displayName: z.string().trim().min(1, "Display name is required").max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    contextWindow: z.number().int().min(1, "Context window must be at least 1"),
    maxOutputTokens: z.number().int().min(1).max(128000).optional().nullable(),
    embeddingDimensions: z.number().int().min(1).max(32000).optional().nullable(),
    supportsVision: z.boolean().optional(),
    supportsTools: z.boolean().optional(),
    isActive: z.boolean().optional(),
    isDeprecated: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10000).optional(),
    additionalInformation: additionalInformationSchema,
  }),
});

/**
 * @route PATCH /api/v1/platform/llm/models/:modelId
 * Partial update. Only fields present in the body are written.
 */
export const updateLlmModelSchema = z.object({
  params: z.object({
    modelId: z.string().uuid("Invalid model id"),
  }),
  body: z
    .object({
      modelType: LlmModelTypeEnum.optional(),
      modelKey: z.string().trim().min(1).max(200).optional(),
      displayName: z.string().trim().min(1).max(200).optional(),
      description: z.string().trim().max(2000).optional().nullable(),
      contextWindow: z.number().int().min(1).optional(),
      maxOutputTokens: z.number().int().min(1).max(128000).optional().nullable(),
      embeddingDimensions: z.number().int().min(1).max(32000).optional().nullable(),
      supportsVision: z.boolean().optional(),
      supportsTools: z.boolean().optional(),
      isActive: z.boolean().optional(),
      isDeprecated: z.boolean().optional(),
      sortOrder: z.number().int().min(0).max(10000).optional(),
      additionalInformation: additionalInformationSchema,
    })
    .refine((body) => Object.values(body).some((value) => value !== undefined), {
      message: "At least one model field is required",
    }),
});

export type CreateLlmModelDto = z.infer<typeof createLlmModelSchema>["body"];
export type UpdateLlmModelDto = z.infer<typeof updateLlmModelSchema>["body"];

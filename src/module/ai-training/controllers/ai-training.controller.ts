import type { Request, Response } from "express";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { aiTrainingService } from "../services/ai-training.service.js";
import {
  CreateKnowledgeSourceSchema,
  UpdateKnowledgeSourceSchema,
  CreateKnowledgeFaqSchema,
  UpdateKnowledgeFaqSchema,
  CreateGoldenConversationSchema,
  UpdateGoldenConversationSchema,
  UpsertGuardrailConfigSchema,
  TestAiQuerySchema,
} from "../validators/ai-training.validator.js";
import { ErrorResponse, SuccessResponse } from "../../../utils/response.util.js";
import { AiSourceType, statusCode } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { extractTextFromPdfBuffer } from "../../../lib/pdf-extractor.js";

/**
 * Requires the authenticated user's organization.
 */
function requireOrganizationId(organizationId: string | null | undefined): string {
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }
  return organizationId;
}

/**
 * AI Training & Knowledge Studio Controller
 */

/**
 * @route GET /api/v1/ai-training/sources
 * @desc List paginated knowledge sources with filtering
 */
export const getSources = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const { type, status, leadFunnelId, search, page, limit } = req.query;

  const result = await aiTrainingService.getSources(organizationId, {
    type: type as any,
    status: status as any,
    leadFunnelId: leadFunnelId ? String(leadFunnelId) : undefined,
    search: search ? String(search) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return SuccessResponse(res, "Knowledge sources retrieved successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/sources/:id
 * @desc Fetch a single knowledge source by ID
 */
export const getSourceById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const source = await aiTrainingService.getSourceById(organizationId, id);
  return SuccessResponse(res, "Knowledge source retrieved successfully", source, statusCode.OK);
});

/**
 * @route POST /api/v1/ai-training/sources
 * @desc Create and optionally auto-index a new knowledge source with optional PDF file upload
 */
export const createSource = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);

  let fileAttachmentData: any = null;
  let extractedFileContent: string | null = null;
  let fileSizeBytes: number | null = null;

  // Handle uploaded file if present (e.g. PDF brochure, rate card, guideline)
  if (req.file) {
    fileSizeBytes = req.file.size;
    try {
      const uploadRes = await storageService.upload(req.file, {
        folder: "ai-training/documents",
      });
      fileAttachmentData = {
        id: uploadRes.publicId,
        url: uploadRes.url,
        bytes: uploadRes.bytes,
        format: uploadRes.format,
        provider: uploadRes.provider,
      };
    } catch (err) {
      console.warn("[AiTrainingController] Storage upload warning:", err);
    }

    // Extract text from PDF or text buffer
    if (req.file.mimetype === "application/pdf") {
      extractedFileContent = await extractTextFromPdfBuffer(req.file.buffer);
    } else if (
      req.file.mimetype.startsWith("text/") ||
      req.file.originalname.endsWith(".txt") ||
      req.file.originalname.endsWith(".csv") ||
      req.file.originalname.endsWith(".md")
    ) {
      extractedFileContent = req.file.buffer.toString("utf-8");
    }
  }

  // Parse body fields
  const bodyTitle =
    req.body.title ||
    (req.file ? req.file.originalname.replace(/\.[^/.]+$/, "") : "Uploaded Knowledge Document");
  const bodyType = req.body.type || (req.file ? AiSourceType.DOCUMENT : AiSourceType.RAW_TEXT);

  const validated = CreateKnowledgeSourceSchema.parse({
    ...req.body,
    title: bodyTitle,
    type: bodyType,
    rawContent: req.body.rawContent || extractedFileContent || null,
    fileAttachment: fileAttachmentData || req.body.fileAttachment || null,
    autoIndex: req.body.autoIndex !== "false" && req.body.autoIndex !== false,
  });

  const source = await aiTrainingService.createSource(organizationId, {
    ...validated,
    rawContent: validated.rawContent || extractedFileContent,
    fileAttachment: fileAttachmentData || validated.fileAttachment,
  });

  return SuccessResponse(res, "Knowledge source created and indexed successfully", source, statusCode.Created);
});

/**
 * @route PATCH /api/v1/ai-training/sources/:id
 * @desc Update an existing knowledge source
 */
export const updateSource = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;
  const validated = UpdateKnowledgeSourceSchema.parse(req.body);

  const source = await aiTrainingService.updateSource(organizationId, id, validated);
  return SuccessResponse(res, "Knowledge source updated successfully", source, statusCode.OK);
});

/**
 * @route DELETE /api/v1/ai-training/sources/:id
 * @desc Soft-delete a knowledge source and deactivate its vector chunks
 */
export const deleteSource = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const result = await aiTrainingService.deleteSource(organizationId, id);
  return SuccessResponse(res, "Knowledge source deleted successfully", result, statusCode.OK);
});

/**
 * @route POST /api/v1/ai-training/sources/:id/reindex
 * @desc Re-chunk and re-embed a knowledge source using the organization's verified LLM key
 */
export const reindexSource = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const result = await aiTrainingService.reindexSource(organizationId, id);
  return SuccessResponse(res, "Knowledge source reindexed successfully", result, statusCode.OK);
});

/**
 * @route POST /api/v1/ai-training/reindex-all
 * @desc Re-index all active knowledge sources for the organization
 */
export const reindexAllSources = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);

  const results = await aiTrainingService.reindexAllSources(organizationId);
  return SuccessResponse(res, "All knowledge sources reindexed", results, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/sources/:id/chunks
 * @desc Retrieve vector chunks for a specific knowledge source
 */
export const getSourceChunks = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;
  const { page, limit } = req.query;

  const result = await aiTrainingService.getChunksBySource(organizationId, id, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return SuccessResponse(res, "Source chunks retrieved successfully", result, statusCode.OK);
});

/**
 * --- FAQS ---
 */

/**
 * @route GET /api/v1/ai-training/faqs
 * @desc List paginated knowledge FAQs
 */
export const getFaqs = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const { knowledgeSourceId, category, search, page, limit } = req.query;

  const result = await aiTrainingService.getFaqs(organizationId, {
    knowledgeSourceId: knowledgeSourceId ? String(knowledgeSourceId) : undefined,
    category: category ? String(category) : undefined,
    search: search ? String(search) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return SuccessResponse(res, "FAQs retrieved successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/faqs/:id
 * @desc Fetch a single FAQ by ID
 */
export const getFaqById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const faq = await aiTrainingService.getFaqById(organizationId, id);
  return SuccessResponse(res, "FAQ retrieved successfully", faq, statusCode.OK);
});

/**
 * @route POST /api/v1/ai-training/faqs
 * @desc Create a new knowledge FAQ
 */
export const createFaq = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const validated = CreateKnowledgeFaqSchema.parse(req.body);

  const faq = await aiTrainingService.createFaq(organizationId, validated);
  return SuccessResponse(res, "FAQ created successfully", faq, statusCode.Created);
});

/**
 * @route PATCH /api/v1/ai-training/faqs/:id
 * @desc Update an existing knowledge FAQ
 */
export const updateFaq = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;
  const validated = UpdateKnowledgeFaqSchema.parse(req.body);

  const faq = await aiTrainingService.updateFaq(organizationId, id, validated);
  return SuccessResponse(res, "FAQ updated successfully", faq, statusCode.OK);
});

/**
 * @route DELETE /api/v1/ai-training/faqs/:id
 * @desc Delete a knowledge FAQ
 */
export const deleteFaq = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const result = await aiTrainingService.deleteFaq(organizationId, id);
  return SuccessResponse(res, "FAQ deleted successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/golden-conversations
 * @desc List golden few-shot conversation exemplars
 */
export const getGoldenConversations = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const { search, page, limit } = req.query;

  const result = await aiTrainingService.getGoldenConversations(organizationId, {
    search: search ? String(search) : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return SuccessResponse(res, "Golden conversations retrieved successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/golden-conversations/:id
 * @desc Fetch a single golden conversation with all its turns
 */
export const getGoldenConversationById = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const conv = await aiTrainingService.getGoldenConversationById(organizationId, id);
  return SuccessResponse(res, "Golden conversation retrieved successfully", conv, statusCode.OK);
});

/**
 * @route POST /api/v1/ai-training/golden-conversations
 * @desc Create a new golden conversation exemplar with turns
 */
export const createGoldenConversation = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const validated = CreateGoldenConversationSchema.parse(req.body);

  const conv = await aiTrainingService.createGoldenConversation(organizationId, validated);
  return SuccessResponse(res, "Golden conversation created successfully", conv, statusCode.Created);
});

/**
 * @route PATCH /api/v1/ai-training/golden-conversations/:id
 * @desc Update a golden conversation and its turns
 */
export const updateGoldenConversation = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;
  const validated = UpdateGoldenConversationSchema.parse(req.body);

  const conv = await aiTrainingService.updateGoldenConversation(organizationId, id, validated);
  return SuccessResponse(res, "Golden conversation updated successfully", conv, statusCode.OK);
});

/**
 * @route DELETE /api/v1/ai-training/golden-conversations/:id
 * @desc Delete a golden conversation and all associated turns
 */
export const deleteGoldenConversation = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const id = req.params.id as string;

  const result = await aiTrainingService.deleteGoldenConversation(organizationId, id);
  return SuccessResponse(res, "Golden conversation deleted successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/guardrails
 * @desc Fetch organization guardrail policies and brand voice configuration
 */
export const getGuardrailConfig = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const config = await aiTrainingService.getGuardrailConfig(organizationId);
  return SuccessResponse(res, "Guardrail configuration retrieved successfully", config, statusCode.OK);
});

/**
 * @route PUT /api/v1/ai-training/guardrails
 * @desc Upsert organization guardrail policies and brand voice configuration
 */
export const upsertGuardrailConfig = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const validated = UpsertGuardrailConfigSchema.parse(req.body);

  const config = await aiTrainingService.upsertGuardrailConfig(organizationId, validated);
  return SuccessResponse(res, "Guardrail configuration saved successfully", config, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/versions
 * @desc List historical training version tags and publication history
 */
export const getVersions = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const { page, limit } = req.query;

  const result = await aiTrainingService.getVersions(organizationId, {
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });

  return SuccessResponse(res, "AI Training versions retrieved successfully", result, statusCode.OK);
});

/**
 * @route GET /api/v1/ai-training/metrics
 * @desc Fetch aggregate training metrics (sources, chunks, FAQs, golden turns, status)
 */
export const getMetrics = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const metrics = await aiTrainingService.getMetrics(organizationId);
  return SuccessResponse(res, "AI Training metrics retrieved successfully", metrics, statusCode.OK);
});

/**
 * @route POST /api/v1/ai-training/test-query
 * @desc Execute an end-to-end RAG playground test query using the organization's verified LLM key
 */
export const testAiQuery = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = requireOrganizationId(req.user?.organizationId);
  const validated = TestAiQuerySchema.parse(req.body);

  const result = await aiTrainingService.testAiQuery(organizationId, validated);
  return SuccessResponse(res, "AI reply generated successfully", result, statusCode.OK);
});

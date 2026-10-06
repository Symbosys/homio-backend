import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getSources,
  getSourceById,
  createSource,
  updateSource,
  deleteSource,
  reindexSource,
  reindexAllSources,
  getSourceChunks,
  getFaqs,
  getFaqById,
  createFaq,
  updateFaq,
  deleteFaq,
  getGoldenConversations,
  getGoldenConversationById,
  createGoldenConversation,
  updateGoldenConversation,
  deleteGoldenConversation,
  getGuardrailConfig,
  upsertGuardrailConfig,
  getVersions,
  getMetrics,
  testAiQuery,
} from "../controllers/ai-training.controller.js";

import { upload } from "../../../middlewares/upload.middleware.js";

const router = Router();

/**
 * All AI Training & Knowledge Studio routes are tenant-scoped.
 */
router.use(authenticate);

/**
 * --- METRICS & VERSIONS ---
 */

/**
 * @route   GET /api/v1/ai-training/metrics
 * @desc    Fetch high-level knowledge base and training metrics
 */
router.get("/metrics", getMetrics);

/**
 * @route   GET /api/v1/ai-training/versions
 * @desc    Fetch paginated training dataset deployment versions
 */
router.get("/versions", getVersions);

/**
 * --- KNOWLEDGE SOURCES & CHUNKS ---
 */

/**
 * @route   GET /api/v1/ai-training/sources
 * @desc    Fetch paginated list of knowledge sources
 */
router.get("/sources", getSources);

/**
 * @route   POST /api/v1/ai-training/sources
 * @desc    Create a new knowledge source with optional PDF/document file upload
 */
router.post(
  "/sources",
  upload.single("file", { category: "document", maxFileSize: 50 * 1024 * 1024 }),
  createSource,
);

/**
 * @route   POST /api/v1/ai-training/reindex-all
 * @desc    Trigger re-indexing of all active knowledge sources
 */
router.post("/reindex-all", reindexAllSources);

/**
 * @route   GET /api/v1/ai-training/sources/:id
 * @desc    Fetch a single knowledge source by ID
 */
router.get("/sources/:id", getSourceById);

/**
 * @route   PATCH /api/v1/ai-training/sources/:id
 * @desc    Update knowledge source details
 */
router.patch("/sources/:id", updateSource);

/**
 * @route   DELETE /api/v1/ai-training/sources/:id
 * @desc    Soft-delete knowledge source and deactivate its vector chunks
 */
router.delete("/sources/:id", deleteSource);

/**
 * @route   POST /api/v1/ai-training/sources/:id/reindex
 * @desc    Re-chunk and re-embed a specific knowledge source
 */
router.post("/sources/:id/reindex", reindexSource);

/**
 * @route   GET /api/v1/ai-training/sources/:id/chunks
 * @desc    Fetch vector chunks generated for a knowledge source
 */
router.get("/sources/:id/chunks", getSourceChunks);

/**
 * --- FAQS ---
 */

/**
 * @route   GET /api/v1/ai-training/faqs
 * @desc    Fetch paginated list of knowledge FAQs
 */
router.get("/faqs", getFaqs);

/**
 * @route   POST /api/v1/ai-training/faqs
 * @desc    Create a new knowledge FAQ
 */
router.post("/faqs", createFaq);

/**
 * @route   GET /api/v1/ai-training/faqs/:id
 * @desc    Fetch a single FAQ by ID
 */
router.get("/faqs/:id", getFaqById);

/**
 * @route   PATCH /api/v1/ai-training/faqs/:id
 * @desc    Update an existing FAQ
 */
router.patch("/faqs/:id", updateFaq);

/**
 * @route   DELETE /api/v1/ai-training/faqs/:id
 * @desc    Delete a knowledge FAQ
 */
router.delete("/faqs/:id", deleteFaq);

/**
 * --- GOLDEN CONVERSATIONS ---
 */

/**
 * @route   GET /api/v1/ai-training/golden-conversations
 * @desc    Fetch list of few-shot golden conversation exemplars
 */
router.get("/golden-conversations", getGoldenConversations);

/**
 * @route   POST /api/v1/ai-training/golden-conversations
 * @desc    Create a new golden conversation exemplar with dialogue turns
 */
router.post("/golden-conversations", createGoldenConversation);

/**
 * @route   GET /api/v1/ai-training/golden-conversations/:id
 * @desc    Fetch a single golden conversation by ID
 */
router.get("/golden-conversations/:id", getGoldenConversationById);

/**
 * @route   PATCH /api/v1/ai-training/golden-conversations/:id
 * @desc    Update a golden conversation exemplar and its dialogue turns
 */
router.patch("/golden-conversations/:id", updateGoldenConversation);

/**
 * @route   DELETE /api/v1/ai-training/golden-conversations/:id
 * @desc    Delete a golden conversation exemplar
 */
router.delete("/golden-conversations/:id", deleteGoldenConversation);

/**
 * --- GUARDRAILS & POLICIES ---
 */

/**
 * @route   GET /api/v1/ai-training/guardrails
 * @desc    Fetch organization guardrail configuration and brand tone
 */
router.get("/guardrails", getGuardrailConfig);

/**
 * @route   PUT /api/v1/ai-training/guardrails
 * @desc    Upsert organization guardrail policies and brand tone
 */
router.put("/guardrails", upsertGuardrailConfig);

/**
 * --- RAG TEST PLAYGROUND SIMULATION ---
 */

/**
 * @route   POST /api/v1/ai-training/test-query
 * @desc    Test RAG vector search + LLM prompt inference using tenant BYOK credentials
 */
router.post("/test-query", testAiQuery);

export default router;

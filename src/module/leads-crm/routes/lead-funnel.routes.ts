import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  getLeadFunnels,
  getLeadFunnelById,
  createLeadFunnel,
  updateLeadFunnel,
  deleteLeadFunnel,
  addFunnelStage,
  updateFunnelStage,
  deleteFunnelStage,
  reorderFunnelStages,
  addFunnelFormField,
  updateFunnelFormField,
  deleteFunnelFormField,
  reorderFunnelFormFields,
  getPublicEmbedFunnel,
  submitPublicEmbedLead,
  getFunnelLeads,
  transitionFunnelLeadStage,
  getFunnelTransitions,
  getLeadTransitions,
} from "../controllers/lead-funnel.controller.js";

const leadFunnelRoutes = Router();

// ==========================================
// PUBLIC EMBED ROUTES (Unauthenticated)
// ==========================================

/**
 * @route   GET /api/v1/crm/funnels/public/:embedSlug
 * @desc    Fetch public funnel configuration and form builder fields for web embedding
 */
leadFunnelRoutes.get("/public/:embedSlug", getPublicEmbedFunnel);

/**
 * @route   POST /api/v1/crm/funnels/public/:embedSlug/submit
 * @desc    Ingest lead inquiry from external web embed form
 */
leadFunnelRoutes.post("/public/:embedSlug/submit", submitPublicEmbedLead);

// ==========================================
// AUTHENTICATED CRM FUNNEL MANAGEMENT
// ==========================================

leadFunnelRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/crm/funnels
 * @desc    Fetch all funnels for the organization
 */
leadFunnelRoutes.get("/", getLeadFunnels);

/**
 * @route   POST /api/v1/crm/funnels
 * @desc    Create new funnel
 */
leadFunnelRoutes.post("/", createLeadFunnel);

/**
 * @route   GET /api/v1/crm/funnels/:id
 * @desc    Fetch single funnel with stages and form builder fields
 */
leadFunnelRoutes.get("/:id", getLeadFunnelById);

/**
 * @route   PATCH /api/v1/crm/funnels/:id
 * @desc    Update funnel parameters
 */
leadFunnelRoutes.patch("/:id", updateLeadFunnel);

/**
 * @route   DELETE /api/v1/crm/funnels/:id
 * @desc    Soft delete funnel
 */
leadFunnelRoutes.delete("/:id", deleteLeadFunnel);

// ==========================================
// FUNNEL STAGES ENDPOINTS
// ==========================================

/**
 * @route   POST /api/v1/crm/funnels/:id/stages
 * @desc    Add stage to funnel
 */
leadFunnelRoutes.post("/:id/stages", addFunnelStage);

/**
 * @route   PATCH /api/v1/crm/funnels/:id/stages/reorder
 * @desc    Reorder stages in funnel
 */
leadFunnelRoutes.patch("/:id/stages/reorder", reorderFunnelStages);

/**
 * @route   PATCH /api/v1/crm/funnels/:id/stages/:stageId
 * @desc    Update stage parameters, SLAs, and automations
 */
leadFunnelRoutes.patch("/:id/stages/:stageId", updateFunnelStage);

/**
 * @route   DELETE /api/v1/crm/funnels/:id/stages/:stageId
 * @desc    Delete stage from funnel
 */
leadFunnelRoutes.delete("/:id/stages/:stageId", deleteFunnelStage);

// ==========================================
// DYNAMIC FORM FIELDS ENDPOINTS
// ==========================================

/**
 * @route   POST /api/v1/crm/funnels/:id/fields
 * @desc    Add dynamic form field to funnel
 */
leadFunnelRoutes.post("/:id/fields", addFunnelFormField);

/**
 * @route   PATCH /api/v1/crm/funnels/:id/fields/reorder
 * @desc    Reorder dynamic form fields
 */
leadFunnelRoutes.patch("/:id/fields/reorder", reorderFunnelFormFields);

/**
 * @route   PATCH /api/v1/crm/funnels/:id/fields/:fieldId
 * @desc    Update dynamic form field
 */
leadFunnelRoutes.patch("/:id/fields/:fieldId", updateFunnelFormField);

/**
 * @route   DELETE /api/v1/crm/funnels/:id/fields/:fieldId
 * @desc    Delete dynamic form field
 */
leadFunnelRoutes.delete("/:id/fields/:fieldId", deleteFunnelFormField);

// ==========================================
// FUNNEL LEADS & TRANSITION AUDIT ENDPOINTS
// ==========================================

/**
 * @route   GET /api/v1/crm/funnels/leads/:leadId/transitions
 * @desc    Fetch stage transition history for a specific lead
 */
leadFunnelRoutes.get("/leads/:leadId/transitions", getLeadTransitions);

/**
 * @route   GET /api/v1/crm/funnels/:id/leads
 * @desc    Fetch leads/inquiries captured under this funnel with dynamic responses and stage info
 */
leadFunnelRoutes.get("/:id/leads", getFunnelLeads);

/**
 * @route   POST /api/v1/crm/funnels/:id/leads/:leadId/transition
 * @desc    Transition lead to a new funnel stage with SLA check and auto-task generation
 */
leadFunnelRoutes.post("/:id/leads/:leadId/transition", transitionFunnelLeadStage);

/**
 * @route   GET /api/v1/crm/funnels/:id/transitions
 * @desc    Fetch funnel transition and SLA audit logs
 */
leadFunnelRoutes.get("/:id/transitions", getFunnelTransitions);

export default leadFunnelRoutes;

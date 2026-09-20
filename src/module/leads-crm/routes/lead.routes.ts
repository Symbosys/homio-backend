import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  assignLead,
  convertLead,
  markLeadLost,
  bulkActionLeads,
  deleteLead,
} from "../controllers/lead.controller.js";
import {
  createLeadActivity,
  getLeadActivities,
  deleteLeadActivity,
} from "../controllers/lead-activity.controller.js";
import {
  uploadLeadDocument,
  getLeadDocuments,
  deleteLeadDocument,
} from "../controllers/lead-document.controller.js";

const leadRoutes = Router();

// Protect all lead routes
leadRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   POST /api/v1/crm/leads/bulk
 * @desc    Perform bulk batch actions on leads (assign, change status, bulk delete)
 */
leadRoutes.post("/bulk", bulkActionLeads);

/**
 * @route   POST /api/v1/crm/leads
 * @desc    Create a new lead with automatic customer deduplication and assignment
 */
leadRoutes.post("/", createLead);

/**
 * @route   GET /api/v1/crm/leads
 * @desc    Fetch paginated list of leads with pipeline status, priority, and budget filters
 */
leadRoutes.get("/", getLeads);

/**
 * @route   GET /api/v1/crm/leads/:id
 * @desc    Get comprehensive lead details including customer profile, follow-ups, and activities
 */
leadRoutes.get("/:id", getLeadById);

/**
 * @route   PATCH /api/v1/crm/leads/:id
 * @desc    Partial update of lead properties (dirty payload only)
 */
leadRoutes.patch("/:id", updateLead);

/**
 * @route   DELETE /api/v1/crm/leads/:id
 * @desc    Soft-delete lead record from tenant organization
 */
leadRoutes.delete("/:id", deleteLead);

/**
 * @route   PATCH /api/v1/crm/leads/:id/status
 * @desc    Transition lead pipeline stage / status (e.g. QUALIFIED, PROPOSAL_SENT, WON)
 */
leadRoutes.patch("/:id/status", updateLeadStatus);

/**
 * @route   PATCH /api/v1/crm/leads/:id/assign
 * @desc    Assign or reassign lead to sales executive / designer employee
 */
leadRoutes.patch("/:id/assign", assignLead);

/**
 * @route   POST /api/v1/crm/leads/:id/convert
 * @desc    Convert qualified lead into an active Client and create initial project
 */
leadRoutes.post("/:id/convert", convertLead);

/**
 * @route   POST /api/v1/crm/leads/:id/lost
 * @desc    Mark lead as lost with mandatory lost reason category and notes
 */
leadRoutes.post("/:id/lost", markLeadLost);

/**
 * @route   POST /api/v1/crm/leads/:id/activities
 * @desc    Add manual comment / note to lead activity feed
 */
leadRoutes.post("/:id/activities", createLeadActivity);

/**
 * @route   GET /api/v1/crm/leads/:id/activities
 * @desc    Fetch chronological timeline activity feed for lead
 */
leadRoutes.get("/:id/activities", getLeadActivities);

/**
 * @route   DELETE /api/v1/crm/leads/activities/:id
 * @desc    Remove an activity entry from lead timeline
 */
leadRoutes.delete("/activities/:id", deleteLeadActivity);

/**
 * @route   POST /api/v1/crm/leads/:id/documents
 * @desc    Upload floor plans, design briefs, or estimate documents for lead
 */
leadRoutes.post(
  "/:id/documents",
  upload.single("file", { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  uploadLeadDocument
);

/**
 * @route   GET /api/v1/crm/leads/:id/documents
 * @desc    Fetch list of all uploaded documents and floor plans for lead
 */
leadRoutes.get("/:id/documents", getLeadDocuments);

/**
 * @route   DELETE /api/v1/crm/leads/documents/:id
 * @desc    Delete lead document attachment
 */
leadRoutes.delete("/documents/:id", deleteLeadDocument);

export default leadRoutes;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  createTermsTemplate,
  getTermsTemplates,
  getDefaultTermsTemplate,
  getTermsTemplateById,
  updateTermsTemplate,
  deleteTermsTemplate,
  toggleActiveTermsTemplate,
  setDefaultTermsTemplate,
  duplicateTermsTemplate,
} from "../controllers/quotation-terms-template.controller.js";

const router = Router();

// Apply authentication middleware to all terms template routes
router.use(authenticate);

/**
 * @route   POST /api/v1/quotation-master/terms-templates
 * @desc    Create a new terms & conditions template
 * @access  Private (Authenticated Tenant User)
 */
router.post("/", createTermsTemplate);

/**
 * @route   GET /api/v1/quotation-master/terms-templates
 * @desc    Fetch all non-paginated terms templates for the tenant
 * @access  Private (Authenticated Tenant User)
 */
router.get("/", getTermsTemplates);

/**
 * @route   GET /api/v1/quotation-master/terms-templates/default
 * @desc    Fetch active default terms template
 * @access  Private (Authenticated Tenant User)
 */
router.get("/default", getDefaultTermsTemplate);

/**
 * @route   GET /api/v1/quotation-master/terms-templates/:id
 * @desc    Fetch single terms template by ID
 * @access  Private (Authenticated Tenant User)
 */
router.get("/:id", getTermsTemplateById);

/**
 * @route   PATCH /api/v1/quotation-master/terms-templates/:id
 * @desc    Update terms template details (partial / dirty update)
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id", updateTermsTemplate);

/**
 * @route   DELETE /api/v1/quotation-master/terms-templates/:id
 * @desc    Soft delete a terms template
 * @access  Private (Authenticated Tenant User)
 */
router.delete("/:id", deleteTermsTemplate);

/**
 * @route   PATCH /api/v1/quotation-master/terms-templates/:id/toggle-active
 * @desc    Toggle active state of a terms template
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/toggle-active", toggleActiveTermsTemplate);

/**
 * @route   PATCH /api/v1/quotation-master/terms-templates/:id/set-default
 * @desc    Set terms template as organization default
 * @access  Private (Authenticated Tenant User)
 */
router.patch("/:id/set-default", setDefaultTermsTemplate);

/**
 * @route   POST /api/v1/quotation-master/terms-templates/:id/duplicate
 * @desc    Duplicate / clone an existing terms template
 * @access  Private (Authenticated Tenant User)
 */
router.post("/:id/duplicate", duplicateTermsTemplate);

export default router;

import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { VastuAuditController } from "../controllers/vastu-audit.controller.js";

export const vastuAuditRouter = Router();

// Enforce authentication across all Vastu Consultant endpoints
vastuAuditRouter.use(authenticate);

/**
 * Middleware setting request and socket timeout specifically to 2 minutes (120,000ms)
 * per user requirement for long-running deep spatial analysis
 */
const setTwoMinuteTimeout = (req: Request, res: Response, next: NextFunction) => {
  req.setTimeout(120000); // 2 minutes (120,000ms)
  res.setTimeout(120000);
  next();
};

/**
 * @route   GET /api/v1/ai-studio/vastu/rate
 * @desc    Get active credit deduction rate per Vastu spatial audit
 */
vastuAuditRouter.get("/rate", VastuAuditController.getRate);

/**
 * @route   POST /api/v1/ai-studio/vastu/audit
 * @desc    Execute deep 16-zone Vedic Vastu spatial audit & non-demolition remedies (2-min timeout)
 */
vastuAuditRouter.post("/audit", setTwoMinuteTimeout, VastuAuditController.generateAudit);

/**
 * @route   GET /api/v1/ai-studio/vastu/sessions
 * @desc    List past Vastu audits for the caller organization
 */
vastuAuditRouter.get("/sessions", VastuAuditController.listAudits);

/**
 * @route   GET /api/v1/ai-studio/vastu/sessions/:id
 * @desc    Get details and breakdown of a specific Vastu audit
 */
vastuAuditRouter.get("/sessions/:id", VastuAuditController.getAuditById);

/**
 * @route   PATCH /api/v1/ai-studio/vastu/sessions/:id
 * @desc    Update Vastu audit metadata
 */
vastuAuditRouter.patch("/sessions/:id", VastuAuditController.updateAudit);

/**
 * @route   DELETE /api/v1/ai-studio/vastu/sessions/:id
 * @desc    Delete Vastu audit session and cleanup cloud media assets
 */
vastuAuditRouter.delete("/sessions/:id", VastuAuditController.deleteAudit);

import type { Request, Response } from "express";
import { VastuAuditService } from "../services/vastu-audit.service.js";
import {
  GenerateVastuAuditSchema,
  QueryVastuAuditsSchema,
  UpdateVastuAuditSchema,
} from "../validators/vastu-audit.validator.js";

const vastuService = new VastuAuditService();

/**
 * Controller for AI Vastu Spatial Audit & Vedic Spatial Consultant
 */
export class VastuAuditController {
  /**
   * @route   GET /api/v1/ai-studio/vastu/rate
   * @desc    Get active credit cost per Vastu spatial audit
   * @access  Private (Tenant)
   */
  public static async getRate(req: Request, res: Response) {
    try {
      const creditCost = await vastuService.getAuditCost();
      res.status(200).json({
        success: true,
        data: {
          creditCost,
          billingUnit: "per audit",
        },
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to retrieve Vastu audit rate",
      });
    }
  }

  /**
   * @route   POST /api/v1/ai-studio/vastu/audit
   * @desc    Execute deep 16-zone Vedic Vastu spatial audit & non-demolition remedies
   * @access  Private (Tenant)
   */
  public static async generateAudit(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const employeeId = (req.user as any)?.employeeId || req.user?.id || null;

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: "Organization context is required",
        });
      }

      const validatedData = GenerateVastuAuditSchema.parse(req.body);

      const result = await vastuService.generateVastuAudit(
        organizationId,
        employeeId,
        validatedData
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({
          success: false,
          message: "Validation Error",
          errors: error.errors,
        });
      }

      res.status(error.statusCode || 500).json({
        success: false,
        code: error.code || "VASTU_AUDIT_ERROR",
        message: error.message || "Failed to generate Vastu spatial audit",
      });
    }
  }

  /**
   * @route   GET /api/v1/ai-studio/vastu/sessions
   * @desc    List paginated Vastu audit history
   * @access  Private (Tenant)
   */
  public static async listAudits(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: "Organization context is required",
        });
      }

      const query = QueryVastuAuditsSchema.parse(req.query);
      const result = await vastuService.listSessions(organizationId, query);

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to retrieve Vastu audits",
      });
    }
  }

  /**
   * @route   GET /api/v1/ai-studio/vastu/sessions/:id
   * @desc    Get single Vastu audit session details
   * @access  Private (Tenant)
   */
  public static async getAuditById(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const id = req.params.id as string;

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: "Organization context is required",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Session ID parameter is required",
        });
      }

      const session = await vastuService.getSessionById(id, organizationId);

      res.status(200).json({
        success: true,
        data: session,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to retrieve Vastu audit details",
      });
    }
  }

  /**
   * @route   PUT /api/v1/ai-studio/vastu/sessions/:id
   * @desc    Update Vastu audit metadata
   * @access  Private (Tenant)
   */
  public static async updateAudit(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const id = req.params.id as string;

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: "Organization context is required",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Session ID parameter is required",
        });
      }

      const validatedData = UpdateVastuAuditSchema.parse(req.body);
      const updated = await vastuService.updateSession(
        id,
        organizationId,
        validatedData
      );

      res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to update Vastu audit",
      });
    }
  }

  /**
   * @route   DELETE /api/v1/ai-studio/vastu/sessions/:id
   * @desc    Delete Vastu audit session & clean up cloud assets (Rule 4 Standard)
   * @access  Private (Tenant)
   */
  public static async deleteAudit(req: Request, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const id = req.params.id as string;

      if (!organizationId) {
        return res.status(401).json({
          success: false,
          message: "Organization context is required",
        });
      }

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Session ID parameter is required",
        });
      }

      const deleted = await vastuService.deleteSession(id, organizationId);

      res.status(200).json({
        success: true,
        message: "Vastu audit session deleted successfully",
        data: deleted,
      });
    } catch (error: any) {
      res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Failed to delete Vastu audit",
      });
    }
  }
}

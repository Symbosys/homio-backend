import { VastuAuditRepository } from "../repositories/vastu-audit.repository.js";
import { VastuAuditChain } from "../../../lib/langchain/index.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import type {
  GenerateVastuAuditInput,
  QueryVastuAuditsInput,
  UpdateVastuAuditInput,
} from "../validators/vastu-audit.validator.js";

export class VastuAuditService {
  private repo: VastuAuditRepository;

  constructor() {
    this.repo = new VastuAuditRepository();
  }

  /**
   * Determine per-audit credit deduction cost
   */
  public async getAuditCost(): Promise<number> {
    const rate = await this.repo.getVastuServiceRate();
    return rate?.defaultCreditCost ?? 15;
  }

  /**
   * Generate AI Vastu Spatial Audit using LangChain Vedic Reasoning Engine
   */
  public async generateVastuAudit(
    organizationId: string,
    employeeId: string | null,
    input: GenerateVastuAuditInput
  ) {
    const startTime = Date.now();
    const cost = await this.getAuditCost();

    // 1. Verify organization credit balance
    const wallet = await this.repo.findOrCreateWallet(organizationId);
    if (wallet.currentBalance < cost) {
      const err: any = new Error(
        `Insufficient AI credits. You have ${wallet.currentBalance} credits, but running a comprehensive Vastu spatial audit requires ${cost} credits.`
      );
      err.statusCode = 402;
      err.code = "INSUFFICIENT_CREDITS";
      throw err;
    }

    // 2. Execute deep 16-zone Vedic analysis via LangChain
    const auditResult = await VastuAuditChain.executeAudit({
      propertyType: input.propertyType,
      facingDirection: input.facingDirection,
      totalAreaSqft: input.totalAreaSqft,
      numberOfFloors: input.numberOfFloors,
      city: input.city,
      selectedFocusAreas: input.selectedFocusAreas,
      customInstructions: input.customInstructions,
      floorPlanUrl: input.floorPlanUrl,
      sitePhotos: input.sitePhotos,
      hasFloorPlan: Boolean(input.floorPlanUrl),
      hasSitePhotos: Boolean(input.sitePhotos && input.sitePhotos.length > 0),
    });

    const executionDurationMs = Date.now() - startTime;

    // 3. Save session and audit satellite records in database
    const vastuSession = await this.repo.createVastuAuditSession({
      organizationId,
      employeeId,
      propertyType: input.propertyType,
      facingDirection: input.facingDirection,
      totalAreaSqft: input.totalAreaSqft,
      numberOfFloors: input.numberOfFloors,
      floorPlanUrl: input.floorPlanUrl,
      sitePhotos: input.sitePhotos,
      overallScore: auditResult.overallScore,
      zoneBreakdown: auditResult.zoneBreakdown,
      remedialSolutions: auditResult.remedialSolutions,
      boqEstimations: auditResult.boqEstimations,
      additionalInformation: input.additionalInformation,
      executionDurationMs,
    });

    // 4. Atomic Credit Deduction & Ledger Entry
    const { wallet: updatedWallet } = await this.repo.atomicDeductCredits({
      organizationId,
      employeeId,
      sessionId: vastuSession.sessionId,
      cost,
      description: `AI Vastu Spatial Audit: ${input.propertyType} (${input.facingDirection} Facing)`,
    });

    return {
      session: vastuSession,
      audit: auditResult,
      wallet: updatedWallet,
      creditsDeducted: cost,
    };
  }

  /**
   * List paginated Vastu audit sessions
   */
  public async listSessions(
    organizationId: string,
    query: QueryVastuAuditsInput
  ) {
    return this.repo.listSessions(organizationId, query);
  }

  /**
   * Get single Vastu audit session by ID
   */
  public async getSessionById(sessionId: string, organizationId: string) {
    const session = await this.repo.getSessionById(sessionId, organizationId);
    if (!session) {
      const err: any = new Error("Vastu audit session not found");
      err.statusCode = 404;
      throw err;
    }
    return session;
  }

  /**
   * Update session metadata
   */
  public async updateSession(
    sessionId: string,
    organizationId: string,
    data: UpdateVastuAuditInput
  ) {
    const result = await this.repo.updateSession(
      sessionId,
      organizationId,
      data
    );
    if (!result) {
      const err: any = new Error("Vastu audit session not found");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }

  /**
   * Delete Vastu audit session & auto-cleanup cloud storage media (Rule 4 Standard)
   */
  public async deleteSession(sessionId: string, organizationId: string) {
    const session = await this.repo.deleteSession(sessionId, organizationId);
    if (!session) {
      const err: any = new Error("Vastu audit session not found");
      err.statusCode = 404;
      throw err;
    }

    // Auto-cleanup all cloud media assets (Rule 4)
    try {
      if (session.floorPlanUrl && (session.floorPlanUrl as any).id) {
        await storageService.delete((session.floorPlanUrl as any).id);
      }

      if (Array.isArray(session.sitePhotos)) {
        for (const photo of session.sitePhotos as any[]) {
          if (photo?.id) {
            await storageService.delete(photo.id);
          }
        }
      }
    } catch (cleanupErr) {
      console.warn("[VastuAuditService] Media cleanup warning:", cleanupErr);
    }

    return session;
  }
}

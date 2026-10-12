import { labourDisputeRepo } from "../repos/labour-dispute.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { MARKETPLACE_CONFIG } from "../../../constants/marketplace.constants.js";
import type { ImageType } from "../../../types/types.js";
import type {
  CreateLabourDisputeInput,
  ReportBypassAttemptInput,
  ReportClientPaymentDueInput,
  ReportLabourAbandonmentInput,
  AssignEmpanelledLawyerInput,
  RecordLegalNoticeInput,
  RecordLabourCourtActionInput,
  UpdateLabourDisputeInput,
  UpdateDisputeStatusInput,
  GetLabourDisputesQuery,
} from "../validators/labour-dispute.validator.js";

/**
 * Labour Dispute Service
 * Manages site and legal dispute cases, evidence docs, empanelled lawyers, Labour Court action,
 * and automated platform disciplinary governance (rating penalties, warning counter, blacklisting).
 */
export class LabourDisputeService {
  /**
   * Helper: Prunes old cloud documents
   */
  private async pruneOldCloudAssets(docs: unknown) {
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc && typeof doc === "object" && "id" in doc && doc.id) {
          try {
            await storageService.delete(doc.id);
          } catch (error) {
            console.error(`[LabourDisputeService] Failed to prune evidence doc ${doc.id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Helper: Upload multiple files to cloud storage
   */
  private async uploadMultipleToCloud(
    files: Express.Multer.File[],
    folder: string
  ): Promise<ImageType[]> {
    const results: ImageType[] = [];
    for (const file of files) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        { folder }
      );
      results.push({
        id: uploadResult.publicId,
        url: uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      });
    }
    return results;
  }

  /**
   * Create regular dispute case
   */
  async createDispute(
    payload: CreateLabourDisputeInput,
    organizationId?: string | null,
    files?: Express.Multer.File[]
  ) {
    const labour = await labourRepo.findById(payload.labourId, organizationId || undefined);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    if (payload.bookingId) {
      const booking = await labourBookingRepo.findById(
        payload.bookingId,
        organizationId ? { organizationId } : undefined
      );
      if (!booking) {
        throw new ErrorResponse("Labour booking not found or unauthorized", statusCode.Not_Found);
      }
    }

    let evidenceDocs = payload.evidenceDocs || [];
    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = [...evidenceDocs, ...uploaded];
    }

    return labourDisputeRepo.create({
      ...payload,
      evidenceDocs,
    });
  }

  /**
   * Report off-platform cash bypass attempt
   */
  async reportBypassAttempt(
    payload: ReportBypassAttemptInput,
    reportingUserId: string,
    files?: Express.Multer.File[]
  ) {
    const booking = await labourBookingRepo.findById(payload.bookingId);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    let evidenceDocs = payload.evidenceDocs || [];
    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = [...evidenceDocs, ...uploaded];
    }

    const dispute = await labourDisputeRepo.create({
      labourId: booking.labourId,
      bookingId: booking.id,
      disputeType: "OFF_PLATFORM_BYPASS",
      status: "UNDER_REVIEW",
      initiator: payload.reportedRole === "CLIENT" ? "LABOUR" : "CLIENT",
      reason: `Off-platform cash bypass attempt reported against ${payload.reportedRole}: ${payload.reason}`,
      evidenceDocs,
    });

    // Disciplinary Action: apply rating penalties
    if (payload.reportedRole === "CLIENT" && booking.clientId) {
      const client = await prisma.user.findUnique({ where: { id: booking.clientId } });
      if (client) {
        const newRating = Math.max(1.0, (client.clientRating || 5.0) - MARKETPLACE_CONFIG.RATING_PENALTY_BYPASS_ATTEMPT);
        await prisma.user.update({
          where: { id: booking.clientId },
          data: { clientRating: newRating },
        });
      }
    } else if (payload.reportedRole === "LABOUR") {
      const labour = await prisma.labour.findUnique({ where: { id: booking.labourId } });
      if (labour) {
        const newRating = Math.max(1.0, labour.averageRating - MARKETPLACE_CONFIG.RATING_PENALTY_BYPASS_ATTEMPT);
        const warningCount = labour.warningCount + 1;
        const shouldBlacklist = warningCount >= MARKETPLACE_CONFIG.MAX_LABOUR_WARNINGS_BEFORE_BLACKLIST;

        await prisma.labour.update({
          where: { id: booking.labourId },
          data: {
            averageRating: newRating,
            warningCount,
            ...(shouldBlacklist && {
              isBlacklisted: true,
              blacklistedAt: new Date(),
              blacklistReason: "Repeated off-platform bypass violations and policy non-compliance",
            }),
          },
        });
      }
    }

    return dispute;
  }

  /**
   * Worker reports unpaid dues / payment default by client
   */
  async reportClientPaymentDue(
    payload: ReportClientPaymentDueInput,
    workerUserId: string,
    files?: Express.Multer.File[]
  ) {
    const booking = await labourBookingRepo.findById(payload.bookingId);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }
    if (!booking.clientId) {
      throw new ErrorResponse("Booking does not have an associated marketplace client", statusCode.Bad_Request);
    }

    let evidenceDocs = payload.evidenceDocs || [];
    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = [...evidenceDocs, ...uploaded];
    }

    const dispute = await labourDisputeRepo.create({
      labourId: booking.labourId,
      bookingId: booking.id,
      disputeType: "PAYMENT_DEFAULT",
      amountInDispute: payload.amountInDispute,
      status: "OPEN",
      initiator: "LABOUR",
      reason: payload.reason,
      evidenceDocs,
    });

    // Governance: penalize client and increment dues count
    const client = await prisma.user.findUnique({ where: { id: booking.clientId } });
    if (client) {
      const newDuesCount = (client.clientDuesCount || 0) + 1;
      const newRating = Math.max(1.0, (client.clientRating || 5.0) - MARKETPLACE_CONFIG.RATING_PENALTY_PAYMENT_DUE);
      const shouldBlacklist = newDuesCount >= MARKETPLACE_CONFIG.MAX_CLIENT_PAYMENT_DUES_BEFORE_BLACKLIST;

      await prisma.user.update({
        where: { id: booking.clientId },
        data: {
          clientDuesCount: newDuesCount,
          clientRating: newRating,
          ...(shouldBlacklist && {
            isBlacklisted: true,
            blacklistedAt: new Date(),
            blacklistReason: "Accumulated multiple unresolved payment defaults and unpaid worker wages",
          }),
        },
      });
    }

    return dispute;
  }

  /**
   * Client reports labour worker work abandonment
   */
  async reportLabourAbandonment(
    payload: ReportLabourAbandonmentInput,
    clientUserId: string,
    files?: Express.Multer.File[]
  ) {
    const booking = await labourBookingRepo.findById(payload.bookingId);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    let evidenceDocs = payload.evidenceDocs || [];
    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = [...evidenceDocs, ...uploaded];
    }

    const dispute = await labourDisputeRepo.create({
      labourId: booking.labourId,
      bookingId: booking.id,
      disputeType: "WORK_ABANDONMENT",
      status: "OPEN",
      initiator: "CLIENT",
      reason: payload.reason,
      evidenceDocs,
    });

    // Governance: increment worker warnings and assess blacklisting
    const labour = await prisma.labour.findUnique({ where: { id: booking.labourId } });
    if (labour) {
      const warningCount = labour.warningCount + 1;
      const shouldBlacklist = warningCount >= MARKETPLACE_CONFIG.MAX_LABOUR_WARNINGS_BEFORE_BLACKLIST;
      const newRating = Math.max(1.0, labour.averageRating - 0.50);

      await prisma.labour.update({
        where: { id: booking.labourId },
        data: {
          warningCount,
          averageRating: newRating,
          ...(shouldBlacklist && {
            isBlacklisted: true,
            blacklistedAt: new Date(),
            blacklistReason: "Exceeded disciplinary threshold: multiple warnings for work abandonment",
          }),
        },
      });
    }

    return dispute;
  }

  /**
   * Legal Escalation: Assign empanelled common lawyer
   */
  async assignEmpanelledLawyer(id: string, payload: AssignEmpanelledLawyerInput) {
    const existing = await labourDisputeRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Dispute case not found", statusCode.Not_Found);
    }

    return labourDisputeRepo.update(id, {
      lawyerAssigned: true,
      lawyerName: payload.lawyerName,
      lawyerPhone: payload.lawyerPhone,
      lawyerBarCouncilNo: payload.lawyerBarCouncilNo,
      lawyerAssignedAt: new Date(),
      status: "UNDER_REVIEW",
      actionTaken: `Empanelled lawyer ${payload.lawyerName} assigned for legal representation.`,
    });
  }

  /**
   * Legal Escalation: Record dispatch of legal notice
   */
  async recordLegalNotice(id: string, payload: RecordLegalNoticeInput) {
    const existing = await labourDisputeRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Dispute case not found", statusCode.Not_Found);
    }

    return labourDisputeRepo.update(id, {
      legalNoticeSent: true,
      legalNoticeDate: new Date(),
      legalNoticeDoc: payload.legalNoticeDoc,
      status: "NOTICE_SENT",
      actionTaken: payload.noticeSummary || "Formal demand notice dispatched to respondent.",
    });
  }

  /**
   * Legal Escalation: Record filing in Labour Court
   */
  async recordLabourCourtAction(id: string, payload: RecordLabourCourtActionInput) {
    const existing = await labourDisputeRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Dispute case not found", statusCode.Not_Found);
    }

    return labourDisputeRepo.update(id, {
      labourCourtFiled: true,
      labourCourtCaseNo: payload.labourCourtCaseNo,
      labourCourtDate: payload.labourCourtDate || new Date(),
      status: "UNDER_REVIEW",
      actionTaken: payload.actionSummary || `Labour Court recovery claim registered under Case No: ${payload.labourCourtCaseNo}.`,
    });
  }

  /**
   * Get dispute by ID
   */
  async getDisputeById(
    id: string,
    scope?:
      | string
      | null
      | {
          organizationId?: string | null;
          clientId?: string | null;
          labourId?: string | null;
          isPlatformAdmin?: boolean;
        }
  ) {
    const normalizedScope =
      typeof scope === "string"
        ? { organizationId: scope }
        : scope === null
        ? {}
        : scope;
    const dispute = await labourDisputeRepo.findById(id, normalizedScope);
    if (!dispute) {
      throw new ErrorResponse("Dispute case not found or unauthorized", statusCode.Not_Found);
    }
    return dispute;
  }

  /**
   * Get all paginated disputes
   */
  async getDisputes(query: GetLabourDisputesQuery, organizationId?: string | null) {
    return labourDisputeRepo.findAll(query, { organizationId });
  }

  /**
   * Update dispute case
   */
  async updateDispute(
    id: string,
    payload: UpdateLabourDisputeInput,
    organizationId?: string | null,
    files?: Express.Multer.File[]
  ) {
    const existing = await this.getDisputeById(id, organizationId);

    let evidenceDocs = payload.evidenceDocs !== undefined ? payload.evidenceDocs : (existing.evidenceDocs as any) || [];

    if (typeof evidenceDocs === "string") {
      try {
        evidenceDocs = JSON.parse(evidenceDocs);
      } catch {
        // ignore
      }
    }

    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = Array.isArray(evidenceDocs) ? [...evidenceDocs, ...uploaded] : uploaded;
    }

    return labourDisputeRepo.update(id, {
      ...payload,
      evidenceDocs,
    });
  }

  /**
   * Update dispute status / resolution
   */
  async updateStatus(id: string, payload: UpdateDisputeStatusInput, organizationId?: string | null) {
    await this.getDisputeById(id, organizationId);
    return labourDisputeRepo.update(id, payload);
  }

  /**
   * Delete dispute and prune cloud evidence docs
   */
  async deleteDispute(id: string, organizationId?: string | null) {
    const existing = await this.getDisputeById(id, organizationId);
    if (existing.evidenceDocs) {
      await this.pruneOldCloudAssets(existing.evidenceDocs);
    }
    return labourDisputeRepo.delete(id);
  }
}

export const labourDisputeService = new LabourDisputeService();

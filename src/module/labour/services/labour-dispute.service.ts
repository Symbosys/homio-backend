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
  TakeDisputeActionInput,
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
    } else if (payload.reportedRole === "LABOUR" && booking.labourId) {
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
    if (booking.labourId) {
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
   * Platform Admin takes disciplinary or legal action against a dispute
   * Actions: CLIENT_RATING_DOWN, CLIENT_BLACKLISTED, LABOUR_WARNED, LABOUR_BLACKLISTED, LABOUR_RATING_DOWN, LEGAL_ACTION
   */
  async takeDisputeAction(id: string, payload: TakeDisputeActionInput, adminUserId?: string) {
    const dispute = await labourDisputeRepo.findById(id);
    if (!dispute) {
      throw new ErrorResponse("Dispute case not found", statusCode.Not_Found);
    }

    const currentAddl = (dispute.additionalInformation as Record<string, any>) || {};
    let actionDetails: Record<string, any> = {
      action: payload.action,
      appliedAt: new Date().toISOString(),
      appliedBy: adminUserId || "PLATFORM_ADMIN",
      notes: payload.notes || null,
    };

    let updateDisputeData: Record<string, any> = {
      actionTaken: payload.action,
    };

    // 1. CLIENT_RATING_DOWN
    if (payload.action === "CLIENT_RATING_DOWN") {
      let targetClientId = dispute.booking?.clientId;
      if (!targetClientId && dispute.bookingId) {
        const booking = await prisma.labourBooking.findUnique({
          where: { id: dispute.bookingId },
          select: { clientId: true },
        });
        targetClientId = booking?.clientId || null;
      }

      if (!targetClientId) {
        throw new ErrorResponse("No linked client found for this dispute to adjust rating", statusCode.Bad_Request);
      }

      const client = await prisma.user.findUnique({ where: { id: targetClientId } });
      if (!client) {
        throw new ErrorResponse("Target client user account not found", statusCode.Not_Found);
      }

      const prevRating = client.clientRating ?? 5.0;
      let newRating: number;
      if (payload.clientRating !== undefined) {
        newRating = Math.max(1.0, Math.min(5.0, Number(payload.clientRating)));
      } else if (payload.ratingDeduction !== undefined) {
        newRating = Math.max(1.0, prevRating - Number(payload.ratingDeduction));
      } else {
        newRating = Math.max(1.0, prevRating - 1.0);
      }

      await prisma.user.update({
        where: { id: targetClientId },
        data: { clientRating: newRating },
      });

      actionDetails = {
        ...actionDetails,
        targetClientId,
        previousRating: prevRating,
        newRating,
        deduction: prevRating - newRating,
      };
      updateDisputeData.status = "UNDER_REVIEW";
      updateDisputeData.resolutionSummary = `Platform reduced client rating to ${newRating.toFixed(1)}★.`;
    }

    // 2. CLIENT_BLACKLISTED
    else if (payload.action === "CLIENT_BLACKLISTED") {
      let targetClientId = dispute.booking?.clientId;
      if (!targetClientId && dispute.bookingId) {
        const booking = await prisma.labourBooking.findUnique({
          where: { id: dispute.bookingId },
          select: { clientId: true },
        });
        targetClientId = booking?.clientId || null;
      }

      if (!targetClientId) {
        throw new ErrorResponse("No linked client found for this dispute to blacklist", statusCode.Bad_Request);
      }

      const reason = payload.blacklistReason || payload.notes || "Disciplinary violation: Dispute default / misconduct";

      await prisma.user.update({
        where: { id: targetClientId },
        data: {
          isBlacklisted: true,
          blacklistedAt: new Date(),
          blacklistReason: reason,
        },
      });

      actionDetails = {
        ...actionDetails,
        targetClientId,
        blacklistReason: reason,
        blacklistedAt: new Date().toISOString(),
      };
      updateDisputeData.status = "UNDER_REVIEW";
      updateDisputeData.resolutionSummary = `Platform blacklisted client account: ${reason}`;
    }

    // 3. LABOUR_WARNED
    else if (payload.action === "LABOUR_WARNED") {
      const labour = await prisma.labour.findUnique({ where: { id: dispute.labourId } });
      if (!labour) {
        throw new ErrorResponse("Target labour worker not found", statusCode.Not_Found);
      }

      const warningMessage = payload.warningMessage || payload.notes || "Disciplinary notice issued by platform governance.";
      const newWarningCount = (labour.warningCount || 0) + 1;
      const shouldBlacklist = newWarningCount >= MARKETPLACE_CONFIG.MAX_LABOUR_WARNINGS_BEFORE_BLACKLIST;

      const labourAddl = (labour.additionalInformation as Record<string, any>) || {};
      const warningsList = Array.isArray(labourAddl.warnings)
        ? [...labourAddl.warnings, { message: warningMessage, disputeId: id, warnedAt: new Date().toISOString() }]
        : [{ message: warningMessage, disputeId: id, warnedAt: new Date().toISOString() }];

      await prisma.labour.update({
        where: { id: dispute.labourId },
        data: {
          warningCount: newWarningCount,
          additionalInformation: { ...labourAddl, warnings: warningsList },
          ...(shouldBlacklist && {
            isBlacklisted: true,
            blacklistedAt: new Date(),
            blacklistReason: `Accumulated disciplinary threshold: ${newWarningCount} warnings`,
          }),
        },
      });

      // Also attach the warning to the linked booking so it's shown in the Labour Panel Labour Booking view
      if (dispute.bookingId) {
        const booking = await prisma.labourBooking.findUnique({ where: { id: dispute.bookingId } });
        if (booking) {
          const bookingAddl = (booking.additionalInformation as Record<string, any>) || {};
          await prisma.labourBooking.update({
            where: { id: dispute.bookingId },
            data: {
              additionalInformation: {
                ...bookingAddl,
                labourWarning: {
                  message: warningMessage,
                  disputeId: id,
                  warningCount: newWarningCount,
                  warnedAt: new Date().toISOString(),
                },
              },
            },
          });
        }
      }

      actionDetails = {
        ...actionDetails,
        warningMessage,
        warningCount: newWarningCount,
        labourId: dispute.labourId,
      };
      updateDisputeData.status = "UNDER_REVIEW";
      updateDisputeData.resolutionSummary = `Official warning issued to worker (${newWarningCount} warning(s)): ${warningMessage}`;
    }

    // 4. LABOUR_BLACKLISTED
    else if (payload.action === "LABOUR_BLACKLISTED") {
      const labour = await prisma.labour.findUnique({ where: { id: dispute.labourId } });
      if (!labour) {
        throw new ErrorResponse("Target labour worker not found", statusCode.Not_Found);
      }

      const reason = payload.blacklistReason || payload.notes || "Disciplinary violation: Dispute breach / misconduct";

      await prisma.labour.update({
        where: { id: dispute.labourId },
        data: {
          isBlacklisted: true,
          blacklistedAt: new Date(),
          blacklistReason: reason,
          isAvailable: false,
          status: "BLACKLISTED",
        },
      });

      actionDetails = {
        ...actionDetails,
        labourId: dispute.labourId,
        blacklistReason: reason,
        blacklistedAt: new Date().toISOString(),
      };
      updateDisputeData.status = "UNDER_REVIEW";
      updateDisputeData.resolutionSummary = `Platform blacklisted worker profile: ${reason}`;
    }

    // 5. LABOUR_RATING_DOWN
    else if (payload.action === "LABOUR_RATING_DOWN") {
      const labour = await prisma.labour.findUnique({ where: { id: dispute.labourId } });
      if (!labour) {
        throw new ErrorResponse("Target labour worker not found", statusCode.Not_Found);
      }

      const prevRating = labour.averageRating ?? 5.0;
      let newRating: number;
      if (payload.labourRating !== undefined) {
        newRating = Math.max(1.0, Math.min(5.0, Number(payload.labourRating)));
      } else if (payload.ratingDeduction !== undefined) {
        newRating = Math.max(1.0, prevRating - Number(payload.ratingDeduction));
      } else {
        newRating = Math.max(1.0, prevRating - 0.50);
      }

      await prisma.labour.update({
        where: { id: dispute.labourId },
        data: { averageRating: newRating },
      });

      actionDetails = {
        ...actionDetails,
        labourId: dispute.labourId,
        previousRating: prevRating,
        newRating,
        deduction: prevRating - newRating,
      };
      updateDisputeData.status = "UNDER_REVIEW";
      updateDisputeData.resolutionSummary = `Platform penalized worker rating to ${newRating.toFixed(1)}★.`;
    }

    // 6. LEGAL_ACTION
    else if (payload.action === "LEGAL_ACTION") {
      const lawyerAssigned = payload.lawyerAssigned ?? Boolean(payload.lawyerName);
      const lawyerAssignedAt = payload.lawyerAssignedAt
        ? new Date(payload.lawyerAssignedAt)
        : lawyerAssigned
        ? new Date()
        : null;

      const legalNoticeSent = payload.legalNoticeSent ?? Boolean(payload.legalNoticeDate);
      const legalNoticeDate = payload.legalNoticeDate ? new Date(payload.legalNoticeDate) : legalNoticeSent ? new Date() : null;

      const labourCourtFiled = payload.labourCourtFiled ?? Boolean(payload.labourCourtCaseNo);
      const labourCourtDate = payload.labourCourtDate ? new Date(payload.labourCourtDate) : labourCourtFiled ? new Date() : null;
      const hearingDate = payload.hearingDate ? new Date(payload.hearingDate) : null;

      updateDisputeData = {
        ...updateDisputeData,
        lawyerAssigned,
        lawyerName: payload.lawyerName || null,
        lawyerPhone: payload.lawyerPhone || null,
        lawyerBarCouncilNo: payload.lawyerBarCouncilNo || null,
        lawyerAssignedAt,
        legalNoticeSent,
        legalNoticeDate,
        ...(payload.legalNoticeDoc ? { legalNoticeDoc: payload.legalNoticeDoc } : {}),
        labourCourtFiled,
        labourCourtCaseNo: payload.labourCourtCaseNo || null,
        labourCourtDate,
        hearingDate,
        status: labourCourtFiled
          ? "LABOUR_COURT_FILED"
          : legalNoticeSent
          ? "NOTICE_SENT"
          : lawyerAssigned
          ? "LAWYER_ASSIGNED"
          : "UNDER_REVIEW",
        resolutionSummary:
          payload.resolutionSummary ||
          (labourCourtFiled
            ? `Labour Court action registered under Case #${payload.labourCourtCaseNo}`
            : legalNoticeSent
            ? "Statutory legal demand notice issued"
            : lawyerAssigned
            ? `Advocate ${payload.lawyerName} assigned for representation`
            : "Legal proceedings initiated"),
      };

      actionDetails = {
        ...actionDetails,
        lawyerAssigned,
        lawyerName: payload.lawyerName,
        lawyerPhone: payload.lawyerPhone,
        lawyerBarCouncilNo: payload.lawyerBarCouncilNo,
        lawyerAssignedAt: lawyerAssignedAt?.toISOString(),
        legalNoticeSent,
        legalNoticeDate: legalNoticeDate?.toISOString(),
        labourCourtFiled,
        labourCourtCaseNo: payload.labourCourtCaseNo,
        labourCourtDate: labourCourtDate?.toISOString(),
        hearingDate: hearingDate?.toISOString(),
      };
    }

    // Append to actionHistory in additionalInformation
    const historyList = Array.isArray(currentAddl.actionHistory)
      ? [...currentAddl.actionHistory, actionDetails]
      : [actionDetails];

    updateDisputeData.additionalInformation = {
      ...currentAddl,
      actionDetails,
      actionHistory: historyList,
    };

    return labourDisputeRepo.update(id, updateDisputeData);
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

  /**
   * Get worker disputes overview (status statistics and all disputes belonging to worker)
   */
  async getWorkerDisputesOverview(
    actor: { id: string; userType?: string; organizationId?: string | null },
    query: GetLabourDisputesQuery,
  ) {
    let targetLabourId = query.labourId;
    if (!targetLabourId) {
      const labour = await prisma.labour.findFirst({
        where: { userId: actor.id, isDeleted: false },
        select: { id: true, name: true, trade: true },
      });
      if (!labour) {
        throw new ErrorResponse(
          "No labour profile found linked to your account",
          statusCode.Not_Found,
        );
      }
      targetLabourId = labour.id;
    }

    // 1. Fetch summary metrics for worker disputes
    const allDisputes = await prisma.labourDispute.findMany({
      where: { labourId: targetLabourId },
      select: {
        id: true,
        status: true,
        disputeType: true,
        amountInDispute: true,
        lawyerAssigned: true,
        legalNoticeSent: true,
        labourCourtFiled: true,
      },
    });

    const totalDisputes = allDisputes.length;
    const openCount = allDisputes.filter((d) => d.status === "OPEN").length;
    const inInvestigationCount = allDisputes.filter(
      (d) =>
        d.status === "UNDER_INVESTIGATION" ||
        d.status === "UNDER_REVIEW" ||
        d.status === "LAWYER_ASSIGNED" ||
        d.status === "NOTICE_SENT",
    ).length;
    const legalCount = allDisputes.filter(
      (d) => d.lawyerAssigned || d.legalNoticeSent || d.labourCourtFiled,
    ).length;
    const settledCount = allDisputes.filter(
      (d) =>
        d.status === "SETTLED" ||
        d.status === "RESOLVED" ||
        d.status === "CLOSED",
    ).length;
    const totalDisputedAmount = allDisputes.reduce(
      (sum, d) => sum + Number(d.amountInDispute ?? 0),
      0,
    );

    // 2. Fetch paginated disputes with full action details
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: any = { labourId: targetLabourId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.disputeType) {
      where.disputeType = query.disputeType;
    }
    if (query.initiator) {
      where.initiator = query.initiator;
    }

    const [total, items] = await Promise.all([
      prisma.labourDispute.count({ where }),
      prisma.labourDispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          labour: {
            select: {
              id: true,
              name: true,
              trade: true,
              phone: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              workTitle: true,
              channel: true,
              locality: true,
              city: true,
              dealValue: true,
              totalBudget: true,
              client: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      summary: {
        totalDisputes,
        openCount,
        inInvestigationCount,
        legalCount,
        settledCount,
        totalDisputedAmount: Math.round(totalDisputedAmount * 100) / 100,
      },
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const labourDisputeService = new LabourDisputeService();

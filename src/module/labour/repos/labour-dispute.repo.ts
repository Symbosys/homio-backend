import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourDisputesQuery } from "../validators/labour-dispute.validator.js";

const DISPUTE_DETAILS_INCLUDE = {
  labour: {
    select: {
      id: true,
      name: true,
      phone: true,
      trade: true,
      photoUrl: true,
      averageRating: true,
      warningCount: true,
      isBlacklisted: true,
    },
  },
  booking: {
    select: {
      id: true,
      bookingNumber: true,
      workTitle: true,
      channel: true,
      clientId: true,
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          clientRating: true,
          clientDuesCount: true,
          isBlacklisted: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
          projectCode: true,
        },
      },
    },
  },
} as const;

/**
 * Labour Dispute Repository
 * Handles legal and site dispute case tracking, damages, empanelled lawyers, and resolution.
 */
export class LabourDisputeRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Enrich output dispute object with convenience properties
   * from additionalInformation and mapped dates
   */
  private formatDisputeOutput<T extends any>(dispute: T): T {
    if (!dispute || typeof dispute !== "object") return dispute;
    const item = dispute as Record<string, any>;
    const addInfo =
      item.additionalInformation &&
      typeof item.additionalInformation === "object" &&
      !Array.isArray(item.additionalInformation)
        ? (item.additionalInformation as Record<string, any>)
        : {};

    return {
      ...item,
      lawyerEmail: item.lawyerEmail ?? addInfo.lawyerEmail ?? null,
      legalNoticeRef: item.legalNoticeRef ?? addInfo.legalNoticeRef ?? null,
      legalNoticeSentAt: item.legalNoticeSentAt ?? item.legalNoticeDate ?? null,
      labourCourtFilingDate: item.labourCourtFilingDate ?? item.labourCourtDate ?? null,
      labourCourtLocation: item.labourCourtLocation ?? addInfo.labourCourtLocation ?? null,
    } as T;
  }

  /**
   * Normalize and sanitize payload for Prisma LabourDispute model.
   * Preserves non-schema attributes (lawyerEmail, legalNoticeRef, labourCourtLocation)
   * inside additionalInformation (Rule 18) and maps date aliases.
   */
  private preparePrismaDisputeData(data: Record<string, any>, existingAdditionalInfo?: Record<string, any>) {
    let additionalInfo: Record<string, any> = existingAdditionalInfo ? { ...existingAdditionalInfo } : {};

    // Merge incoming additionalInformation if provided
    if (data.additionalInformation !== undefined) {
      if (typeof data.additionalInformation === "string") {
        try {
          const parsed = JSON.parse(data.additionalInformation);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            additionalInfo = { ...additionalInfo, ...parsed };
          }
        } catch {
          // ignore parsing error
        }
      } else if (
        data.additionalInformation &&
        typeof data.additionalInformation === "object" &&
        !Array.isArray(data.additionalInformation)
      ) {
        additionalInfo = { ...additionalInfo, ...data.additionalInformation };
      }
    }

    // Persist non-schema properties inside additionalInformation
    if (data.lawyerEmail !== undefined) {
      if (data.lawyerEmail && typeof data.lawyerEmail === "string" && data.lawyerEmail.trim()) {
        additionalInfo.lawyerEmail = data.lawyerEmail.trim();
      } else {
        delete additionalInfo.lawyerEmail;
      }
    }

    if (data.legalNoticeRef !== undefined) {
      if (data.legalNoticeRef && typeof data.legalNoticeRef === "string" && data.legalNoticeRef.trim()) {
        additionalInfo.legalNoticeRef = data.legalNoticeRef.trim();
      } else {
        delete additionalInfo.legalNoticeRef;
      }
    }

    if (data.labourCourtLocation !== undefined) {
      if (data.labourCourtLocation && typeof data.labourCourtLocation === "string" && data.labourCourtLocation.trim()) {
        additionalInfo.labourCourtLocation = data.labourCourtLocation.trim();
      } else {
        delete additionalInfo.labourCourtLocation;
      }
    }

    // Map date aliases
    const legalNoticeDate =
      data.legalNoticeDate !== undefined
        ? data.legalNoticeDate
        : data.legalNoticeSentAt !== undefined
        ? data.legalNoticeSentAt
        : undefined;

    const labourCourtDate =
      data.labourCourtDate !== undefined
        ? data.labourCourtDate
        : data.labourCourtFilingDate !== undefined
        ? data.labourCourtFilingDate
        : undefined;

    // Derive boolean flags
    let lawyerAssigned: boolean | undefined = data.lawyerAssigned;
    if (lawyerAssigned === undefined && data.lawyerName !== undefined) {
      lawyerAssigned = Boolean(data.lawyerName && typeof data.lawyerName === "string" && data.lawyerName.trim().length > 0);
    }

    let legalNoticeSent: boolean | undefined = data.legalNoticeSent;
    if (legalNoticeSent === undefined && (legalNoticeDate || data.legalNoticeRef || data.legalNoticeDoc)) {
      legalNoticeSent = true;
    }

    let labourCourtFiled: boolean | undefined = data.labourCourtFiled;
    if (labourCourtFiled === undefined && (data.labourCourtCaseNo || labourCourtDate)) {
      labourCourtFiled = Boolean(
        data.labourCourtCaseNo && typeof data.labourCourtCaseNo === "string" && data.labourCourtCaseNo.trim().length > 0
      );
    }

    // Parse evidenceDocs if passed as raw string JSON
    let evidenceDocs = data.evidenceDocs;
    if (typeof evidenceDocs === "string") {
      try {
        evidenceDocs = JSON.parse(evidenceDocs);
      } catch {
        // ignore
      }
    }

    // Build strictly valid Prisma LabourDispute columns
    const cleanData: any = {};

    if (data.labourId !== undefined) cleanData.labourId = data.labourId;
    if (data.bookingId !== undefined) cleanData.bookingId = data.bookingId;
    if (data.disputeType !== undefined) cleanData.disputeType = data.disputeType;
    if (data.amountInDispute !== undefined) cleanData.amountInDispute = data.amountInDispute;
    if (data.status !== undefined) cleanData.status = data.status;
    if (data.initiator !== undefined) cleanData.initiator = data.initiator;
    if (data.reason !== undefined) cleanData.reason = data.reason;
    if (data.resolutionSummary !== undefined) cleanData.resolutionSummary = data.resolutionSummary;

    // Lawyer fields
    if (lawyerAssigned !== undefined) cleanData.lawyerAssigned = lawyerAssigned;
    if (data.lawyerName !== undefined) cleanData.lawyerName = data.lawyerName;
    if (data.lawyerPhone !== undefined) cleanData.lawyerPhone = data.lawyerPhone;
    if (data.lawyerBarCouncilNo !== undefined) cleanData.lawyerBarCouncilNo = data.lawyerBarCouncilNo;
    if (data.lawyerAssignedAt !== undefined) {
      cleanData.lawyerAssignedAt = data.lawyerAssignedAt ? new Date(data.lawyerAssignedAt) : null;
    } else if (lawyerAssigned && cleanData.lawyerAssignedAt === undefined) {
      cleanData.lawyerAssignedAt = new Date();
    }

    // Legal notice fields
    if (legalNoticeSent !== undefined) cleanData.legalNoticeSent = legalNoticeSent;
    if (legalNoticeDate !== undefined) {
      cleanData.legalNoticeDate = legalNoticeDate ? new Date(legalNoticeDate) : null;
    }
    if (data.legalNoticeDoc !== undefined) cleanData.legalNoticeDoc = this.formatJsonValue(data.legalNoticeDoc);

    // Labour court fields
    if (labourCourtFiled !== undefined) cleanData.labourCourtFiled = labourCourtFiled;
    if (data.labourCourtCaseNo !== undefined) cleanData.labourCourtCaseNo = data.labourCourtCaseNo;
    if (labourCourtDate !== undefined) {
      cleanData.labourCourtDate = labourCourtDate ? new Date(labourCourtDate) : null;
    }

    // Dates & Attachments
    if (data.hearingDate !== undefined) {
      cleanData.hearingDate = data.hearingDate ? new Date(data.hearingDate) : null;
    }
    if (evidenceDocs !== undefined) cleanData.evidenceDocs = this.formatJsonValue(evidenceDocs);
    if (data.actionTaken !== undefined) cleanData.actionTaken = data.actionTaken;

    // Additional information
    cleanData.additionalInformation = this.formatJsonValue(additionalInfo);

    return cleanData;
  }

  /**
   * Create dispute case
   */
  async create(data: any) {
    const formattedData = this.preparePrismaDisputeData(data);

    const dispute = await prisma.labourDispute.create({
      data: formattedData,
      include: DISPUTE_DETAILS_INCLUDE,
    });

    return this.formatDisputeOutput(dispute);
  }

  /**
   * Find dispute by ID with optional tenant/client/worker verification
   */
  async findById(
    id: string,
    scope?: {
      organizationId?: string | null;
      clientId?: string | null;
      labourId?: string | null;
      isPlatformAdmin?: boolean;
    }
  ) {
    const andConditions: Prisma.LabourDisputeWhereInput[] = [{ id }];

    if (scope && !scope.isPlatformAdmin) {
      if (scope.organizationId) {
        andConditions.push({
          OR: [
            { labour: { organizationId: scope.organizationId } },
            { booking: { organizationId: scope.organizationId } },
          ],
        });
      }

      if (scope.clientId) {
        andConditions.push({ booking: { clientId: scope.clientId } });
      }

      if (scope.labourId) {
        andConditions.push({ labourId: scope.labourId });
      }
    }

    const dispute = await prisma.labourDispute.findFirst({
      where: { AND: andConditions },
      include: DISPUTE_DETAILS_INCLUDE,
    });

    return this.formatDisputeOutput(dispute);
  }

  /**
   * List paginated disputes with filters
   */
  async findAll(
    query: GetLabourDisputesQuery,
    scope?: {
      organizationId?: string | null;
      clientId?: string | null;
      labourId?: string | null;
      isPlatformAdmin?: boolean;
    }
  ) {
    const { page, limit, labourId, bookingId, disputeType, status, initiator } = query;
    const skip = (page - 1) * limit;

    const andConditions: Prisma.LabourDisputeWhereInput[] = [];

    if (scope && !scope.isPlatformAdmin) {
      if (scope.organizationId) {
        andConditions.push({
          OR: [
            { labour: { organizationId: scope.organizationId } },
            { booking: { organizationId: scope.organizationId } },
          ],
        });
      }

      if (scope.clientId) {
        andConditions.push({ booking: { clientId: scope.clientId } });
      }

      if (scope.labourId) {
        andConditions.push({ labourId: scope.labourId });
      }
    }

    if (labourId) andConditions.push({ labourId });
    if (bookingId) andConditions.push({ bookingId });
    if (disputeType) andConditions.push({ disputeType });
    if (status) andConditions.push({ status });
    if (initiator) andConditions.push({ initiator });

    const where: Prisma.LabourDisputeWhereInput = { AND: andConditions };

    const [total, disputes] = await Promise.all([
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
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              workTitle: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: disputes.map((d) => this.formatDisputeOutput(d)),
      disputes: disputes.map((d) => this.formatDisputeOutput(d)),
    };
  }

  /**
   * Update dispute case
   */
  async update(id: string, data: any) {
    const existing = await prisma.labourDispute.findUnique({
      where: { id },
      select: { additionalInformation: true },
    });

    const existingAdditionalInfo =
      existing?.additionalInformation &&
      typeof existing.additionalInformation === "object" &&
      !Array.isArray(existing.additionalInformation)
        ? (existing.additionalInformation as Record<string, any>)
        : {};

    const formattedData = this.preparePrismaDisputeData(data, existingAdditionalInfo);

    const dispute = await prisma.labourDispute.update({
      where: { id },
      data: formattedData,
      include: DISPUTE_DETAILS_INCLUDE,
    });

    return this.formatDisputeOutput(dispute);
  }

  /**
   * Delete dispute case
   */
  async delete(id: string) {
    return prisma.labourDispute.delete({
      where: { id },
    });
  }
}

export const labourDisputeRepo = new LabourDisputeRepo();

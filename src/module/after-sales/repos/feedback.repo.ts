import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateCustomerFeedbackInput,
  UpdateCustomerFeedbackInput,
  EscalateFeedbackInput,
  ResolveEscalationInput,
  GetCustomerFeedbacksQueryInput,
} from "../validators/feedback.validator.js";

export class FeedbackRepository {
  /**
   * Auto-generates sequential feedback code (FB-YYYY-NNNN)
   */
  async generateNextFeedbackNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FB-${year}-`;

    const latest = await prisma.customerFeedback.findFirst({
      where: {
        project: { organizationId },
        feedbackNumber: { startsWith: prefix },
      },
      orderBy: { feedbackNumber: "desc" },
      select: { feedbackNumber: true },
    });

    let nextSeq = 1;
    if (latest?.feedbackNumber) {
      const parts = latest.feedbackNumber.split("-");
      if (parts[2]) {
        const currentSeq = parseInt(parts[2], 10);
        if (!isNaN(currentSeq)) {
          nextSeq = currentSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * Create customer feedback
   */
  async create(organizationId: string, data: CreateCustomerFeedbackInput) {
    const feedbackNumber = await this.generateNextFeedbackNumber(organizationId);

    return prisma.customerFeedback.create({
      data: {
        projectId: data.projectId,
        serviceRequestId: data.serviceRequestId,
        serviceVisitId: data.serviceVisitId,
        feedbackNumber,
        touchpoint: data.touchpoint || "POST_SERVICE",
        overallRating: new Prisma.Decimal(data.overallRating),
        qualityRating: data.qualityRating !== undefined && data.qualityRating !== null ? new Prisma.Decimal(data.qualityRating) : null,
        timelinessRating: data.timelinessRating !== undefined && data.timelinessRating !== null ? new Prisma.Decimal(data.timelinessRating) : null,
        professionalismRating: data.professionalismRating !== undefined && data.professionalismRating !== null ? new Prisma.Decimal(data.professionalismRating) : null,
        communicationRating: data.communicationRating !== undefined && data.communicationRating !== null ? new Prisma.Decimal(data.communicationRating) : null,
        issueResolvedAnswer: data.issueResolvedAnswer || "YES",
        whatWentWell: data.whatWentWell,
        whatCouldImprove: data.whatCouldImprove,
        customerComments: data.customerComments,
        additionalInformation: data.additionalInformation !== undefined ? (data.additionalInformation as Prisma.InputJsonValue) : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        serviceRequest: {
          select: { id: true, requestNumber: true, subject: true },
        },
        serviceVisit: {
          select: { id: true, visitNumber: true, status: true },
        },
      },
    });
  }

  /**
   * Find feedback by ID with tenant verification
   */
  async findById(organizationId: string, id: string) {
    return prisma.customerFeedback.findFirst({
      where: {
        id,
        project: { organizationId },
        isDeleted: false,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        serviceRequest: true,
        serviceVisit: true,
      },
    });
  }

  /**
   * List paginated customer feedbacks
   */
  async list(organizationId: string, query: GetCustomerFeedbacksQueryInput) {
    const {
      projectId,
      serviceRequestId,
      serviceVisitId,
      minRating,
      maxRating,
      isEscalated,
      isResolved,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerFeedbackWhereInput = {
      project: { organizationId },
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(serviceRequestId && { serviceRequestId }),
      ...(serviceVisitId && { serviceVisitId }),
      ...(isEscalated !== undefined && { isEscalated }),
      ...(isResolved !== undefined && { isResolved }),
      ...(minRating && { overallRating: { gte: new Prisma.Decimal(minRating) } }),
      ...(maxRating && { overallRating: { lte: new Prisma.Decimal(maxRating) } }),
      ...(startDate && { submittedAt: { gte: new Date(startDate) } }),
      ...(endDate && { submittedAt: { lte: new Date(endDate) } }),
    };

    const [items, total] = await Promise.all([
      prisma.customerFeedback.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ submittedAt: "desc" }],
        include: {
          project: {
            select: { id: true, name: true, projectCode: true },
          },
          serviceRequest: {
            select: { id: true, requestNumber: true },
          },
        },
      }),
      prisma.customerFeedback.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update feedback details
   */
  async update(organizationId: string, id: string, data: UpdateCustomerFeedbackInput) {
    return prisma.customerFeedback.update({
      where: { id },
      data: {
        ...(data.overallRating !== undefined && { overallRating: new Prisma.Decimal(data.overallRating) }),
        ...(data.qualityRating !== undefined && {
          qualityRating: data.qualityRating !== null ? new Prisma.Decimal(data.qualityRating) : null,
        }),
        ...(data.timelinessRating !== undefined && {
          timelinessRating: data.timelinessRating !== null ? new Prisma.Decimal(data.timelinessRating) : null,
        }),
        ...(data.professionalismRating !== undefined && {
          professionalismRating: data.professionalismRating !== null ? new Prisma.Decimal(data.professionalismRating) : null,
        }),
        ...(data.communicationRating !== undefined && {
          communicationRating: data.communicationRating !== null ? new Prisma.Decimal(data.communicationRating) : null,
        }),
        ...(data.issueResolvedAnswer !== undefined && { issueResolvedAnswer: data.issueResolvedAnswer }),
        ...(data.whatWentWell !== undefined && { whatWentWell: data.whatWentWell }),
        ...(data.whatCouldImprove !== undefined && { whatCouldImprove: data.whatCouldImprove }),
        ...(data.customerComments !== undefined && { customerComments: data.customerComments }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Escalate feedback to management
   */
  async escalate(organizationId: string, id: string, data: EscalateFeedbackInput) {
    return prisma.customerFeedback.update({
      where: { id },
      data: {
        isEscalated: true,
        escalationReason: data.escalationReason,
        isResolved: false,
      },
    });
  }

  /**
   * Resolve escalated feedback with manager notes
   */
  async resolveEscalation(organizationId: string, id: string, data: ResolveEscalationInput) {
    return prisma.customerFeedback.update({
      where: { id },
      data: {
        isResolved: true,
        managerNotes: data.managerNotes,
      },
    });
  }

  /**
   * Soft delete feedback
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.customerFeedback.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const feedbackRepository = new FeedbackRepository();

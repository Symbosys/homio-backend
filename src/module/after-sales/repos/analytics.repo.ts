import { prisma } from "../../../lib/prisma.js";

export class AnalyticsRepository {
  /**
   * Aggregate high-level After-Sales KPIs for the tenant organization
   */
  async getOverviewMetrics(organizationId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const now = new Date();

    const [
      activeWarrantiesCount,
      expiredWarrantiesCount,
      openRequestsCount,
      inProgressRequestsCount,
      slaBreachedRequestsCount,
      urgentRequestsCount,
      scheduledVisitsTodayCount,
      completedVisitsCount,
      feedbackAggregates,
      escalatedFeedbacksCount,
      pendingClaimsCount,
      scheduledRetentionCallsCount,
    ] = await Promise.all([
      // Warranties
      prisma.projectWarranty.count({
        where: { project: { organizationId }, status: "ACTIVE", isDeleted: false },
      }),
      prisma.projectWarranty.count({
        where: { project: { organizationId }, status: "EXPIRED", isDeleted: false },
      }),
      // Service Requests
      prisma.afterSalesServiceRequest.count({
        where: { project: { organizationId }, status: "OPEN", isDeleted: false },
      }),
      prisma.afterSalesServiceRequest.count({
        where: { project: { organizationId }, status: "IN_PROGRESS", isDeleted: false },
      }),
      prisma.afterSalesServiceRequest.count({
        where: {
          project: { organizationId },
          dueDate: { lt: now },
          status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          isDeleted: false,
        },
      }),
      prisma.afterSalesServiceRequest.count({
        where: {
          project: { organizationId },
          priority: { in: ["URGENT", "EMERGENCY"] },
          status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          isDeleted: false,
        },
      }),
      // Visits
      prisma.afterSalesServiceVisit.count({
        where: {
          project: { organizationId },
          scheduledDate: { gte: todayStart, lte: todayEnd },
          status: "SCHEDULED",
          isDeleted: false,
        },
      }),
      prisma.afterSalesServiceVisit.count({
        where: { project: { organizationId }, status: "COMPLETED", isDeleted: false },
      }),
      // Feedback CSAT average
      prisma.customerFeedback.aggregate({
        where: { project: { organizationId }, isDeleted: false },
        _avg: {
          overallRating: true,
          qualityRating: true,
          timelinessRating: true,
          professionalismRating: true,
          communicationRating: true,
        },
        _count: { id: true },
      }),
      // Escalated Feedbacks
      prisma.customerFeedback.count({
        where: { project: { organizationId }, isEscalated: true, isResolved: false, isDeleted: false },
      }),
      // Claims
      prisma.warrantyClaim.count({
        where: { warranty: { project: { organizationId } }, status: "SUBMITTED", isDeleted: false },
      }),
      // Retention Follow-ups
      prisma.retentionFollowUp.count({
        where: {
          project: { organizationId },
          scheduledDate: { gte: todayStart },
          conductedAt: null,
          isDeleted: false,
        },
      }),
    ]);

    return {
      warranties: {
        active: activeWarrantiesCount,
        expired: expiredWarrantiesCount,
      },
      requests: {
        open: openRequestsCount,
        inProgress: inProgressRequestsCount,
        urgent: urgentRequestsCount,
        slaBreached: slaBreachedRequestsCount,
      },
      visits: {
        scheduledToday: scheduledVisitsTodayCount,
        completed: completedVisitsCount,
      },
      csat: {
        totalResponses: feedbackAggregates._count.id,
        averageOverallRating: feedbackAggregates._avg.overallRating
          ? Number(feedbackAggregates._avg.overallRating)
          : 0,
        averageQualityRating: feedbackAggregates._avg.qualityRating
          ? Number(feedbackAggregates._avg.qualityRating)
          : 0,
        averageTimelinessRating: feedbackAggregates._avg.timelinessRating
          ? Number(feedbackAggregates._avg.timelinessRating)
          : 0,
        averageProfessionalismRating: feedbackAggregates._avg.professionalismRating
          ? Number(feedbackAggregates._avg.professionalismRating)
          : 0,
        averageCommunicationRating: feedbackAggregates._avg.communicationRating
          ? Number(feedbackAggregates._avg.communicationRating)
          : 0,
        pendingEscalations: escalatedFeedbacksCount,
      },
      claims: {
        pendingReview: pendingClaimsCount,
      },
      retention: {
        pendingCalls: scheduledRetentionCallsCount,
      },
    };
  }

  /**
   * Aggregate after-sales health metrics for a single project
   */
  async getProjectMetrics(organizationId: string, projectId: string) {
    const [
      warranties,
      openRequests,
      completedVisits,
      feedback,
      retentionCalls,
    ] = await Promise.all([
      prisma.projectWarranty.findMany({
        where: { projectId, project: { organizationId }, isDeleted: false },
        select: { id: true, warrantyNumber: true, category: true, status: true, endDate: true },
      }),
      prisma.afterSalesServiceRequest.count({
        where: {
          projectId,
          project: { organizationId },
          status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
          isDeleted: false,
        },
      }),
      prisma.afterSalesServiceVisit.count({
        where: { projectId, project: { organizationId }, status: "COMPLETED", isDeleted: false },
      }),
      prisma.customerFeedback.findMany({
        where: { projectId, project: { organizationId }, isDeleted: false },
        select: { overallRating: true, issueResolvedAnswer: true, isEscalated: true },
      }),
      prisma.retentionFollowUp.findMany({
        where: { projectId, project: { organizationId }, isDeleted: false },
        select: { outcome: true, csatScore: true, reviewPosted: true, conductedAt: true },
      }),
    ]);

    const csatAverage =
      feedback.length > 0
        ? feedback.reduce((sum, f) => sum + Number(f.overallRating), 0) / feedback.length
        : null;

    return {
      projectId,
      totalWarranties: warranties.length,
      activeWarranties: warranties.filter((w) => w.status === "ACTIVE").length,
      openRequestsCount: openRequests,
      completedVisitsCount: completedVisits,
      totalFeedbacksCount: feedback.length,
      averageCsat: csatAverage ? Math.round(csatAverage * 100) / 100 : null,
      retentionCallsConducted: retentionCalls.filter((r) => r.conductedAt !== null).length,
    };
  }
}

export const analyticsRepository = new AnalyticsRepository();

import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { projectServiceRepo } from "../repos/project-service.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { MARKETPLACE_CONFIG } from "../../../constants/marketplace.constants.js";
import type {
  CreateLabourBookingInput,
  CreateMarketplaceBookingInput,
  UpdateLabourBookingInput,
  GetLabourBookingsQuery,
  SubmitQuoteInput,
  RespondQuoteInput,
  RejectBookingInput,
  CompleteWorkInput,
  ConfirmCompletionInput,
  ReportDelayInput,
  ReassignLabourInput,
} from "../validators/labour-booking.validator.js";

/**
 * Labour Booking Service
 * Dual-Channel Business Logic:
 * 1. B2B Organization Project Site Bookings (0% platform commission, tenant isolated)
 * 2. B2C Direct Platform Marketplace Bookings (10% platform commission, on-site deal quotes, proofs, KYC filter)
 */
export class LabourBookingService {
  /**
   * Helper: Check if a user matches the booking's assigned worker
   */
  private async isAssignedWorker(bookingLabourId: string, userId: string): Promise<boolean> {
    const labour = await prisma.labour.findUnique({
      where: { id: bookingLabourId },
      select: { userId: true },
    });
    return labour?.userId === userId;
  }

  /**
   * Create a new project booking allocated under a Project Service (B2B Org Channel - 0% Commission)
   */
  async createBooking(payload: CreateLabourBookingInput, organizationId: string) {
    // 1. Verify labour belongs to tenant
    const labour = await labourRepo.findById(payload.labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    // 2. Verify project belongs to tenant
    const project = await prisma.project.findFirst({
      where: { id: payload.projectId, organizationId, isDeleted: false },
    });
    if (!project) {
      throw new ErrorResponse("Project not found or unauthorized", statusCode.Not_Found);
    }

    // 3. Verify project service belongs to tenant and matches projectId
    const projectService = await prisma.projectService.findFirst({
      where: {
        id: payload.projectServiceId,
        organizationId,
        projectId: payload.projectId,
        isDeleted: false,
      },
    });
    if (!projectService) {
      throw new ErrorResponse(
        "Project service not found or does not belong to the specified project",
        statusCode.Not_Found
      );
    }

    // 4. Generate booking number
    const bookingNumber = await labourBookingRepo.generateBookingNumber("LB", payload.projectId);

    // 5. Calculate total budget
    const totalBudget = payload.agreedDailyRate * (payload.estimatedDays || 1);

    const booking = await labourBookingRepo.create({
      ...payload,
      organizationId,
      channel: "ORGANIZATION_PROJECT",
      commissionRate: 0.00,
      commissionAmount: 0.00,
      commissionStatus: "NOT_APPLICABLE",
      bookingNumber,
      totalBudget,
    });

    // 6. Recalculate financial rollups on parent project service
    await projectServiceRepo.recalculateRollup(payload.projectServiceId);

    return booking;
  }

  /**
   * Create a direct platform marketplace booking (B2C User/Client Channel - 10% Commission)
   */
  async createMarketplaceBooking(payload: CreateMarketplaceBookingInput, clientId: string) {
    // 1. Verify client exists and is not blacklisted
    const client = await prisma.user.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new ErrorResponse("Client profile not found", statusCode.Not_Found);
    }
    if (client.isBlacklisted) {
      throw new ErrorResponse(
        `Client account is currently suspended/blacklisted. Reason: ${client.blacklistReason || "Policy violations / unpaid worker dues"}`,
        statusCode.Forbidden
      );
    }

    // 2. Verify labour worker exists, is available, and is KYC verified
    const labour = await prisma.labour.findUnique({
      where: { id: payload.labourId, isDeleted: false },
      include: { kycDocument: true },
    });
    if (!labour) {
      throw new ErrorResponse("Requested labour worker not found", statusCode.Not_Found);
    }
    if (labour.isBlacklisted) {
      throw new ErrorResponse("Labour worker is currently suspended/blacklisted", statusCode.Forbidden);
    }

    const isKyc = labour.isKycVerified || labour.kycDocument?.status === "APPROVED";
    if (!isKyc) {
      throw new ErrorResponse(
        "Only KYC-verified labours can be booked via platform marketplace. This worker has not completed verification.",
        statusCode.Bad_Request
      );
    }

    // 3. Generate Service Booking sequence number (SB-YYYY-0001)
    const bookingNumber = await labourBookingRepo.generateBookingNumber("SB");

    const startDate = payload.startDate ? new Date(payload.startDate) : new Date();
    const endDate = payload.endDate
      ? new Date(payload.endDate)
      : payload.startDate
        ? new Date(payload.startDate)
        : new Date();

    const diffTime = endDate.getTime() - startDate.getTime();
    const estimatedDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    const dailyRate = Number(labour.dailyRate || 0);
    const totalBudget = dailyRate * estimatedDays;
    const commissionRate = MARKETPLACE_CONFIG.DEFAULT_COMMISSION_PERCENTAGE;
    const commissionAmount = Number(((totalBudget * commissionRate) / 100).toFixed(2));

    // 4. Create marketplace booking record
    const booking = await labourBookingRepo.create({
      channel: "PLATFORM_MARKETPLACE",
      bookingNumber,
      labourId: payload.labourId,
      clientId,
      workTitle: payload.workTitle,
      workDescription: payload.workDescription,
      locality: payload.locality,
      serviceAddress: payload.serviceAddress,
      city: payload.city,
      state: payload.state,
      pincode: payload.pincode,
      latitude: payload.latitude,
      longitude: payload.longitude,
      startDate,
      endDate,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
      agreedDailyRate: labour.dailyRate,
      estimatedDays,
      totalBudget,
      commissionRate,
      commissionAmount,
      commissionStatus: "PENDING",
      status: "REQUESTED",
      notes: payload.notes,
      taskChecklist: payload.taskChecklist,
      additionalInformation: payload.additionalInformation,
    });

    return booking;
  }

  /**
   * Labour Worker accepts incoming booking request
   */
  async acceptBooking(id: string, user: { id: string; userType?: string; isPlatformAdmin?: boolean }) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    // Check authorization: worker must be linked or platform admin
    if (!user.isPlatformAdmin) {
      const isAssigned = await this.isAssignedWorker(booking.labourId, user.id);
      if (!isAssigned && booking.labourId !== user.id) {
        throw new ErrorResponse("Unauthorized. You are not the assigned labour worker for this booking.", statusCode.Forbidden);
      }
    }

    if (booking.status !== "REQUESTED") {
      throw new ErrorResponse(`Cannot accept booking in current status: ${booking.status}`, statusCode.Bad_Request);
    }

    return labourBookingRepo.update(id, {
      status: "ACCEPTED_BY_LABOUR",
      acceptedAt: new Date(),
    });
  }

  /**
   * Labour Worker rejects incoming booking request
   */
  async rejectBooking(
    id: string,
    user: { id: string; userType?: string; isPlatformAdmin?: boolean },
    payload: RejectBookingInput
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!user.isPlatformAdmin) {
      const isAssigned = await this.isAssignedWorker(booking.labourId, user.id);
      if (!isAssigned && booking.labourId !== user.id) {
        throw new ErrorResponse("Unauthorized. You are not the assigned labour worker for this booking.", statusCode.Forbidden);
      }
    }

    if (booking.status !== "REQUESTED") {
      throw new ErrorResponse(`Cannot reject booking in current status: ${booking.status}`, statusCode.Bad_Request);
    }

    return labourBookingRepo.update(id, {
      status: "REJECTED_BY_LABOUR",
      statusReason: payload.reason || "Rejected by labour",
    });
  }

  /**
   * Labour Worker submits on-site deal quotation
   */
  async submitQuote(
    id: string,
    user: { id: string; userType?: string; isPlatformAdmin?: boolean },
    payload: SubmitQuoteInput
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!user.isPlatformAdmin) {
      const isAssigned = await this.isAssignedWorker(booking.labourId, user.id);
      if (!isAssigned && booking.labourId !== user.id) {
        throw new ErrorResponse("Unauthorized. You are not the assigned labour worker for this booking.", statusCode.Forbidden);
      }
    }

    const validStatuses = ["ACCEPTED_BY_LABOUR", "REQUESTED"];
    if (!validStatuses.includes(booking.status)) {
      throw new ErrorResponse(`Quotation can only be submitted for accepted bookings. Current status: ${booking.status}`, statusCode.Bad_Request);
    }

    return labourBookingRepo.update(id, {
      status: "QUOTE_PROVIDED",
      quoteAmount: payload.quoteAmount,
      quoteDescription: payload.quoteDescription,
      quoteSubmittedAt: new Date(),
    });
  }

  /**
   * Client accepts or rejects on-site deal quotation
   */
  async respondQuote(
    id: string,
    clientId: string,
    payload: RespondQuoteInput,
    isPlatformAdmin?: boolean
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!isPlatformAdmin && booking.clientId !== clientId) {
      throw new ErrorResponse("Unauthorized. You are not the client who requested this service booking.", statusCode.Forbidden);
    }

    if (booking.status !== "QUOTE_PROVIDED") {
      throw new ErrorResponse(`Cannot respond to quotation in status: ${booking.status}. Expected QUOTE_PROVIDED.`, statusCode.Bad_Request);
    }

    if (payload.accept) {
      const quoteAmount = Number(booking.quoteAmount || 0);
      let commissionAmount = 0.00;
      let commissionStatus = "NOT_APPLICABLE";

      // Calculate commission only for Platform Marketplace bookings
      if (booking.channel === "PLATFORM_MARKETPLACE") {
        const rate = Number(booking.commissionRate || MARKETPLACE_CONFIG.DEFAULT_COMMISSION_PERCENTAGE);
        commissionAmount = (quoteAmount * rate) / 100;
        commissionStatus = "PENDING";
      }

      return labourBookingRepo.update(id, {
        status: "WORK_STARTED",
        dealValue: quoteAmount,
        dealAcceptedAt: new Date(),
        startedAt: new Date(),
        commissionAmount,
        commissionStatus,
      });
    } else {
      return labourBookingRepo.update(id, {
        status: "QUOTE_REJECTED",
        statusReason: payload.rejectionReason || "Quote rejected by client",
      });
    }
  }

  /**
   * Labour Worker submits work completion checklist and proof photos
   */
  async completeWork(
    id: string,
    user: { id: string; userType?: string; isPlatformAdmin?: boolean },
    payload: CompleteWorkInput
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!user.isPlatformAdmin) {
      const isAssigned = await this.isAssignedWorker(booking.labourId, user.id);
      if (!isAssigned && booking.labourId !== user.id) {
        throw new ErrorResponse("Unauthorized. You are not the assigned labour worker for this booking.", statusCode.Forbidden);
      }
    }

    const allowed = ["WORK_STARTED", "IN_PROGRESS"];
    if (!allowed.includes(booking.status)) {
      throw new ErrorResponse(`Cannot mark work completed from status: ${booking.status}. Expected WORK_STARTED or IN_PROGRESS.`, statusCode.Bad_Request);
    }

    return labourBookingRepo.update(id, {
      status: "WORK_COMPLETED",
      taskChecklist: payload.taskChecklist,
      proofPhotos: payload.proofPhotos,
      completedAt: new Date(),
    });
  }

  /**
   * Client confirms service completion and optionally provides performance review/rating
   */
  async confirmCompletion(
    id: string,
    clientId: string,
    payload: ConfirmCompletionInput,
    isPlatformAdmin?: boolean
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!isPlatformAdmin && booking.clientId !== clientId) {
      throw new ErrorResponse("Unauthorized. You are not the client who requested this service booking.", statusCode.Forbidden);
    }

    const allowed = ["WORK_COMPLETED", "IN_PROGRESS", "WORK_STARTED"];
    if (!allowed.includes(booking.status)) {
      throw new ErrorResponse(`Cannot confirm completion for booking in status: ${booking.status}.`, statusCode.Bad_Request);
    }

    const updated = await labourBookingRepo.update(id, {
      status: "COMPLETED",
      completedAt: booking.completedAt || new Date(),
    });

    // If client left a rating review, save it and update labour average rating
    if (payload.rating !== undefined) {
      const client = await prisma.user.findUnique({
        where: { id: clientId },
        select: { firstName: true, lastName: true },
      });
      const reviewerName = client?.firstName
        ? `${client.firstName} ${client.lastName || ""}`.trim()
        : "Client";

      await prisma.labourRating.create({
        data: {
          bookingId: id,
          labourId: booking.labourId,
          reviewerId: clientId,
          reviewerName,
          reviewerRole: "CLIENT",
          rating: payload.rating,
          reviewNotes: payload.review || payload.reviewNotes || null,
          punctualityScore: payload.punctualityRating || payload.punctualityScore || null,
          qualityScore: payload.qualityRating || payload.qualityScore || null,
          behaviourScore: payload.behaviorRating || payload.behaviourScore || null,
        },
      });

      // Recalculate labour average rating and increment completed bookings count
      const stats = await prisma.labourRating.aggregate({
        where: { labourId: booking.labourId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.labour.update({
        where: { id: booking.labourId },
        data: {
          averageRating: stats._avg.rating || 5.0,
          totalReviewsCount: stats._count.rating || 0,
          completedBookingsCount: { increment: 1 },
        },
      });
    }

    return updated;
  }

  /**
   * Settle platform commission paid by labour worker
   */
  async settleCommission(id: string, isPlatformAdmin?: boolean) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (booking.channel !== "PLATFORM_MARKETPLACE") {
      throw new ErrorResponse("Commission settlement is only applicable to platform marketplace bookings.", statusCode.Bad_Request);
    }

    return labourBookingRepo.update(id, {
      commissionStatus: "PAID",
      commissionPaidAt: new Date(),
    });
  }

  /**
   * User reports worker arrival delay after 24 hours
   */
  async reportDelay(
    id: string,
    clientId: string,
    payload: ReportDelayInput,
    isPlatformAdmin?: boolean
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!isPlatformAdmin && booking.clientId !== clientId) {
      throw new ErrorResponse("Unauthorized. You are not the client who requested this service booking.", statusCode.Forbidden);
    }

    const unstartedStatuses = ["REQUESTED", "ACCEPTED_BY_LABOUR", "CONFIRMED"];
    if (!unstartedStatuses.includes(booking.status)) {
      throw new ErrorResponse(
        `Arrival delay cannot be reported for booking in status: ${booking.status}. Work may already be in progress or completed.`,
        statusCode.Bad_Request
      );
    }

    // 24-hour verification: Check hours elapsed since booking acceptance/request
    const referenceDate = booking.acceptedAt || booking.startDate || booking.createdAt;
    const hoursElapsed = (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < MARKETPLACE_CONFIG.DELAY_REPORT_MIN_HOURS && !isPlatformAdmin) {
      const remainingHours = Math.ceil(MARKETPLACE_CONFIG.DELAY_REPORT_MIN_HOURS - hoursElapsed);
      throw new ErrorResponse(
        `Arrival delay can only be reported after 24 hours if the worker has not reached the site. Please wait ${remainingHours} more hour(s).`,
        statusCode.Bad_Request
      );
    }

    // Worker disciplinary action: increment warning count & penalize rating
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
            blacklistReason: "Accumulated disciplinary threshold: repeated work non-arrival / abandonment after 24 hours",
          }),
        },
      });
    }

    // Automatically file dispute case for record & lawyer/governance tracking
    await prisma.labourDispute.create({
      data: {
        bookingId: id,
        labourId: booking.labourId,
        disputeType: "WORK_ABANDONMENT",
        status: "OPEN",
        initiator: "CLIENT",
        reason: payload.reason || "Worker failed to arrive at user location after 24 hours.",
      },
    });

    // Update booking status
    return labourBookingRepo.update(id, {
      status: "DELAY_REPORTED",
      statusReason: payload.reason,
      delayReportedAt: new Date(),
    });
  }

  /**
   * Platform Admin manually reassigns replacement labour for delayed/unfulfilled service booking
   */
  async reassignLabour(
    id: string,
    payload: ReassignLabourInput,
    adminUserId: string
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    // Verify replacement labour exists, is not blacklisted, and is KYC verified
    const newLabour = await prisma.labour.findUnique({
      where: { id: payload.newLabourId, isDeleted: false },
      include: { kycDocument: true },
    });
    if (!newLabour) {
      throw new ErrorResponse("Replacement labour worker not found", statusCode.Not_Found);
    }
    if (newLabour.isBlacklisted) {
      throw new ErrorResponse("Replacement labour worker is suspended/blacklisted", statusCode.Forbidden);
    }
    const isKyc = newLabour.isKycVerified || newLabour.kycDocument?.status === "APPROVED";
    if (!isKyc) {
      throw new ErrorResponse("Replacement labour must be KYC verified before reassignment", statusCode.Bad_Request);
    }
    if (newLabour.id === booking.labourId) {
      throw new ErrorResponse("Cannot reassign to the same labour worker", statusCode.Bad_Request);
    }

    // Build reassignment history log in additionalInformation
    const currentAddl = (booking.additionalInformation as Record<string, any>) || {};
    const reassignmentLog = {
      fromLabourId: booking.labourId,
      toLabourId: newLabour.id,
      reassignedAt: new Date().toISOString(),
      reassignedBy: adminUserId,
      reason: payload.reason,
    };
    const reassignmentHistory = Array.isArray(currentAddl.reassignmentHistory)
      ? [...currentAddl.reassignmentHistory, reassignmentLog]
      : [reassignmentLog];

    return labourBookingRepo.update(id, {
      labourId: newLabour.id,
      status: payload.resetStatusTo || "REQUESTED",
      statusReason: `Reassigned by platform: ${payload.reason}`,
      quoteAmount: null,
      quoteDescription: null,
      quoteSubmittedAt: null,
      dealValue: null,
      dealAcceptedAt: null,
      reassignedFromBookingId: booking.id,
      additionalInformation: {
        ...currentAddl,
        reassignmentHistory,
      },
    });
  }

  /**
   * Get single booking by ID with flexible scoping
   */
  async getBookingById(
    id: string,
    scope?:
      | string
      | {
          organizationId?: string | null;
          clientId?: string | null;
          workerLabourId?: string | null;
          workerUserId?: string | null;
          isPlatformAdmin?: boolean;
        }
  ) {
    const normalizedScope = typeof scope === "string" ? { organizationId: scope } : scope;
    const booking = await labourBookingRepo.findById(id, normalizedScope);
    if (!booking) {
      throw new ErrorResponse("Booking not found or unauthorized", statusCode.Not_Found);
    }
    return booking;
  }

  /**
   * Get all paginated bookings with flexible scoping
   */
  async getBookings(
    query: GetLabourBookingsQuery,
    scope?: {
      organizationId?: string | null;
      clientId?: string | null;
      workerLabourId?: string | null;
      workerUserId?: string | null;
      isPlatformAdmin?: boolean;
    }
  ) {
    return labourBookingRepo.findAll(query, scope);
  }

  /**
   * Full symmetric update of booking (Org/Admin)
   */
  async updateBooking(id: string, payload: UpdateLabourBookingInput, organizationId?: string) {
    const existing = await this.getBookingById(id, { organizationId });

    // If labourId is changing, verify
    if (payload.labourId && payload.labourId !== existing.labourId) {
      const labour = await labourRepo.findById(payload.labourId, organizationId);
      if (!labour) {
        throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
      }
    }

    // If projectId is changing, verify
    const targetProjectId = payload.projectId || existing.projectId;
    if (payload.projectId && payload.projectId !== existing.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: payload.projectId, ...(organizationId && { organizationId }), isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found or unauthorized", statusCode.Not_Found);
      }
    }

    // If projectServiceId is changing, verify
    if (payload.projectServiceId && payload.projectServiceId !== existing.projectServiceId) {
      const projectService = await prisma.projectService.findFirst({
        where: {
          id: payload.projectServiceId,
          ...(organizationId && { organizationId }),
          projectId: targetProjectId!,
          isDeleted: false,
        },
      });
      if (!projectService) {
        throw new ErrorResponse(
          "Target project service not found or unauthorized",
          statusCode.Not_Found
        );
      }
    }

    // Recalculate total budget if rate or days updated
    const agreedDailyRate = payload.agreedDailyRate ?? Number(existing.agreedDailyRate);
    const estimatedDays = payload.estimatedDays ?? existing.estimatedDays;
    const totalBudget = payload.totalBudget ?? agreedDailyRate * (estimatedDays || 1);

    const updated = await labourBookingRepo.update(id, {
      ...payload,
      totalBudget,
    });

    // Recalculate rollups for original and new project service (if changed)
    if (existing.projectServiceId) {
      await projectServiceRepo.recalculateRollup(existing.projectServiceId);
    }
    if (payload.projectServiceId && payload.projectServiceId !== existing.projectServiceId) {
      await projectServiceRepo.recalculateRollup(payload.projectServiceId);
    }

    return updated;
  }

  /**
   * Quick status transition
   */
  async updateStatus(
    id: string,
    status: any,
    organizationId?: string
  ) {
    await this.getBookingById(id, { organizationId });
    return labourBookingRepo.update(id, { status });
  }

  /**
   * Soft delete booking
   */
  async deleteBooking(id: string, organizationId?: string) {
    const existing = await this.getBookingById(id, { organizationId });
    const result = await labourBookingRepo.softDelete(id);

    // Recalculate parent service rollup if exists
    if (existing.projectServiceId) {
      await projectServiceRepo.recalculateRollup(existing.projectServiceId);
    }

    return result;
  }
}

export const labourBookingService = new LabourBookingService();

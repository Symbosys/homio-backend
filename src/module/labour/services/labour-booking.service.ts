import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { projectServiceRepo } from "../repos/project-service.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, LabourStatus } from "../../../types/types.js";
import { MARKETPLACE_CONFIG } from "../../../constants/marketplace.constants.js";
import type {
  CreateLabourBookingInput,
  CreateMarketplaceBookingInput,
  CreateServiceBookingInput,
  CheckAvailabilityQuery,
  ManualAssignLabourInput,
  PlatformLabourSettingInput,
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
   * Helper: Check if a labour worker is available and has no active ongoing work on another booking
   */
  private async validateLabourAvailability(labourId: string, excludeBookingId?: string): Promise<void> {
    const labour = await prisma.labour.findUnique({
      where: { id: labourId, isDeleted: false },
      select: { id: true, isAvailable: true, status: true },
    });

    if (
      !labour ||
      labour.isAvailable === false ||
      labour.status === LabourStatus.UNAVAILABLE ||
      labour.status === LabourStatus.AT_WORK ||
      labour.status === LabourStatus.PENDING ||
      labour.status === LabourStatus.REJECTED ||
      labour.status === LabourStatus.BLACKLISTED
    ) {
      throw new ErrorResponse("Labour is already unavailable", statusCode.Bad_Request);
    }

    const ongoingBooking = await prisma.labourBooking.findFirst({
      where: {
        labourId,
        isDeleted: false,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        status: { in: ["ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"] },
      },
      select: { id: true, bookingNumber: true, status: true },
    });

    if (ongoingBooking) {
      throw new ErrorResponse("Labour is already unavailable", statusCode.Bad_Request);
    }
  }

  /**
   * Helper: Synchronize labour availability and status.
   * If the labour has no other active ongoing bookings (ACCEPTED_BY_LABOUR, WORK_STARTED, IN_PROGRESS),
   * their status is transitioned to AVAILABLE and isAvailable is set to true.
   */
  private async syncLabourAvailability(labourId?: string | null, excludeBookingId?: string): Promise<void> {
    if (!labourId) return;

    const labour = await prisma.labour.findUnique({
      where: { id: labourId },
      select: { id: true, status: true, isBlacklisted: true },
    });

    if (
      !labour ||
      labour.isBlacklisted ||
      labour.status === LabourStatus.REJECTED ||
      labour.status === LabourStatus.PENDING ||
      labour.status === LabourStatus.BLACKLISTED
    ) {
      return;
    }

    const activeBookingsCount = await prisma.labourBooking.count({
      where: {
        labourId,
        isDeleted: false,
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        status: { in: ["ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"] },
      },
    });

    if (activeBookingsCount === 0) {
      await prisma.labour.update({
        where: { id: labourId },
        data: {
          status: LabourStatus.AVAILABLE,
          isAvailable: true,
        },
      });
    }
  }

  /**
   * Helper: Check if client is under 3-day cooldown for the requested category
   */
  private async assertUserNotUnderCooldown(userId: string, category: string): Promise<void> {
    const record = await labourBookingRepo.getUserCategoryCooldown(userId, category);
    if (!record || !record.isLocked) return;

    const now = new Date();
    if (record.lockedUntil && record.lockedUntil > now) {
      const diffMs = record.lockedUntil.getTime() - now.getTime();
      const hoursRemaining = Math.ceil(diffMs / (1000 * 60 * 60));
      throw new ErrorResponse(
        `You have consecutively rejected quotations for 3 labours under category '${category}'. ` +
        `Service requests for this category are temporarily locked for 3 days (${hoursRemaining} hour(s) remaining until ${record.lockedUntil.toISOString()}).`,
        statusCode.Forbidden
      );
    }

    // Cooldown expired: Reset status automatically
    await labourBookingRepo.upsertUserCategoryCooldown(userId, category, {
      isLocked: false,
      lockedUntil: null,
      rejectionCount: 0,
    });
  }

  /**
   * Helper: Validate available verified labours in state, city, and category
   */
  private async validateAvailableLaboursInRegion(
    state: string,
    city: string,
    category: string,
    requiredCount: number = 1
  ) {
    const labours = await labourBookingRepo.findAvailableLaboursInRegion(state, city, category);
    if (labours.length === 0) {
      throw new ErrorResponse(
        `No verified labours are available in your city (${city}, ${state}) for ${category}.`,
        statusCode.Bad_Request
      );
    }
    if (labours.length < requiredCount) {
      throw new ErrorResponse(
        `Only ${labours.length} labour(s) are available in your city (${city}, ${state}) for ${category}. You requested ${requiredCount}.`,
        statusCode.Bad_Request
      );
    }
    return labours;
  }

  /**
   * Helper: Handle quotation response cooldown logic
   */
  private async handleQuotationResponseCooldown(
    clientId: string,
    category: string,
    accepted: boolean,
    bookingId: string,
    labourId: string,
    reason?: string
  ) {
    if (accepted) {
      await labourBookingRepo.upsertUserCategoryCooldown(clientId, category, {
        rejectionCount: 0,
        isLocked: false,
        lockedUntil: null,
      });
      return { cooldownApplied: false, lockedUntil: null };
    }

    const existing = await labourBookingRepo.getUserCategoryCooldown(clientId, category);
    const now = new Date();
    const currentLogs = Array.isArray(existing?.rejectionLogs) ? (existing!.rejectionLogs as any[]) : [];
    const newLog = { bookingId, labourId, rejectedAt: now.toISOString(), reason: reason || "Rejected by client" };
    const updatedLogs = [...currentLogs, newLog];

    const setting = await labourBookingRepo.getPlatformSetting();
    const threshold = setting?.consecutiveRejectionsThreshold ?? 3;
    const cooldownDays = setting?.cooldownPeriodDays ?? 3;

    const currentCount = existing && (!existing.lockedUntil || existing.lockedUntil < now)
      ? existing.rejectionCount
      : 0;

    const newCount = currentCount + 1;
    const isThresholdReached = newCount >= threshold;
    const lockedUntil = isThresholdReached
      ? new Date(now.getTime() + cooldownDays * 24 * 60 * 60 * 1000)
      : null;

    await labourBookingRepo.upsertUserCategoryCooldown(clientId, category, {
      rejectionCount: newCount,
      isLocked: isThresholdReached,
      lockedUntil,
      lastRejectedAt: now,
      rejectionLogs: updatedLogs,
    });

    return { cooldownApplied: isThresholdReached, lockedUntil, rejectionCount: newCount };
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

    // Verify labour worker is available and has no active ongoing work
    await this.validateLabourAvailability(payload.labourId);

    // 2. Verify project belongs to tenant and fetch linked project site
    const project = await prisma.project.findFirst({
      where: { id: payload.projectId, organizationId, isDeleted: false },
      include: { site: true },
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

    // Auto-populate service location and attendance geofence from ProjectSite if not provided
    const site = project.site;
    const serviceAddress = payload.serviceAddress ?? site?.address ?? null;
    const locality = payload.locality ?? site?.siteName ?? null;
    const city = payload.city ?? site?.city ?? null;
    const state = payload.state ?? site?.state ?? null;
    const pincode = payload.pincode ?? site?.pincode ?? null;
    const latitude =
      payload.latitude !== undefined && payload.latitude !== null
        ? payload.latitude
        : site?.gpsLat != null
          ? site.gpsLat
          : null;
    const longitude =
      payload.longitude !== undefined && payload.longitude !== null
        ? payload.longitude
        : site?.gpsLng != null
          ? site.gpsLng
          : null;
    const geofenceRadius = payload.geofenceRadius ?? site?.punchRadiusMeters ?? 200;
    const isStrictGeofence =
      payload.isStrictGeofence !== undefined
        ? payload.isStrictGeofence
        : site?.isPunchGeofenceStrict !== undefined
          ? site.isPunchGeofenceStrict
          : true;

    const booking = await labourBookingRepo.create({
      ...payload,
      serviceAddress,
      locality,
      city,
      state,
      pincode,
      latitude,
      longitude,
      geofenceRadius,
      isStrictGeofence,
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

    // Verify labour worker is available and has no active ongoing work
    await this.validateLabourAvailability(payload.labourId);

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
    const setting = await labourBookingRepo.getPlatformSetting();
    const commissionRate = Number(setting?.platformCommissionRate ?? MARKETPLACE_CONFIG.DEFAULT_COMMISSION_PERCENTAGE);
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
      geofenceRadius: payload.geofenceRadius ?? 200,
      isStrictGeofence: payload.isStrictGeofence !== undefined ? payload.isStrictGeofence : true,
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
   * Create a service booking request by Client (Homeowner Service Request)
   * User fills only: workTitle, startDate, endDate, description, specialInstructions, taskChecklist, state, city, category
   */
  async createServiceBooking(payload: CreateServiceBookingInput, clientId: string) {
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

    // 2. Check 3-day quotation rejection cooldown rule for requested category
    await this.assertUserNotUnderCooldown(clientId, payload.category);

    const labourCount = payload.labourCount ? Number(payload.labourCount) : 1;

    // 3. Strict regional availability guard: Check available verified labours in (state, city, category) for requested count
    const availableLabours = await this.validateAvailableLaboursInRegion(
      payload.state,
      payload.city,
      payload.category,
      labourCount
    );

    // 4. Check Platform Setting: Auto vs Manual Assignment toggle
    const platformSetting = await labourBookingRepo.getPlatformSetting();
    const isAutoAssignOn = platformSetting.autoAssignLabour;

    // 5. Generate Service Booking sequence numbers (SB-YYYY-0001, SB-YYYY-0002...)
    const bookingNumbers = await labourBookingRepo.generateBookingNumbers("SB", labourCount);

    const startDate = new Date(payload.startDate);
    const endDate = new Date(payload.endDate);
    const diffTime = endDate.getTime() - startDate.getTime();
    const estimatedDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    const createdBookings: any[] = [];

    if (isAutoAssignOn) {
      // Pick distinct available labours from the candidate pool
      const shuffled = [...availableLabours].sort(() => 0.5 - Math.random());
      const selectedLabours = shuffled.slice(0, labourCount);

      for (let i = 0; i < labourCount; i++) {
        const selectedLabour = selectedLabours[i]!;
        const bookingNumber = bookingNumbers[i]!;
        const dailyRate = Number(selectedLabour.dailyRate || 0);
        const totalBudget = dailyRate * estimatedDays;
        const setting = await labourBookingRepo.getPlatformSetting();
        const commissionRate = Number(setting?.platformCommissionRate ?? MARKETPLACE_CONFIG.DEFAULT_COMMISSION_PERCENTAGE);
        const commissionAmount = Number(((totalBudget * commissionRate) / 100).toFixed(2));

        const booking = await labourBookingRepo.create({
          channel: "PLATFORM_MARKETPLACE",
          bookingNumber,
          labourId: selectedLabour.id,
          clientId,
          assignmentType: "AUTO",
          workTitle: payload.workTitle,
          category: payload.category,
          workDescription: payload.description || null,
          specialInstructions: payload.specialInstructions || null,
          taskChecklist: payload.taskChecklist || null,
          state: payload.state,
          city: payload.city,
          startDate,
          endDate,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          agreedDailyRate: selectedLabour.dailyRate,
          estimatedDays,
          totalBudget,
          commissionRate,
          commissionAmount,
          commissionStatus: "PENDING",
          status: "REQUESTED",
        });

        createdBookings.push(booking);
      }

      return {
        count: createdBookings.length,
        bookings: createdBookings,
        booking: createdBookings[0] || null,
        assignedMode: "AUTO",
        assignedLabours: selectedLabours,
      };
    } else {
      // Manual assign: all bookings saved without labour, status PENDING_ASSIGNMENT
      for (let i = 0; i < labourCount; i++) {
        const bookingNumber = bookingNumbers[i]!;
        const booking = await labourBookingRepo.create({
          channel: "PLATFORM_MARKETPLACE",
          bookingNumber,
          labourId: null,
          clientId,
          assignmentType: "MANUAL",
          workTitle: payload.workTitle,
          category: payload.category,
          workDescription: payload.description || null,
          specialInstructions: payload.specialInstructions || null,
          taskChecklist: payload.taskChecklist || null,
          state: payload.state,
          city: payload.city,
          startDate,
          endDate,
          termsAccepted: true,
          termsAcceptedAt: new Date(),
          status: "PENDING_ASSIGNMENT",
        });

        createdBookings.push(booking);
      }

      return {
        count: createdBookings.length,
        bookings: createdBookings,
        booking: createdBookings[0] || null,
        assignedMode: "MANUAL",
        assignedLabour: null,
        assignedLabours: [],
      };
    }
  }

  /**
   * Pre-check availability & cooldown for client before requesting service booking
   */
  async checkAvailability(query: CheckAvailabilityQuery, clientId?: string) {
    let isUnderCooldown = false;
    let cooldownRemainingHours = 0;
    let lockedUntil: Date | null = null;

    if (clientId) {
      const cooldownRecord = await labourBookingRepo.getUserCategoryCooldown(clientId, query.category);
      if (cooldownRecord && cooldownRecord.isLocked && cooldownRecord.lockedUntil) {
        const now = new Date();
        if (cooldownRecord.lockedUntil > now) {
          isUnderCooldown = true;
          lockedUntil = cooldownRecord.lockedUntil;
          cooldownRemainingHours = Math.ceil((cooldownRecord.lockedUntil.getTime() - now.getTime()) / (1000 * 60 * 60));
        }
      }
    }

    const requestedCount = query.labourCount ? Number(query.labourCount) : 1;
    const availableLabours = await labourBookingRepo.findAvailableLaboursInRegion(query.state, query.city, query.category);
    const platformSetting = await labourBookingRepo.getPlatformSetting();

    const isSufficient = availableLabours.length >= requestedCount;
    let message = "";
    if (availableLabours.length === 0) {
      message = `No verified labours are available in your city (${query.city}, ${query.state}) for ${query.category}.`;
    } else if (availableLabours.length < requestedCount) {
      message = `Only ${availableLabours.length} labour(s) are available in your city (${query.city}, ${query.state}) for ${query.category}. You requested ${requestedCount}.`;
    } else {
      message = `${availableLabours.length} verified labour(s) available in your city.`;
    }

    return {
      available: isSufficient && !isUnderCooldown,
      availableLaboursCount: availableLabours.length,
      requestedCount,
      isSufficient,
      message,
      isUnderCooldown,
      cooldownRemainingHours,
      lockedUntil,
      autoAssignEnabled: platformSetting.autoAssignLabour,
    };
  }

  /**
   * Labour Worker accepts incoming booking request
   */
  async acceptBooking(id: string, user: { id: string; userType?: string; isPlatformAdmin?: boolean }) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    if (!booking.labourId) {
      throw new ErrorResponse("No labour worker assigned to this booking.", statusCode.Bad_Request);
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

    const updated = await labourBookingRepo.update(id, {
      status: "ACCEPTED_BY_LABOUR",
      acceptedAt: new Date(),
    });

    // When labour accepts the work, their status becomes AT_WORK and isAvailable becomes false
    await prisma.labour.update({
      where: { id: booking.labourId },
      data: {
        status: LabourStatus.AT_WORK,
        isAvailable: false,
      },
    });

    return updated;
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

    if (!booking.labourId) {
      throw new ErrorResponse("No labour worker assigned to this booking.", statusCode.Bad_Request);
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

    const updated = await labourBookingRepo.update(id, {
      status: "REJECTED_BY_LABOUR",
      statusReason: payload.reason || "Rejected by labour",
    });

    // Check if labour has no other active ongoing bookings and sync status to AVAILABLE
    await this.syncLabourAvailability(booking.labourId, id);

    return updated;
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

    if (!booking.labourId) {
      throw new ErrorResponse("No labour worker assigned to this booking.", statusCode.Bad_Request);
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

    const isAccepted = payload.accept === true || (payload as any).accepted === true;

    if (isAccepted) {
      const quoteAmount = Number(booking.quoteAmount || 0);
      let commissionAmount = 0.00;
      let commissionStatus = "NOT_APPLICABLE";

      // Calculate commission only for Platform Marketplace bookings
      if (booking.channel === "PLATFORM_MARKETPLACE") {
        const setting = await labourBookingRepo.getPlatformSetting();
        const rate = Number(booking.commissionRate ?? setting?.platformCommissionRate ?? MARKETPLACE_CONFIG.DEFAULT_COMMISSION_PERCENTAGE);
        commissionAmount = Number(((quoteAmount * rate) / 100).toFixed(2));
        commissionStatus = "PENDING";
      }

      const updated = await labourBookingRepo.update(id, {
        status: "WORK_STARTED",
        dealValue: quoteAmount,
        dealAcceptedAt: new Date(),
        startedAt: new Date(),
        commissionAmount,
        commissionStatus,
      });

      // Labour is actively at work
      if (booking.labourId) {
        await prisma.labour.update({
          where: { id: booking.labourId },
          data: {
            status: LabourStatus.AT_WORK,
            isAvailable: false,
          },
        });
      }

      // Reset consecutive rejection counter for this category upon quote acceptance
      await this.handleQuotationResponseCooldown(
        booking.clientId!,
        booking.category || "General",
        true,
        id,
        booking.labourId || ""
      );

      return updated;
    } else {
      const updated = await labourBookingRepo.update(id, {
        status: "QUOTE_REJECTED",
        statusReason: payload.rejectionReason || "Quote rejected by client",
      });

      // Track consecutive rejection and trigger 3-day cooldown if threshold reached (3 rejections)
      const cooldownResult = await this.handleQuotationResponseCooldown(
        booking.clientId!,
        booking.category || "General",
        false,
        id,
        booking.labourId || "",
        payload.rejectionReason || undefined
      );

      // Check if labour has no other active ongoing bookings and sync status to AVAILABLE
      if (booking.labourId) {
        await this.syncLabourAvailability(booking.labourId, id);
      }

      return {
        ...updated,
        cooldownApplied: cooldownResult.cooldownApplied,
        lockedUntil: cooldownResult.lockedUntil,
        consecutiveRejectionsCount: cooldownResult.rejectionCount,
      };
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

    if (!booking.labourId) {
      throw new ErrorResponse("No labour worker assigned to this booking.", statusCode.Bad_Request);
    }

    if (!user.isPlatformAdmin) {
      const isAssigned = await this.isAssignedWorker(booking.labourId, user.id);
      if (!isAssigned && booking.labourId !== user.id) {
        throw new ErrorResponse("Unauthorized. You are not the assigned labour worker for this booking.", statusCode.Forbidden);
      }
    }

    const allowed = ["ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"];
    if (!allowed.includes(booking.status)) {
      throw new ErrorResponse(`Cannot mark work completed from status: ${booking.status}. Expected ACCEPTED_BY_LABOUR, WORK_STARTED or IN_PROGRESS.`, statusCode.Bad_Request);
    }

    const updated = await labourBookingRepo.update(id, {
      status: "WORK_COMPLETED",
      taskChecklist: payload.taskChecklist,
      proofPhotos: payload.proofPhotos,
      completedAt: new Date(),
    });

    // When work is completed, mark labour status as AVAILABLE
    await this.syncLabourAvailability(booking.labourId, id);

    return updated;
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

    const allowed = ["WORK_COMPLETED", "IN_PROGRESS", "WORK_STARTED", "ACCEPTED_BY_LABOUR"];
    if (!allowed.includes(booking.status)) {
      throw new ErrorResponse(`Cannot confirm completion for booking in status: ${booking.status}.`, statusCode.Bad_Request);
    }

    const updated = await labourBookingRepo.update(id, {
      status: "COMPLETED",
      completedAt: booking.completedAt || new Date(),
    });

    // If client left a rating review, save it and update labour average rating
    if (payload.rating !== undefined && booking.labourId) {
      const labourId = booking.labourId;
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
          labourId,
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
        where: { labourId },
        _avg: { rating: true },
        _count: { _all: true },
      });

      await prisma.labour.update({
        where: { id: labourId },
        data: {
          averageRating: stats._avg?.rating || 5.0,
          totalReviewsCount: stats._count?._all || 0,
          completedBookingsCount: { increment: 1 },
        },
      });
    }

    // When work is completed, mark labour status as AVAILABLE
    if (booking.labourId) {
      await this.syncLabourAvailability(booking.labourId, id);
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

    // Delay verification: Check hours elapsed since booking acceptance/request against platform setting
    const platformSetting = await labourBookingRepo.getPlatformSetting();
    const minHours = platformSetting?.delayReportMinHours ?? MARKETPLACE_CONFIG.DELAY_REPORT_MIN_HOURS;
    const referenceDate = booking.acceptedAt || booking.startDate || booking.createdAt;
    const hoursElapsed = (Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60);

    if (hoursElapsed < minHours && !isPlatformAdmin) {
      const remainingHours = Math.ceil(minHours - hoursElapsed);
      throw new ErrorResponse(
        `Arrival delay can only be reported after ${minHours} hours if the worker has not reached the site. Please wait ${remainingHours} more hour(s).`,
        statusCode.Bad_Request
      );
    }

    // Worker disciplinary action: increment warning count & penalize rating
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

      // Free previous labour availability
      await this.syncLabourAvailability(booking.labourId, id);
    }

    // Check Platform Setting: Auto vs Manual Assignment on Delay
    if (platformSetting.autoAssignLabour && booking.state && booking.city) {
      const candidateLabours = await labourBookingRepo.findAvailableLaboursInRegion(
        booking.state,
        booking.city,
        booking.category || "General",
        booking.labourId || undefined
      );

      if (candidateLabours.length > 0) {
        const replacement = candidateLabours[Math.floor(Math.random() * candidateLabours.length)]!;
        const currentAddl = (booking.additionalInformation as Record<string, any>) || {};
        const reassignmentLog = {
          fromLabourId: booking.labourId,
          toLabourId: replacement.id,
          reassignedAt: new Date().toISOString(),
          reassignedBy: "AUTO_ASSIGN_SYSTEM",
          reason: `Auto-reassigned due to arrival delay: ${payload.reason}`,
        };
        const reassignmentHistory = Array.isArray(currentAddl.reassignmentHistory)
          ? [...currentAddl.reassignmentHistory, reassignmentLog]
          : [reassignmentLog];

        const updated = await labourBookingRepo.update(id, {
          labourId: replacement.id,
          status: "REQUESTED",
          statusReason: `Auto-reassigned due to arrival delay: ${payload.reason}`,
          delayReportedAt: new Date(),
          reassignedFromBookingId: booking.id,
          quoteAmount: null,
          quoteDescription: null,
          dealValue: null,
          additionalInformation: {
            ...currentAddl,
            reassignmentHistory,
          },
        });

        return {
          ...updated,
          reassignedMode: "AUTO",
          reassignedLabour: replacement,
        };
      }
    }

    // If auto-assign is OFF or no immediate candidate found:
    const updated = await labourBookingRepo.update(id, {
      status: "DELAY_REPORTED",
      statusReason: payload.reason,
      delayReportedAt: new Date(),
    });

    return {
      ...updated,
      reassignedMode: "MANUAL",
      reassignedLabour: null,
    };
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

    // Verify replacement labour worker is available and has no active ongoing work
    await this.validateLabourAvailability(payload.newLabourId, id);

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

    // Free the previous labour if no other active booking
    if (booking.labourId) {
      await this.syncLabourAvailability(booking.labourId, id);
    }

    const updated = await labourBookingRepo.update(id, {
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

    if (["ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"].includes(payload.resetStatusTo || "")) {
      await prisma.labour.update({
        where: { id: newLabour.id },
        data: {
          status: LabourStatus.AT_WORK,
          isAvailable: false,
        },
      });
    }

    return updated;
  }

  /**
   * Platform Admin manually assigns a labour to a booking in PENDING_ASSIGNMENT, DELAY_REPORTED, or REQUESTED status
   */
  async manualAssignLabour(
    id: string,
    payload: ManualAssignLabourInput,
    adminUserId: string
  ) {
    const booking = await labourBookingRepo.findById(id);
    if (!booking) {
      throw new ErrorResponse("Booking not found", statusCode.Not_Found);
    }

    const allowedStatuses = ["PENDING_ASSIGNMENT", "DELAY_REPORTED", "REQUESTED", "REJECTED_BY_LABOUR"];
    if (!allowedStatuses.includes(booking.status)) {
      throw new ErrorResponse(
        `Cannot manually assign labour for booking in status: ${booking.status}. Expected PENDING_ASSIGNMENT, DELAY_REPORTED, or REQUESTED.`,
        statusCode.Bad_Request
      );
    }

    const labour = await prisma.labour.findUnique({
      where: { id: payload.labourId, isDeleted: false },
      include: { kycDocument: true },
    });
    if (!labour) {
      throw new ErrorResponse("Labour worker not found", statusCode.Not_Found);
    }
    if (labour.isBlacklisted) {
      throw new ErrorResponse("Labour worker is suspended/blacklisted", statusCode.Forbidden);
    }

    const isKyc = labour.isKycVerified || labour.kycDocument?.status === "APPROVED";
    if (!isKyc) {
      throw new ErrorResponse("Labour must be KYC verified before assignment", statusCode.Bad_Request);
    }

    // Verify labour availability
    await this.validateLabourAvailability(payload.labourId, id);

    // Free the previous labour if any
    if (booking.labourId && booking.labourId !== labour.id) {
      await this.syncLabourAvailability(booking.labourId, id);
    }

    const currentAddl = (booking.additionalInformation as Record<string, any>) || {};
    const manualLog = {
      fromLabourId: booking.labourId || null,
      toLabourId: labour.id,
      assignedAt: new Date().toISOString(),
      assignedBy: adminUserId,
      notes: payload.notes || "Manually assigned by platform admin",
    };
    const assignmentHistory = Array.isArray(currentAddl.assignmentHistory)
      ? [...currentAddl.assignmentHistory, manualLog]
      : [manualLog];

    const estimatedDays = booking.estimatedDays || 1;
    const dailyRate = Number(labour.dailyRate || 0);
    const totalBudget = dailyRate * estimatedDays;
    const commissionAmount = Number(((totalBudget * 10.0) / 100).toFixed(2));

    const updated = await labourBookingRepo.update(id, {
      labourId: labour.id,
      assignmentType: "MANUAL",
      status: "REQUESTED",
      statusReason: payload.notes || "Manually assigned by platform admin",
      agreedDailyRate: labour.dailyRate,
      totalBudget,
      commissionAmount,
      commissionStatus: "PENDING",
      additionalInformation: {
        ...currentAddl,
        assignmentHistory,
      },
    });

    return updated;
  }

  /**
   * Get Platform Labour Settings (Auto-Assign toggle & thresholds)
   */
  async getPlatformSettings() {
    return labourBookingRepo.getPlatformSetting();
  }

  /**
   * Update Platform Labour Settings (Toggle auto-assign ON/OFF)
   */
  async updatePlatformSettings(data: PlatformLabourSettingInput, updatedById?: string) {
    return labourBookingRepo.updatePlatformSetting({ ...data, updatedById });
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
   * Full symmetric update of booking (Org/Client/Admin)
   */
  async updateBooking(
    id: string,
    payload: UpdateLabourBookingInput,
    scope?:
      | string
      | {
          organizationId?: string | null;
          clientId?: string | null;
          workerUserId?: string | null;
          isPlatformAdmin?: boolean;
        }
  ) {
    const normalizedScope = typeof scope === "string" ? { organizationId: scope } : scope;
    const existing = await this.getBookingById(id, normalizedScope);
    const orgId = normalizedScope?.organizationId || existing.organizationId || undefined;

    // Guard: Client can only modify task checklist if work has NOT been started yet
    if (payload.taskChecklist !== undefined && normalizedScope?.clientId && !normalizedScope?.isPlatformAdmin) {
      const WORK_STARTED_STATUSES = [
        "WORK_STARTED",
        "IN_PROGRESS",
        "WORK_COMPLETED",
        "COMPLETED",
        "CANCELLED",
        "DISPUTED",
      ];
      if (WORK_STARTED_STATUSES.includes(existing.status)) {
        throw new ErrorResponse(
          `Task checklist cannot be modified once work has started (Current booking status: ${existing.status})`,
          statusCode.Bad_Request
        );
      }
    }

    // Guard: Work cannot be started until quotation has been sent and accepted by the client/user
    if (payload.status && ["WORK_STARTED", "IN_PROGRESS"].includes(payload.status)) {
      const isClientBooking = existing.channel === "PLATFORM_MARKETPLACE" || Boolean(existing.clientId);
      if (isClientBooking) {
        if (!existing.quoteSubmittedAt && !existing.quoteAmount) {
          throw new ErrorResponse(
            "Work cannot be started until quotation has been sent and accepted by the client.",
            statusCode.Bad_Request
          );
        }
        if (!existing.dealAcceptedAt) {
          throw new ErrorResponse(
            "Work cannot be started until quotation has been accepted by the client.",
            statusCode.Bad_Request
          );
        }
      }
    }

    // If labourId is changing, verify
    if (payload.labourId && payload.labourId !== existing.labourId) {
      const labour = await labourRepo.findById(payload.labourId, orgId);
      if (!labour) {
        throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
      }
      await this.validateLabourAvailability(payload.labourId, id);
    }

    // If projectId is changing, verify
    const targetProjectId = payload.projectId || existing.projectId;
    if (payload.projectId && payload.projectId !== existing.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: payload.projectId, ...(orgId && { organizationId: orgId }), isDeleted: false },
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
          ...(orgId && { organizationId: orgId }),
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
    organizationId?: string,
    isPlatformAdmin?: boolean
  ) {
    const booking = await this.getBookingById(id, { organizationId, isPlatformAdmin });

    // Guard: Work cannot be started until quotation has been sent and accepted by the client/user
    if (["WORK_STARTED", "IN_PROGRESS"].includes(status)) {
      const isClientBooking = booking.channel === "PLATFORM_MARKETPLACE" || Boolean(booking.clientId);
      if (isClientBooking) {
        if (!booking.quoteSubmittedAt && !booking.quoteAmount) {
          throw new ErrorResponse(
            "Work cannot be started until quotation has been sent and accepted by the client.",
            statusCode.Bad_Request
          );
        }
        if (!booking.dealAcceptedAt) {
          throw new ErrorResponse(
            "Work cannot be started until quotation has been accepted by the client.",
            statusCode.Bad_Request
          );
        }
      }
    }

    const updated = await labourBookingRepo.update(id, {
      status,
      ...(status === "COMPLETED" && !booking.completedAt ? { completedAt: new Date() } : {}),
    });

    if (booking.labourId) {
      if (["ACCEPTED_BY_LABOUR", "WORK_STARTED", "IN_PROGRESS"].includes(status)) {
        await prisma.labour.update({
          where: { id: booking.labourId },
          data: {
            status: LabourStatus.AT_WORK,
            isAvailable: false,
          },
        });
      } else if (["WORK_COMPLETED", "COMPLETED", "CANCELLED", "REJECTED_BY_LABOUR"].includes(status)) {
        await this.syncLabourAvailability(booking.labourId, id);
      }
    }

    if (booking.projectServiceId) {
      await projectServiceRepo.recalculateRollup(booking.projectServiceId);
    }

    return updated;
  }

  /**
   * Soft delete booking
   */
  async deleteBooking(id: string, organizationId?: string) {
    const existing = await this.getBookingById(id, { organizationId });
    const result = await labourBookingRepo.softDelete(id);

    // Sync labour availability when booking is deleted
    if (existing.labourId) {
      await this.syncLabourAvailability(existing.labourId, id);
    }

    // Recalculate parent service rollup if exists
    if (existing.projectServiceId) {
      await projectServiceRepo.recalculateRollup(existing.projectServiceId);
    }

    return result;
  }
}

export const labourBookingService = new LabourBookingService();

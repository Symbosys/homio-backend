import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { projectServiceRepo } from "../repos/project-service.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateLabourBookingInput,
  UpdateLabourBookingInput,
  GetLabourBookingsQuery,
} from "../validators/labour-booking.validator.js";

/**
 * Labour Booking Service
 * Business logic for worker allocations under Project Services, budget calculations, and status progression.
 */
export class LabourBookingService {
  /**
   * Create a new project booking allocated under a Project Service
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
    const bookingNumber = await labourBookingRepo.generateBookingNumber(payload.projectId);

    // 5. Calculate total budget
    const totalBudget = payload.agreedDailyRate * (payload.estimatedDays || 1);

    const booking = await labourBookingRepo.create({
      ...payload,
      bookingNumber,
      totalBudget,
    });

    // 6. Recalculate financial rollups on parent project service
    await projectServiceRepo.recalculateRollup(payload.projectServiceId);

    return booking;
  }

  /**
   * Get single booking by ID
   */
  async getBookingById(id: string, organizationId: string) {
    const booking = await labourBookingRepo.findById(id, organizationId);
    if (!booking) {
      throw new ErrorResponse("Booking not found or unauthorized", statusCode.Not_Found);
    }
    return booking;
  }

  /**
   * Get all paginated bookings
   */
  async getBookings(query: GetLabourBookingsQuery, organizationId: string) {
    return labourBookingRepo.findAll(query, organizationId);
  }

  /**
   * Full symmetric update of booking
   */
  async updateBooking(id: string, payload: UpdateLabourBookingInput, organizationId: string) {
    const existing = await this.getBookingById(id, organizationId);

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
        where: { id: payload.projectId, organizationId, isDeleted: false },
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
          organizationId,
          projectId: targetProjectId,
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
    const totalBudget = payload.totalBudget ?? agreedDailyRate * estimatedDays;

    const updated = await labourBookingRepo.update(id, {
      ...payload,
      totalBudget,
    });

    // Recalculate rollups for original and new project service (if changed)
    await projectServiceRepo.recalculateRollup(existing.projectServiceId);
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
    status: "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    organizationId: string
  ) {
    await this.getBookingById(id, organizationId);
    return labourBookingRepo.update(id, { status });
  }

  /**
   * Soft delete booking
   */
  async deleteBooking(id: string, organizationId: string) {
    const existing = await this.getBookingById(id, organizationId);
    const result = await labourBookingRepo.softDelete(id);

    // Recalculate parent service rollup
    await projectServiceRepo.recalculateRollup(existing.projectServiceId);

    return result;
  }
}

export const labourBookingService = new LabourBookingService();

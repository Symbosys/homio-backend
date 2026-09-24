import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
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
 * Business logic for worker project assignments, budget calculations, and status progression.
 */
export class LabourBookingService {
  /**
   * Create a new project booking
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

    // 3. Generate booking number
    const bookingNumber = await labourBookingRepo.generateBookingNumber(payload.projectId);

    // 4. Calculate total budget if not provided
    const totalBudget = payload.agreedDailyRate * (payload.estimatedDays || 1);

    return labourBookingRepo.create({
      ...payload,
      bookingNumber,
      totalBudget,
    });
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
    if (payload.projectId && payload.projectId !== existing.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: payload.projectId, organizationId, isDeleted: false },
      });
      if (!project) {
        throw new ErrorResponse("Project not found or unauthorized", statusCode.Not_Found);
      }
    }

    // Recalculate total budget if rate or days updated
    const agreedDailyRate = payload.agreedDailyRate ?? Number(existing.agreedDailyRate);
    const estimatedDays = payload.estimatedDays ?? existing.estimatedDays;
    const totalBudget = payload.totalBudget ?? agreedDailyRate * estimatedDays;

    return labourBookingRepo.update(id, {
      ...payload,
      totalBudget,
    });
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
    await this.getBookingById(id, organizationId);
    return labourBookingRepo.softDelete(id);
  }
}

export const labourBookingService = new LabourBookingService();

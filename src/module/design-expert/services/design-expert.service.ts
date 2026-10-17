import { DesignExpertRepo } from "../repos/design-expert.repo.js";
import { DesignExpertBookingRepo } from "../repos/design-expert-booking.repo.js";
import { DayOfWeek, statusCode } from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type {
  CreateDesignExpertInput,
  UpdateDesignExpertInput,
  GetDesignExpertsQuery,
  SetWeeklyAvailabilityInput,
  AddDateOverrideInput,
} from "../validators/design-expert.validator.js";

/**
 * Service layer for Design Expert operations and real-time slot generation engine
 */
export class DesignExpertService {
  private expertRepo = new DesignExpertRepo();
  private bookingRepo = new DesignExpertBookingRepo();

  /**
   * Helper: Map JavaScript getDay() (0 = Sunday .. 6 = Saturday) to Prisma DayOfWeek enum
   */
  private mapDayOfWeek(dayIndex: number): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[dayIndex] ?? DayOfWeek.SUNDAY;
  }

  /**
   * Helper: Add minutes to "HH:mm" time string
   */
  private addMinutes(timeStr: string, minutesToAdd: number): string {
    const parts = timeStr.split(":").map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    const totalMinutes = h * 60 + m + minutesToAdd;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  }

  /**
   * Create a new design expert
   */
  async createExpert(data: CreateDesignExpertInput) {
    return this.expertRepo.create(data);
  }

  /**
   * Get single expert by ID
   */
  async getExpertById(id: string) {
    const expert = await this.expertRepo.findById(id);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    return expert;
  }

  /**
   * List experts with search, filtering, and pagination
   */
  async getExperts(query: GetDesignExpertsQuery) {
    return this.expertRepo.findAll(query);
  }

  /**
   * Partially update an expert profile
   */
  async updateExpert(id: string, data: UpdateDesignExpertInput) {
    const expert = await this.expertRepo.findById(id);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    return this.expertRepo.update(id, data);
  }

  /**
   * Soft delete an expert profile
   */
  async deleteExpert(id: string) {
    const expert = await this.expertRepo.findById(id);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    return this.expertRepo.delete(id);
  }

  /**
   * Get availability configuration for an expert
   */
  async getAvailability(expertId: string) {
    const expert = await this.expertRepo.findById(expertId);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    return this.expertRepo.getAvailability(expertId);
  }

  /**
   * Set weekly recurring working hours for an expert
   */
  async setWeeklyAvailability(expertId: string, input: SetWeeklyAvailabilityInput) {
    const expert = await this.expertRepo.findById(expertId);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    return this.expertRepo.setWeeklyAvailability(expertId, input);
  }

  /**
   * Add a date-specific override or leave
   */
  async addDateOverride(expertId: string, input: AddDateOverrideInput) {
    const expert = await this.expertRepo.findById(expertId);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    return this.expertRepo.addDateOverride(expertId, input);
  }

  /**
   * Remove a date-specific override
   */
  async deleteDateOverride(expertId: string, overrideId: string) {
    const expert = await this.expertRepo.findById(expertId);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }
    await this.expertRepo.deleteDateOverride(expertId, overrideId);
    return { success: true, message: "Date override deleted successfully" };
  }

  /**
   * Real-Time Slot Calculation Engine
   * Slices working hours into time intervals and subtracts already booked slots for that date
   */
  async calculateSlots(expertId: string, dateStr: string) {
    const expert = await this.expertRepo.findById(expertId);
    if (!expert) {
      throw new ErrorResponse("Design expert not found", statusCode.Not_Found);
    }

    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      throw new ErrorResponse("Invalid date format. Expected YYYY-MM-DD", statusCode.Bad_Request);
    }

    const dayOfWeek = this.mapDayOfWeek(dateObj.getUTCDay());
    const slotDuration = expert.slotDurationMinutes || 30;

    // 1. Check for specific date override / leave
    const override = await this.expertRepo.findDateOverride(expertId, dateObj);

    let workingWindows: Array<{ startTime: string; endTime: string }> = [];

    if (override) {
      if (!override.isAvailable) {
        // Entire day blocked / expert on leave
        return {
          expertId,
          date: dateStr,
          dayOfWeek,
          isBlocked: true,
          blockReason: override.reason || "Expert is on leave on this date",
          slotDurationMinutes: slotDuration,
          totalSlots: 0,
          availableSlotsCount: 0,
          slots: [],
        };
      }

      // Custom working window on this date
      if (override.startTime && override.endTime) {
        workingWindows.push({ startTime: override.startTime, endTime: override.endTime });
      }
    } else {
      // 2. Fall back to standard weekly shifts for this day of week
      const shifts = await this.expertRepo.findDayOfWeekShifts(expertId, dayOfWeek);
      for (const shift of shifts) {
        if (shift.startTime && shift.endTime) {
          workingWindows.push({ startTime: shift.startTime, endTime: shift.endTime });
        }
      }
    }

    if (workingWindows.length === 0) {
      return {
        expertId,
        date: dateStr,
        dayOfWeek,
        isBlocked: false,
        blockReason: "No scheduled working hours on this day",
        slotDurationMinutes: slotDuration,
        totalSlots: 0,
        availableSlotsCount: 0,
        slots: [],
      };
    }

    // 3. Fetch all active bookings for this expert on this date
    const bookedAppointments = await this.bookingRepo.findActiveBookingsForDate(expertId, dateObj);
    const bookedStartTimes = new Set(bookedAppointments.map((b) => b.startTime));

    // 4. Generate discrete slot slices
    const generatedSlots: Array<{
      startTime: string;
      endTime: string;
      isAvailable: boolean;
      reason?: string;
    }> = [];

    for (const win of workingWindows) {
      let current = win.startTime;
      while (current < win.endTime) {
        const next = this.addMinutes(current, slotDuration);
        if (next > win.endTime) break;

        const isBooked = bookedStartTimes.has(current);
        generatedSlots.push({
          startTime: current,
          endTime: next,
          isAvailable: !isBooked,
          reason: isBooked ? "Already Booked" : undefined,
        });

        current = next;
      }
    }

    const availableSlotsCount = generatedSlots.filter((s) => s.isAvailable).length;

    return {
      expertId,
      date: dateStr,
      dayOfWeek,
      isBlocked: false,
      slotDurationMinutes: slotDuration,
      totalSlots: generatedSlots.length,
      availableSlotsCount,
      slots: generatedSlots,
    };
  }
}

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";
import { DesignExpertService } from "../../src/module/design-expert/services/design-expert.service.js";
import { DayOfWeek, DesignExpertStatus, ExpertBookingStatus, ExpertPaymentStatus } from "../../src/types/types.js";

describe("Design Expert - Availability & Slot Calculation Engine Tests", () => {
  const service = new DesignExpertService();
  let testExpertId: string;
  let testUserId: string;

  beforeAll(async () => {
    // 1. Create a test expert
    const expert = await service.createExpert({
      name: "Ar. Vikram Sengupta",
      title: "Modular Kitchen & Wardrobe Specialist",
      specialties: ["Modular Kitchen", "Space Optimization"],
      slotDurationMinutes: 30,
      status: DesignExpertStatus.ACTIVE,
    });
    testExpertId = expert.id;

    // 2. Create a test user for booking simulation
    const user = await prisma.user.create({
      data: {
        email: `client_slots_${Date.now()}@example.com`,
        firstName: "Anand",
        lastName: "Deshmukh",
        userType: "USER",
        status: "ACTIVE",
      },
    });
    testUserId = user.id;
  });

  afterAll(async () => {
    if (testExpertId) {
      await prisma.designExpertBooking.deleteMany({
        where: { expertId: testExpertId },
      }).catch(() => {});

      await prisma.designExpertAvailability.deleteMany({
        where: { expertId: testExpertId },
      }).catch(() => {});

      await prisma.designExpert.deleteMany({
        where: { id: testExpertId },
      }).catch(() => {});
    }

    if (testUserId) {
      await prisma.user.deleteMany({
        where: { id: testUserId },
      }).catch(() => {});
    }
  });

  it("should configure weekly recurring working hours", async () => {
    const shifts = await service.setWeeklyAvailability(testExpertId, {
      shifts: [
        {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: "10:00",
          endTime: "13:00",
          isAvailable: true,
          reason: "Morning Shift",
        },
        {
          dayOfWeek: DayOfWeek.MONDAY,
          startTime: "14:00",
          endTime: "18:00",
          isAvailable: true,
          reason: "Afternoon Shift",
        },
        {
          dayOfWeek: DayOfWeek.WEDNESDAY,
          startTime: "10:00",
          endTime: "16:00",
          isAvailable: true,
        },
      ],
    });

    expect(shifts.length).toBe(3);
    const mondayShifts = shifts.filter((s) => s.dayOfWeek === DayOfWeek.MONDAY);
    expect(mondayShifts.length).toBe(2);
  });

  it("should compute real-time slots for a scheduled weekly shift (e.g. Monday)", async () => {
    // 2026-10-26 is a Monday
    const testMonday = "2026-10-26";
    const result = await service.calculateSlots(testExpertId, testMonday);

    expect(result.expertId).toBe(testExpertId);
    expect(result.dayOfWeek).toBe(DayOfWeek.MONDAY);
    expect(result.isBlocked).toBe(false);
    expect(result.totalSlots).toBe(14); // 6 slots (10:00-13:00) + 8 slots (14:00-18:00) = 14 slots
    expect(result.availableSlotsCount).toBe(14);

    // Verify first slot
    expect(result.slots[0]).toEqual({
      startTime: "10:00",
      endTime: "10:30",
      isAvailable: true,
      reason: undefined,
    });
  });

  it("should exclude already booked slots from available slots", async () => {
    const testMonday = "2026-10-26";

    // Simulate an existing active booking at 10:30
    await prisma.designExpertBooking.create({
      data: {
        bookingNumber: `DEB-TEST-${Date.now()}`,
        expertId: testExpertId,
        userId: testUserId,
        bookingDate: new Date(testMonday),
        startTime: "10:30",
        endTime: "11:00",
        status: ExpertBookingStatus.SCHEDULED,
        paymentStatus: ExpertPaymentStatus.FREE,
        topic: "Modular Kitchen Consultation",
      },
    });

    const result = await service.calculateSlots(testExpertId, testMonday);

    // Total slots remains 14, but availableSlotsCount should be 13
    expect(result.totalSlots).toBe(14);
    expect(result.availableSlotsCount).toBe(13);

    // Find slot at 10:30
    const bookedSlot = result.slots.find((s) => s.startTime === "10:30");
    expect(bookedSlot).toBeDefined();
    expect(bookedSlot?.isAvailable).toBe(false);
    expect(bookedSlot?.reason).toBe("Already Booked");

    // Adjacent slot at 10:00 should still be available
    const availableSlot = result.slots.find((s) => s.startTime === "10:00");
    expect(availableSlot?.isAvailable).toBe(true);
  });

  it("should return zero slots when a specific date is marked as on leave", async () => {
    // Add date override on 2026-10-26 (leave / unavailable)
    const override = await service.addDateOverride(testExpertId, {
      specificDate: "2026-10-26",
      isAvailable: false,
      reason: "Attending Design Expo",
    });

    expect(override).toBeDefined();
    expect(override.isAvailable).toBe(false);

    // Now calculate slots for 2026-10-26
    const result = await service.calculateSlots(testExpertId, "2026-10-26");
    expect(result.isBlocked).toBe(true);
    expect(result.blockReason).toBe("Attending Design Expo");
    expect(result.totalSlots).toBe(0);
    expect(result.availableSlotsCount).toBe(0);
    expect(result.slots.length).toBe(0);
  });

  it("should restore normal weekly shifts after deleting date leave override", async () => {
    const availability = await service.getAvailability(testExpertId);
    const leaveOverride = availability.dateOverrides[0];
    expect(leaveOverride).toBeDefined();

    // Delete override
    await service.deleteDateOverride(testExpertId, leaveOverride!.id);

    // Verify slots are restored
    const result = await service.calculateSlots(testExpertId, "2026-10-26");
    expect(result.isBlocked).toBe(false);
    expect(result.totalSlots).toBe(14);
  });
});

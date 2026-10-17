import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";
import { DesignExpertService } from "../../src/module/design-expert/services/design-expert.service.js";
import { DesignExpertBookingService } from "../../src/module/design-expert/services/design-expert-booking.service.js";
import { DesignExpertStatus, ExpertBookingStatus, ExpertPaymentStatus } from "../../src/types/types.js";

describe("Design Expert - Platform Booking Administration Tests", () => {
  const expertService = new DesignExpertService();
  const bookingService = new DesignExpertBookingService();

  let testExpertId: string;
  let testUserId: string;
  let bookingId1: string;
  let bookingId2: string;

  beforeAll(async () => {
    // 1. Create Expert
    const expert = await expertService.createExpert({
      name: "Ar. Rohini Sen",
      title: "Vastu & Residential Architecture Lead",
      consultationFee: 1500,
      status: DesignExpertStatus.ACTIVE,
    });
    testExpertId = expert.id;

    // 2. Create User
    const user = await prisma.user.create({
      data: {
        email: `client_mgmt_${Date.now()}@example.com`,
        firstName: "Meera",
        lastName: "Kapoor",
        userType: "USER",
        status: "ACTIVE",
      },
    });
    testUserId = user.id;

    // 3. Create 2 Bookings for testing
    const b1 = await prisma.designExpertBooking.create({
      data: {
        bookingNumber: `DEB-TEST-B1-${Date.now()}`,
        expertId: testExpertId,
        userId: testUserId,
        bookingDate: new Date("2026-11-01"),
        startTime: "11:00",
        endTime: "11:30",
        meetingUrl: "https://meet.google.com/b1-link",
        topic: "Vastu Audit for Living & Pooja Room",
        status: ExpertBookingStatus.SCHEDULED,
        paymentStatus: ExpertPaymentStatus.PAID,
        amount: 1500,
      },
    });
    bookingId1 = b1.id;

    const b2 = await prisma.designExpertBooking.create({
      data: {
        bookingNumber: `DEB-TEST-B2-${Date.now()}`,
        expertId: testExpertId,
        userId: testUserId,
        bookingDate: new Date("2026-11-01"),
        startTime: "12:00",
        endTime: "12:30",
        meetingUrl: "https://meet.google.com/b2-link",
        topic: "Kitchen Island Layout",
        status: ExpertBookingStatus.SCHEDULED,
        paymentStatus: ExpertPaymentStatus.PAID,
        amount: 1500,
      },
    });
    bookingId2 = b2.id;
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

  it("should list bookings with pagination and expert filtering", async () => {
    const result = await bookingService.getBookings({
      page: 1,
      limit: 10,
      expertId: testExpertId,
    });

    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.pagination.total).toBeGreaterThanOrEqual(2);
    expect(result.items[0]?.expert.id).toBe(testExpertId);
  });

  it("should get single booking details with client and expert relations", async () => {
    const booking = await bookingService.getBookingById(bookingId1);

    expect(booking.id).toBe(bookingId1);
    expect(booking.topic).toBe("Vastu Audit for Living & Pooja Room");
    expect(booking.expert.name).toBe("Ar. Rohini Sen");
    expect(booking.user.firstName).toBe("Meera");
  });

  it("should allow Platform Admin to edit booking details (reschedule & update link)", async () => {
    const updated = await bookingService.platformEditBooking(bookingId1, {
      bookingDate: "2026-11-02",
      startTime: "14:00",
      endTime: "14:30",
      meetingUrl: "https://meet.google.com/new-rescheduled-link",
      topic: "Rescheduled: Vastu Audit Session",
    });

    expect(updated.startTime).toBe("14:00");
    expect(updated.endTime).toBe("14:30");
    expect(updated.meetingUrl).toBe("https://meet.google.com/new-rescheduled-link");
    expect(updated.topic).toBe("Rescheduled: Vastu Audit Session");
  });

  it("should reject rescheduling if the new slot conflicts with another booking (Collision Guard)", async () => {
    // Attempt to move bookingId1 to 2026-11-01 at 12:00 (which is already booked by bookingId2)
    expect(async () => {
      await bookingService.platformEditBooking(bookingId1, {
        bookingDate: "2026-11-01",
        startTime: "12:00",
        endTime: "12:30",
      });
    }).toThrow();
  });

  it("should allow Platform Admin to cancel a booking and free up the slot", async () => {
    const result = await bookingService.platformCancelBooking(bookingId2, "Client requested cancellation due to travel");

    expect(result.success).toBe(true);
    expect(result.data.status).toBe(ExpertBookingStatus.CANCELLED);

    // Verify it is now cancelled
    const booking = await bookingService.getBookingById(bookingId2);
    expect(booking.status).toBe(ExpertBookingStatus.CANCELLED);
  });

  it("should mark session as completed and allow client to submit rating", async () => {
    // Complete bookingId1
    const completionResult = await bookingService.platformCompleteBooking(bookingId1);
    expect(completionResult.success).toBe(true);
    expect(completionResult.data.status).toBe(ExpertBookingStatus.COMPLETED);

    // Client submits 5-star review
    const reviewResult = await bookingService.submitReview(
      bookingId1,
      testUserId,
      5,
      "Outstanding design consultation! Extremely thorough Vastu advice.",
    );

    expect(reviewResult.success).toBe(true);
    expect(reviewResult.data.rating).toBe(5);
    expect(reviewResult.data.reviewComment).toContain("Outstanding");

    // Verify expert's aggregate average rating updated
    const updatedExpert = await expertService.getExpertById(testExpertId);
    expect(updatedExpert.totalReviewsCount).toBe(1);
    expect(updatedExpert.averageRating).toBe(5.0);
    expect(updatedExpert.completedBookingsCount).toBe(1);
  });

  it("should reject client review submission if session is not completed", async () => {
    // Attempt to review cancelled bookingId2
    expect(async () => {
      await bookingService.submitReview(bookingId2, testUserId, 4, "Premature review");
    }).toThrow();
  });
});

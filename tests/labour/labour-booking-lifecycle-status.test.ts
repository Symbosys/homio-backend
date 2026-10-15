import { describe, it, expect, afterAll } from "bun:test";
import { prisma } from "../../src/lib/prisma.js";
import { labourService } from "../../src/module/labour/services/labour.service.js";
import { labourBookingService } from "../../src/module/labour/services/labour-booking.service.js";
import { LabourStatus, UserType, UserStatus } from "../../src/types/types.js";

describe("Labour Booking Status Transitions Integration Tests (AT_WORK and AVAILABLE)", () => {
  let createdLabourIds: string[] = [];
  let createdUserIds: string[] = [];
  let createdBookingIds: string[] = [];

  afterAll(async () => {
    if (createdBookingIds.length > 0) {
      await prisma.labourRating.deleteMany({
        where: { bookingId: { in: createdBookingIds } },
      }).catch(() => {});
      await prisma.labourBooking.deleteMany({
        where: { id: { in: createdBookingIds } },
      }).catch(() => {});
    }

    if (createdLabourIds.length > 0) {
      await prisma.labourKycDocument.deleteMany({
        where: { labourId: { in: createdLabourIds } },
      }).catch(() => {});
      await prisma.labour.deleteMany({
        where: { id: { in: createdLabourIds } },
      }).catch(() => {});
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  it("should transition labour status to AT_WORK when booking is accepted, and back to AVAILABLE when work is completed", async () => {
    // 1. Setup Client User
    const clientPhone = `95${Math.floor(10000000 + Math.random() * 90000000)}`;
    const clientEmail = `client_${Date.now()}@example.com`;
    const clientUser = await prisma.user.create({
      data: {
        firstName: "Test",
        lastName: "Client",
        phone: clientPhone,
        email: clientEmail,
        passwordHash: "$2b$10$hashedpasswordstring",
        userType: UserType.USER,
        status: UserStatus.ACTIVE,
      },
    });
    createdUserIds.push(clientUser.id);

    // 2. Setup Registered and Approved Labour (Status: AVAILABLE)
    const workerPhone = `94${Math.floor(10000000 + Math.random() * 90000000)}`;
    const workerEmail = `worker_${Date.now()}@example.com`;
    const registeredLabour = await labourService.registerPublicLabour({
      name: "Suresh Mistry",
      phone: workerPhone,
      email: workerEmail,
      password: "WorkerPassword123!",
      trade: "Carpentry",
      skillLevel: "Skilled",
      dailyRate: 1000,
      state: "Maharashtra",
      city: "Pune",
      locality: "Kothrud",
      pincode: "411038",
      address: "12 Gandhi Chowk",
      aadhaarNo: "112233445566",
    });
    createdLabourIds.push(registeredLabour.id);
    if (registeredLabour.userId) createdUserIds.push(registeredLabour.userId);

    // Approve labour by Platform Admin -> Status becomes AVAILABLE
    const approvedLabour = await labourService.approveLabour(
      registeredLabour.id,
      { id: "admin-uuid-1", firstName: "Admin" },
      { verificationNotes: "All documents verified" }
    );
    expect(approvedLabour.status).toBe(LabourStatus.AVAILABLE);
    expect(approvedLabour.isAvailable).toBe(true);
    expect(approvedLabour.isKycVerified).toBe(true);

    // 3. Client creates a Marketplace Service Booking (Status: REQUESTED)
    const booking = await labourBookingService.createMarketplaceBooking(
      {
        labourId: approvedLabour.id,
        workTitle: "Modular Wardrobe Fitting",
        workDescription: "Fitting master bedroom wardrobe with 4 drawers and mirror panel.",
        startDate: new Date(),
        serviceAddress: "Flat 204, Kothrud Hills",
        locality: "Kothrud",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411038",
        termsAccepted: true,
      },
      clientUser.id
    );
    createdBookingIds.push(booking.id);

    expect(booking.status).toBe("REQUESTED");

    // Labour is still AVAILABLE until they accept the booking
    let currentLabour = await prisma.labour.findUnique({ where: { id: approvedLabour.id } });
    expect(currentLabour?.status).toBe(LabourStatus.AVAILABLE);
    expect(currentLabour?.isAvailable).toBe(true);

    // 4. Labour accepts the booking -> status becomes AT_WORK, isAvailable becomes false
    const acceptedBooking = await labourBookingService.acceptBooking(booking.id, {
      id: registeredLabour.userId!,
      userType: "LABOUR",
    });
    expect(acceptedBooking.status).toBe("ACCEPTED_BY_LABOUR");

    currentLabour = await prisma.labour.findUnique({ where: { id: approvedLabour.id } });
    expect(currentLabour?.status).toBe(LabourStatus.AT_WORK);
    expect(currentLabour?.isAvailable).toBe(false);

    // 5. While AT_WORK, another client attempting to book this labour MUST be rejected
    let secondBookingThrew = false;
    try {
      await labourBookingService.createMarketplaceBooking(
        {
          labourId: approvedLabour.id,
          workTitle: "Door Lock Repair",
          startDate: new Date(),
          serviceAddress: "Flat 101, Test Road",
          locality: "Kothrud",
          city: "Pune",
          state: "Maharashtra",
          pincode: "411038",
          termsAccepted: true,
        },
        clientUser.id
      );
    } catch (err: any) {
      secondBookingThrew = true;
      expect(err.message).toContain("Labour is already unavailable");
    }
    expect(secondBookingThrew).toBe(true);

    // 6. Labour Worker completes the work -> status transitions back to AVAILABLE
    const completedWork = await labourBookingService.completeWork(
      booking.id,
      { id: registeredLabour.userId!, isPlatformAdmin: false },
      {
        taskChecklist: [{ task: "Wardrobe frame fixed", done: true }],
        proofPhotos: [{ url: "https://cloud.homio.test/proof.jpg" }],
      }
    );
    expect(completedWork.status).toBe("WORK_COMPLETED");

    currentLabour = await prisma.labour.findUnique({ where: { id: approvedLabour.id } });
    expect(currentLabour?.status).toBe(LabourStatus.AVAILABLE);
    expect(currentLabour?.isAvailable).toBe(true);

    // 7. Client confirms completion with 5-star rating
    const confirmed = await labourBookingService.confirmCompletion(
      booking.id,
      clientUser.id,
      {
        rating: 5,
        review: "Excellent precision woodwork and on-time completion!",
      }
    );
    expect(confirmed.status).toBe("COMPLETED");

    currentLabour = await prisma.labour.findUnique({ where: { id: approvedLabour.id } });
    expect(currentLabour?.status).toBe(LabourStatus.AVAILABLE);
    expect(currentLabour?.isAvailable).toBe(true);
    expect(currentLabour?.completedBookingsCount).toBe(1);

    // 8. Now that work is completed and labour is AVAILABLE again, a new booking can be made
    const secondBooking = await labourBookingService.createMarketplaceBooking(
      {
        labourId: approvedLabour.id,
        workTitle: "Study Table Assembly",
        startDate: new Date(),
        serviceAddress: "Flat 502, Lake Vista",
        locality: "Kothrud",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411038",
        termsAccepted: true,
      },
      clientUser.id
    );
    createdBookingIds.push(secondBooking.id);
    expect(secondBooking.status).toBe("REQUESTED");
  });

  it("should update labour status via updateStatus correctly", async () => {
    // Setup test worker
    const workerPhone = `93${Math.floor(10000000 + Math.random() * 90000000)}`;
    const worker = await labourService.registerPublicLabour({
      name: "Dinesh Kumar",
      phone: workerPhone,
      password: "Password123!",
      trade: "Plumbing",
      dailyRate: 900,
      state: "Maharashtra",
      city: "Pune",
    });
    createdLabourIds.push(worker.id);
    if (worker.userId) createdUserIds.push(worker.userId);

    await labourService.approveLabour(worker.id, { id: "admin-1" });

    // Client user
    const clientUser = await prisma.user.create({
      data: {
        firstName: "Rani",
        email: `rani_${Date.now()}_${Math.random()}@example.com`,
        phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
        passwordHash: "$2b$10$hashedpasswordstring",
        userType: UserType.USER,
        status: UserStatus.ACTIVE,
      },
    });
    createdUserIds.push(clientUser.id);

    const booking = await labourBookingService.createMarketplaceBooking(
      {
        labourId: worker.id,
        workTitle: "Pipe Fix",
        startDate: new Date(),
        serviceAddress: "Street 5",
        locality: "Shivaji Nagar",
        city: "Pune",
        state: "Maharashtra",
        termsAccepted: true,
      },
      clientUser.id
    );
    createdBookingIds.push(booking.id);

    // 1. Worker accepts booking
    await labourBookingService.acceptBooking(booking.id, {
      id: worker.userId!,
      userType: "LABOUR",
    });

    // 2. Attempting to start work before quotation has been sent MUST be rejected
    let threwBeforeQuote = false;
    try {
      await labourBookingService.updateStatus(booking.id, "WORK_STARTED", undefined, true);
    } catch (err: any) {
      threwBeforeQuote = true;
      expect(err.message).toContain("Work cannot be started until quotation has been sent");
    }
    expect(threwBeforeQuote).toBe(true);

    // 3. Worker submits quotation
    await labourBookingService.submitQuote(
      booking.id,
      { id: worker.userId!, userType: "LABOUR" },
      {
        quoteAmount: 1800,
        quoteDescription: "Fix leaking pipe and replace broken PVC joints",
      }
    );

    // 4. Attempting to start work before client has accepted MUST be rejected
    let threwBeforeAccept = false;
    try {
      await labourBookingService.updateStatus(booking.id, "WORK_STARTED", undefined, true);
    } catch (err: any) {
      threwBeforeAccept = true;
      expect(err.message).toContain("Work cannot be started until quotation has been accepted");
    }
    expect(threwBeforeAccept).toBe(true);

    // 5. Client accepts quotation -> Work commences and status becomes WORK_STARTED
    await labourBookingService.respondQuote(
      booking.id,
      clientUser.id,
      { accept: true },
      false
    );

    let labour = await prisma.labour.findUnique({ where: { id: worker.id } });
    expect(labour?.status).toBe(LabourStatus.AT_WORK);
    expect(labour?.isAvailable).toBe(false);

    // 6. Platform admin sets status to COMPLETED -> labour becomes AVAILABLE
    await labourBookingService.updateStatus(booking.id, "COMPLETED", undefined, true);
    labour = await prisma.labour.findUnique({ where: { id: worker.id } });
    expect(labour?.status).toBe(LabourStatus.AVAILABLE);
    expect(labour?.isAvailable).toBe(true);
  });
});

import { describe, it, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { LabourBookingService } from "../../src/module/labour/services/labour-booking.service.js";
import { labourBookingRepo } from "../../src/module/labour/repos/labour-booking.repo.js";
import { projectServiceService } from "../../src/module/labour/services/project-service.service.js";
import { projectServiceRepo } from "../../src/module/labour/repos/project-service.repo.js";
import { labourRepo } from "../../src/module/labour/repos/labour.repo.js";
import { prisma } from "../../src/lib/prisma.js";

describe("Labour Booking Service - Task Checklist Guard & Completion Tests", () => {
  const service = new LabourBookingService();
  const validBookingId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const validClientId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const validOrgId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const validServiceId = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";

  describe("Task Checklist Work-Started Lock Guard", () => {
    const lockedStatuses = [
      "WORK_STARTED",
      "IN_PROGRESS",
      "WORK_COMPLETED",
      "COMPLETED",
      "CANCELLED",
      "DISPUTED",
    ];

    for (const status of lockedStatuses) {
      it(`rejects taskChecklist update from client when booking status is ${status}`, async () => {
        spyOn(labourBookingRepo, "findById").mockResolvedValue({
          id: validBookingId,
          status,
          clientId: validClientId,
          organizationId: null,
          taskChecklist: [{ task: "Initial task", done: false }],
        } as any);

        const promise = service.updateBooking(
          validBookingId,
          {
            taskChecklist: [{ task: "New task added by client", done: false }],
          },
          { clientId: validClientId }
        );

        expect(promise).rejects.toThrow(
          /Task checklist cannot be modified once work has started/i
        );
      });
    }

    it("allows taskChecklist update from client when booking status is CONFIRMED (work not started)", async () => {
      spyOn(labourBookingRepo, "findById").mockResolvedValue({
        id: validBookingId,
        status: "CONFIRMED",
        clientId: validClientId,
        organizationId: null,
        taskChecklist: [{ task: "Initial task", done: false }],
      } as any);

      spyOn(labourBookingRepo, "update").mockResolvedValue({
        id: validBookingId,
        status: "CONFIRMED",
        taskChecklist: [
          { task: "Initial task", done: false },
          { task: "Added task", done: false },
        ],
      } as any);

      const updated = await service.updateBooking(
        validBookingId,
        {
          taskChecklist: [
            { task: "Initial task", done: false },
            { task: "Added task", done: false },
          ],
        },
        { clientId: validClientId }
      );

      expect(updated.taskChecklist).toHaveLength(2);
    });
  });

  describe("Platform Admin & Organization Booking Completion", () => {
    it("sets status to COMPLETED and populates completedAt when Platform Admin marks as completed", async () => {
      spyOn(labourBookingRepo, "findById").mockResolvedValue({
        id: validBookingId,
        status: "IN_PROGRESS",
        organizationId: null,
        completedAt: null,
      } as any);

      spyOn(labourBookingRepo, "update").mockImplementation((id: string, data: any) => {
        return Promise.resolve({
          id: validBookingId,
          status: data.status,
          completedAt: data.completedAt,
        } as any);
      });

      const updated = await service.updateStatus(
        validBookingId,
        "COMPLETED",
        undefined,
        true // isPlatformAdmin
      );

      expect(updated.status).toBe("COMPLETED");
      expect(updated.completedAt).toBeDefined();
    });

    it("allows Organization user to mark their labour booking as COMPLETED and recalculates rollup", async () => {
      spyOn(labourBookingRepo, "findById").mockResolvedValue({
        id: validBookingId,
        status: "IN_PROGRESS",
        organizationId: validOrgId,
        projectServiceId: validServiceId,
        completedAt: null,
      } as any);

      spyOn(labourBookingRepo, "update").mockImplementation((id: string, data: any) => {
        return Promise.resolve({
          id: validBookingId,
          status: data.status,
          completedAt: data.completedAt,
        } as any);
      });

      const recalculateSpy = spyOn(projectServiceRepo, "recalculateRollup").mockResolvedValue({} as any);

      const updated = await service.updateStatus(
        validBookingId,
        "COMPLETED",
        validOrgId,
        false
      );

      expect(updated.status).toBe("COMPLETED");
      expect(updated.completedAt).toBeDefined();
      expect(recalculateSpy).toHaveBeenCalledWith(validServiceId);
    });
  });

  describe("Project Service Cascading Completion", () => {
    it("automatically cascades COMPLETED status to all child labour bookings when Project Service is completed", async () => {
      spyOn(projectServiceRepo, "findById").mockResolvedValue({
        id: validServiceId,
        organizationId: validOrgId,
        status: "IN_PROGRESS",
      } as any);

      spyOn(projectServiceRepo, "updateStatus").mockResolvedValue({
        id: validServiceId,
        organizationId: validOrgId,
        status: "COMPLETED",
      } as any);

      const cascadeSpy = spyOn(projectServiceRepo, "cascadeCompleteLabourBookings").mockResolvedValue({ count: 4 } as any);
      const recalculateSpy = spyOn(projectServiceRepo, "recalculateRollup").mockResolvedValue({} as any);

      const result = await projectServiceService.updateServiceStatus(
        validServiceId,
        "COMPLETED",
        validOrgId
      );

      expect(result.status).toBe("COMPLETED");
      expect(cascadeSpy).toHaveBeenCalledWith(validServiceId, validOrgId);
      expect(recalculateSpy).toHaveBeenCalledWith(validServiceId);
    });
  });

  describe("Labour Availability & Ongoing Work Booking Guard", () => {
    const validLabourId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66";
    const validProjectId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77";

    const origUserFindUnique = prisma.user.findUnique;
    const origLabourFindUnique = prisma.labour.findUnique;
    const origBookingFindFirst = prisma.labourBooking.findFirst;

    beforeEach(() => {
      prisma.user.findUnique = (async () => ({
        id: validClientId,
        isBlacklisted: false,
      })) as any;

      prisma.labour.findUnique = (async () => ({
        id: validLabourId,
        isBlacklisted: false,
        isKycVerified: true,
        isAvailable: true,
        status: "ACTIVE",
        dailyRate: 900,
      })) as any;

      prisma.labourBooking.findFirst = (async () => null) as any;
    });

    afterEach(() => {
      prisma.user.findUnique = origUserFindUnique;
      prisma.labour.findUnique = origLabourFindUnique;
      prisma.labourBooking.findFirst = origBookingFindFirst;
    });

    it("throws 'Labour is already unavailable' in createBooking when worker has ongoing booking with WORK_STARTED", async () => {
      spyOn(labourRepo, "findById").mockResolvedValue({
        id: validLabourId,
        organizationId: validOrgId,
        isAvailable: true,
        status: "ACTIVE",
      } as any);

      prisma.labourBooking.findFirst = (async () => ({
        id: validBookingId,
        bookingNumber: "LB-2026-0001",
        status: "WORK_STARTED",
      })) as any;

      const promise = service.createBooking(
        {
          labourId: validLabourId,
          projectId: validProjectId,
          projectServiceId: validServiceId,
          workTitle: "Carpentry installation",
          agreedDailyRate: 950,
          estimatedDays: 2,
        } as any,
        validOrgId
      );

      expect(promise).rejects.toThrow("Labour is already unavailable");
    });

    it("throws 'Labour is already unavailable' in createBooking when worker has ongoing booking with IN_PROGRESS", async () => {
      spyOn(labourRepo, "findById").mockResolvedValue({
        id: validLabourId,
        organizationId: validOrgId,
        isAvailable: true,
        status: "ACTIVE",
      } as any);

      prisma.labourBooking.findFirst = (async () => ({
        id: validBookingId,
        bookingNumber: "LB-2026-0001",
        status: "IN_PROGRESS",
      })) as any;

      const promise = service.createBooking(
        {
          labourId: validLabourId,
          projectId: validProjectId,
          projectServiceId: validServiceId,
          workTitle: "Plumbing work",
          agreedDailyRate: 850,
          estimatedDays: 1,
        } as any,
        validOrgId
      );

      expect(promise).rejects.toThrow("Labour is already unavailable");
    });

    it("throws 'Labour is already unavailable' in createBooking when worker isAvailable is false", async () => {
      spyOn(labourRepo, "findById").mockResolvedValue({
        id: validLabourId,
        organizationId: validOrgId,
        isAvailable: false,
        status: "ACTIVE",
      } as any);

      prisma.labour.findUnique = (async () => ({
        id: validLabourId,
        isAvailable: false,
        status: "ACTIVE",
      })) as any;

      const promise = service.createBooking(
        {
          labourId: validLabourId,
          projectId: validProjectId,
          projectServiceId: validServiceId,
          workTitle: "Painting work",
          agreedDailyRate: 800,
          estimatedDays: 1,
        } as any,
        validOrgId
      );

      expect(promise).rejects.toThrow("Labour is already unavailable");
    });

    it("throws 'Labour is already unavailable' in createMarketplaceBooking when worker has ongoing booking", async () => {
      prisma.labourBooking.findFirst = (async () => ({
        id: validBookingId,
        bookingNumber: "SB-2026-0002",
        status: "WORK_STARTED",
      })) as any;

      const promise = service.createMarketplaceBooking(
        {
          labourId: validLabourId,
          workTitle: "Home Electrical Repair",
          serviceAddress: "123 Main St",
          locality: "Koramangala",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560034",
        } as any,
        validClientId
      );

      expect(promise).rejects.toThrow("Labour is already unavailable");
    });

    it("allows createMarketplaceBooking when worker is available and has no ongoing booking", async () => {
      prisma.labourBooking.findFirst = (async () => null) as any;
      spyOn(labourBookingRepo, "generateBookingNumber").mockResolvedValue("SB-2026-0003");
      spyOn(labourBookingRepo, "create").mockResolvedValue({
        id: "new-booking-uuid",
        bookingNumber: "SB-2026-0003",
        status: "REQUESTED",
      } as any);

      const booking = await service.createMarketplaceBooking(
        {
          labourId: validLabourId,
          workTitle: "Home Painting Work",
          serviceAddress: "123 Main St",
          locality: "Koramangala",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560034",
        } as any,
        validClientId
      );

      expect(booking).toBeDefined();
      expect(booking.bookingNumber).toBe("SB-2026-0003");
      expect(booking.status).toBe("REQUESTED");
    });
  });
});

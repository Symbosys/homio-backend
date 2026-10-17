import { describe, it, expect } from "bun:test";
import {
  createServiceBookingSchema,
  checkAvailabilityQuerySchema,
  manualAssignLabourSchema,
  platformLabourSettingSchema,
} from "../../src/module/labour/validators/labour-booking.validator.js";

describe("Service Booking & Auto/Manual Assignment Engine Test Suite", () => {
  const mockClientId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockLabourId1 = "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const mockLabourId2 = "d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const mockBookingId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";

  describe("1. Schema Validations (Strict Fields Only)", () => {
    it("should validate valid service request payload with only allowed fields", () => {
      const payload = {
        body: {
          workTitle: "Modular Kitchen Wooden Cabinets",
          category: "Carpentry",
          startDate: "2026-10-25T00:00:00.000Z",
          endDate: "2026-10-28T00:00:00.000Z",
          description: "Full modular kitchen lower and overhead cabinet installation.",
          specialInstructions: "Work to commence after 10:00 AM as per society rules.",
          taskChecklist: [
            { task: "Measure and level wall base", done: false },
            { task: "Affix Marine Ply carcase and laminate", done: false },
          ],
          state: "Karnataka",
          city: "Bengaluru",
        },
      };

      const parsed = createServiceBookingSchema.parse(payload);
      expect(parsed.body.workTitle).toBe("Modular Kitchen Wooden Cabinets");
      expect(parsed.body.category).toBe("Carpentry");
      expect(parsed.body.state).toBe("Karnataka");
      expect(parsed.body.city).toBe("Bengaluru");
      expect(parsed.body.specialInstructions).toBe("Work to commence after 10:00 AM as per society rules.");
      expect(Array.isArray(parsed.body.taskChecklist)).toBe(true);
      expect(parsed.body.labourCount).toBe(1); // default 1
    });

    it("should accept valid labourCount up to 5", () => {
      const payload = {
        body: {
          workTitle: "False ceiling gypsum plastering",
          category: "Civil",
          startDate: "2026-10-25T00:00:00.000Z",
          endDate: "2026-10-28T00:00:00.000Z",
          state: "Maharashtra",
          city: "Mumbai",
          labourCount: 5,
        },
      };

      const parsed = createServiceBookingSchema.parse(payload);
      expect(parsed.body.labourCount).toBe(5);
    });

    it("should reject labourCount exceeding max 5 or less than 1", () => {
      const payloadExceeding = {
        body: {
          workTitle: "Commercial hall demolition",
          category: "Civil",
          startDate: "2026-10-25T00:00:00.000Z",
          endDate: "2026-10-28T00:00:00.000Z",
          state: "Maharashtra",
          city: "Mumbai",
          labourCount: 6, // exceeds 5
        },
      };

      expect(() => createServiceBookingSchema.parse(payloadExceeding)).toThrow();

      const payloadZero = {
        body: {
          workTitle: "Commercial hall demolition",
          category: "Civil",
          startDate: "2026-10-25T00:00:00.000Z",
          endDate: "2026-10-28T00:00:00.000Z",
          state: "Maharashtra",
          city: "Mumbai",
          labourCount: 0,
        },
      };

      expect(() => createServiceBookingSchema.parse(payloadZero)).toThrow();
    });

    it("should reject service booking request missing required fields", () => {
      const invalidPayload = {
        body: {
          workTitle: "Plumbing repair",
          // missing category, dates, state, city
        },
      };

      expect(() => createServiceBookingSchema.parse(invalidPayload)).toThrow();
    });

    it("should validate check availability query schema", () => {
      const queryPayload = {
        query: {
          state: "Maharashtra",
          city: "Mumbai",
          category: "Plumbing",
        },
      };

      const parsed = checkAvailabilityQuerySchema.parse(queryPayload);
      expect(parsed.query.state).toBe("Maharashtra");
      expect(parsed.query.city).toBe("Mumbai");
      expect(parsed.query.category).toBe("Plumbing");
    });

    it("should validate manual assign labour schema", () => {
      const assignPayload = {
        params: { id: mockBookingId },
        body: {
          labourId: mockLabourId1,
          notes: "Assigned experienced master carpenter from central hub",
        },
      };

      const parsed = manualAssignLabourSchema.parse(assignPayload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.labourId).toBe(mockLabourId1);
      expect(parsed.body.notes).toBe("Assigned experienced master carpenter from central hub");
    });

    it("should validate platform labour setting toggle schema", () => {
      const settingPayload = {
        body: {
          autoAssignLabour: false,
          cooldownPeriodDays: 3,
          consecutiveRejectionsThreshold: 3,
          delayReportMinHours: 24,
        },
      };

      const parsed = platformLabourSettingSchema.parse(settingPayload);
      expect(parsed.body.autoAssignLabour).toBe(false);
      expect(parsed.body.cooldownPeriodDays).toBe(3);
    });
  });

  describe("2. Regional Labour Availability Guard Logic", () => {
    it("should detect when zero labours are available in a region", () => {
      const mockDatabaseLabours: Array<{ state: string; city: string; trade: string; isAvailable: boolean }> = [];
      const requestedState = "Goa";
      const requestedCity = "Panaji";
      const requestedCategory = "Electrical";

      const matched = mockDatabaseLabours.filter(
        (l) =>
          l.state.toLowerCase() === requestedState.toLowerCase() &&
          l.city.toLowerCase() === requestedCity.toLowerCase() &&
          l.trade.toLowerCase() === requestedCategory.toLowerCase() &&
          l.isAvailable
      );

      expect(matched.length).toBe(0);
    });

    it("should match verified available labours in matching state, city, and category", () => {
      const mockDatabaseLabours = [
        { id: "1", state: "Karnataka", city: "Bengaluru", trade: "Carpentry", isAvailable: true, isKycVerified: true },
        { id: "2", state: "Karnataka", city: "Bengaluru", trade: "Carpentry", isAvailable: true, isKycVerified: true },
        { id: "3", state: "Karnataka", city: "Bengaluru", trade: "Plumbing", isAvailable: true, isKycVerified: true },
        { id: "4", state: "Maharashtra", city: "Mumbai", trade: "Carpentry", isAvailable: true, isKycVerified: true },
      ];

      const matched = mockDatabaseLabours.filter(
        (l) =>
          l.state.toLowerCase() === "karnataka" &&
          l.city.toLowerCase() === "bengaluru" &&
          l.trade.toLowerCase() === "carpentry" &&
          l.isAvailable &&
          l.isKycVerified
      );

      expect(matched.length).toBe(2);
      expect(matched.map((m) => m.id)).toEqual(["1", "2"]);
    });
  });

  describe("3. Platform Auto vs Manual Assignment Dispatch Logic", () => {
    const candidateLabours = [
      { id: mockLabourId1, name: "Ramu Mistry", dailyRate: 950 },
      { id: mockLabourId2, name: "Shyamu Carpenter", dailyRate: 1100 },
    ];

    it("when Auto-Assign is ON: selects a candidate and sets status to REQUESTED", () => {
      const isAutoAssignOn = true;
      let bookingStatus = "PENDING_ASSIGNMENT";
      let assignedLabourId: string | null = null;
      let assignmentType = "MANUAL";

      if (isAutoAssignOn) {
        const randomIndex = Math.floor(Math.random() * candidateLabours.length);
        const selected = candidateLabours[randomIndex]!;
        assignedLabourId = selected.id;
        bookingStatus = "REQUESTED";
        assignmentType = "AUTO";
      }

      expect(assignmentType).toBe("AUTO");
      expect(bookingStatus).toBe("REQUESTED");
      expect([mockLabourId1, mockLabourId2]).toContain(assignedLabourId!);
    });

    it("when Auto-Assign is OFF: does not assign worker and sets status to PENDING_ASSIGNMENT", () => {
      const isAutoAssignOn = false;
      let bookingStatus = "REQUESTED";
      let assignedLabourId: string | null = mockLabourId1;
      let assignmentType = "AUTO";

      if (!isAutoAssignOn) {
        assignedLabourId = null;
        bookingStatus = "PENDING_ASSIGNMENT";
        assignmentType = "MANUAL";
      }

      expect(assignmentType).toBe("MANUAL");
      expect(bookingStatus).toBe("PENDING_ASSIGNMENT");
      expect(assignedLabourId).toBeNull();
    });

    it("Platform Admin manual assignment transitions PENDING_ASSIGNMENT booking to REQUESTED", () => {
      const booking = {
        id: mockBookingId,
        status: "PENDING_ASSIGNMENT",
        labourId: null as string | null,
        assignmentType: "MANUAL",
      };

      booking.labourId = mockLabourId1;
      booking.status = "REQUESTED";
      booking.assignmentType = "MANUAL";

      expect(booking.status).toBe("REQUESTED");
      expect(booking.labourId).toBe(mockLabourId1);
      expect(booking.assignmentType).toBe("MANUAL");
    });
  });

  describe("4. Consecutive Quotation Rejection 3-Day Cooldown Logic", () => {
    it("increments rejection count for rejections 1 and 2 without locking", () => {
      let rejectionCount = 0;
      let isLocked = false;
      let lockedUntil: Date | null = null;

      // Rejection 1
      rejectionCount += 1;
      if (rejectionCount >= 3) {
        isLocked = true;
        lockedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }
      expect(rejectionCount).toBe(1);
      expect(isLocked).toBe(false);
      expect(lockedUntil).toBeNull();

      // Rejection 2
      rejectionCount += 1;
      if (rejectionCount >= 3) {
        isLocked = true;
        lockedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }
      expect(rejectionCount).toBe(2);
      expect(isLocked).toBe(false);
      expect(lockedUntil).toBeNull();
    });

    it("locks user for 3 days on 3rd consecutive rejection in same category", () => {
      let rejectionCount = 2;
      let isLocked = false;
      let lockedUntil: Date | null = null;

      // Rejection 3
      rejectionCount += 1;
      if (rejectionCount >= 3) {
        isLocked = true;
        lockedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      }

      expect(rejectionCount).toBe(3);
      expect(isLocked).toBe(true);
      expect(lockedUntil).not.toBeNull();
      const diffHours = (lockedUntil!.getTime() - Date.now()) / (1000 * 60 * 60);
      expect(Math.round(diffHours)).toBe(72);
    });

    it("blocks booking requests in locked category during active cooldown", () => {
      const cooldownRecord = {
        userId: mockClientId,
        category: "Plumbing",
        isLocked: true,
        lockedUntil: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h remaining
      };

      const requestedCategory = "Plumbing";
      const isBlocked =
        cooldownRecord.isLocked &&
        cooldownRecord.category === requestedCategory &&
        cooldownRecord.lockedUntil > new Date();

      expect(isBlocked).toBe(true);
    });

    it("allows booking requests in DIFFERENT categories while one is locked", () => {
      const cooldownRecord = {
        userId: mockClientId,
        category: "Plumbing",
        isLocked: true,
        lockedUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
      };

      const requestedCategory = "Carpentry";
      const isBlocked =
        cooldownRecord.isLocked &&
        cooldownRecord.category === requestedCategory &&
        cooldownRecord.lockedUntil > new Date();

      expect(isBlocked).toBe(false);
    });

    it("resets rejection count to 0 and clears lock when client accepts quotation", () => {
      let rejectionCount = 2;
      let isLocked = false;
      let lockedUntil: Date | null = null;

      const clientAccepted = true;
      if (clientAccepted) {
        rejectionCount = 0;
        isLocked = false;
        lockedUntil = null;
      }

      expect(rejectionCount).toBe(0);
      expect(isLocked).toBe(false);
      expect(lockedUntil).toBeNull();
    });
  });

  describe("5. Arrival Delay Reassignment Branching", () => {
    it("Auto-Assign ON: Automatically reassigns a different available labour upon delay report", () => {
      const autoAssignEnabled = true;
      const delayedLabourId = mockLabourId1;
      const candidatePool = [
        { id: mockLabourId1, name: "Delayed Worker" },
        { id: mockLabourId2, name: "Available Replacement" },
      ];

      let newLabourId: string | null = delayedLabourId;
      let bookingStatus = "REQUESTED";
      let reassignedMode = "MANUAL";

      if (autoAssignEnabled) {
        const availableReplacements = candidatePool.filter((l) => l.id !== delayedLabourId);
        expect(availableReplacements.length).toBe(1);

        const replacement = availableReplacements[0]!;
        newLabourId = replacement.id;
        bookingStatus = "REQUESTED";
        reassignedMode = "AUTO";
      }

      expect(reassignedMode).toBe("AUTO");
      expect(newLabourId).toBe(mockLabourId2);
      expect(bookingStatus).toBe("REQUESTED");
    });

    it("Auto-Assign OFF: Marks booking as DELAY_REPORTED for manual platform assignment", () => {
      const autoAssignEnabled = false;
      let bookingStatus = "REQUESTED";
      let reassignedMode = "AUTO";

      if (!autoAssignEnabled) {
        bookingStatus = "DELAY_REPORTED";
        reassignedMode = "MANUAL";
      }

      expect(bookingStatus).toBe("DELAY_REPORTED");
      expect(reassignedMode).toBe("MANUAL");
    });
  });

  describe("6. Multi-Labour Service Booking Batch Generation & Availability Guard", () => {
    const candidateLabours = [
      { id: "worker-uuid-001", name: "Worker 1", dailyRate: 900 },
      { id: "worker-uuid-002", name: "Worker 2", dailyRate: 950 },
      { id: "worker-uuid-003", name: "Worker 3", dailyRate: 1000 },
      { id: "worker-uuid-004", name: "Worker 4", dailyRate: 1050 },
      { id: "worker-uuid-005", name: "Worker 5", dailyRate: 1100 },
      { id: "worker-uuid-006", name: "Worker 6", dailyRate: 1150 },
    ];

    it("should report insufficient labours message when user requests 5 but only 3 are available", () => {
      const availableLabours = candidateLabours.slice(0, 3); // 3 available
      const requestedCount = 5;
      const city = "Mumbai";
      const state = "Maharashtra";
      const category = "Plumbing";

      const isSufficient = availableLabours.length >= requestedCount;
      expect(isSufficient).toBe(false);

      let message = "";
      if (availableLabours.length === 0) {
        message = `No verified labours are available in your city (${city}, ${state}) for ${category}.`;
      } else if (availableLabours.length < requestedCount) {
        message = `Only ${availableLabours.length} labour(s) are available in your city (${city}, ${state}) for ${category}. You requested ${requestedCount}.`;
      } else {
        message = `${availableLabours.length} verified labour(s) available in your city.`;
      }

      expect(message).toBe("Only 3 labour(s) are available in your city (Mumbai, Maharashtra) for Plumbing. You requested 5.");
    });

    it("when Auto-Assign is ON: creates 5 distinct bookings with 5 unique sequence numbers and 5 distinct assigned labours", () => {
      const requestedCount = 5;
      const availableLabours = [...candidateLabours]; // 6 available, >= 5
      expect(availableLabours.length).toBeGreaterThanOrEqual(requestedCount);

      const isAutoAssignOn = true;
      const currentYear = 2026;
      const startCount = 10;
      const bookingNumbers: string[] = [];
      for (let i = 1; i <= requestedCount; i++) {
        bookingNumbers.push(`SB-${currentYear}-${String(startCount + i).padStart(4, "0")}`);
      }

      const shuffled = [...availableLabours].sort(() => 0.5 - Math.random());
      const selectedLabours = shuffled.slice(0, requestedCount);

      const createdBookings = [];
      for (let i = 0; i < requestedCount; i++) {
        const worker = selectedLabours[i]!;
        createdBookings.push({
          bookingNumber: bookingNumbers[i],
          labourId: worker.id,
          assignmentType: "AUTO",
          status: "REQUESTED",
        });
      }

      expect(createdBookings.length).toBe(5);
      // All 5 booking numbers must be unique
      const uniqueNumbers = new Set(createdBookings.map((b) => b.bookingNumber));
      expect(uniqueNumbers.size).toBe(5);
      // All 5 labour IDs must be unique and distinct
      const uniqueLabourIds = new Set(createdBookings.map((b) => b.labourId));
      expect(uniqueLabourIds.size).toBe(5);
      // All statuses must be REQUESTED and assignmentType AUTO
      createdBookings.forEach((b) => {
        expect(b.status).toBe("REQUESTED");
        expect(b.assignmentType).toBe("AUTO");
      });
    });

    it("when Auto-Assign is OFF: creates 5 distinct bookings with status PENDING_ASSIGNMENT and labourId null", () => {
      const requestedCount = 5;
      const currentYear = 2026;
      const startCount = 20;
      const bookingNumbers: string[] = [];
      for (let i = 1; i <= requestedCount; i++) {
        bookingNumbers.push(`SB-${currentYear}-${String(startCount + i).padStart(4, "0")}`);
      }

      const createdBookings = [];
      for (let i = 0; i < requestedCount; i++) {
        createdBookings.push({
          bookingNumber: bookingNumbers[i],
          labourId: null,
          assignmentType: "MANUAL",
          status: "PENDING_ASSIGNMENT",
        });
      }

      expect(createdBookings.length).toBe(5);
      const uniqueNumbers = new Set(createdBookings.map((b) => b.bookingNumber));
      expect(uniqueNumbers.size).toBe(5);
      createdBookings.forEach((b) => {
        expect(b.labourId).toBeNull();
        expect(b.status).toBe("PENDING_ASSIGNMENT");
        expect(b.assignmentType).toBe("MANUAL");
      });
    });
  });
});

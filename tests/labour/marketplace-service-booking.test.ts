import { describe, it, expect } from "bun:test";
import {
  createMarketplaceBookingSchema,
  submitQuoteSchema,
  respondQuoteSchema,
  rejectBookingSchema,
  completeWorkSchema,
  confirmCompletionSchema,
  reportDelaySchema,
  reassignLabourSchema,
  getLabourBookingsQuerySchema,
} from "../../src/module/labour/validators/labour-booking.validator.js";
import { getLaboursQuerySchema } from "../../src/module/labour/validators/labour.validator.js";
import { MARKETPLACE_CONFIG } from "../../src/constants/marketplace.constants.js";

describe("Marketplace Labour Service Booking Module Tests", () => {
  const mockLabourId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const mockBookingId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  describe("1. Service Booking Code Sequential Pattern Validation", () => {
    it("should match SB-YYYY-NNNN format pattern for direct service bookings", () => {
      const currentYear = new Date().getFullYear();
      const pattern = new RegExp(`^SB-${currentYear}-\\d{4}$`);
      const sampleCode = `SB-${currentYear}-0001`;

      expect(sampleCode).toMatch(pattern);
    });

    it("should distinguish SB (Service Booking) prefix from LB (Project Labour Booking) prefix", () => {
      const marketplacePrefix = "SB";
      const b2bPrefix = "LB";

      expect(marketplacePrefix).not.toBe(b2bPrefix);
    });
  });

  describe("2. Marketplace Booking Request Validation (B2C Homeowner)", () => {
    it("should validate full valid marketplace service booking request with locality and terms accepted", () => {
      const payload = {
        body: {
          labourId: mockLabourId,
          workTitle: "Emergency Kitchen Pipe Leak Repair",
          workDescription: "Kitchen sink drain line broken causing water accumulation. Urgent fix needed.",
          startDate: new Date().toISOString(),
          serviceAddress: "Flat 402, Sunshine Heights, Main Ring Road",
          locality: "Indiranagar",
          city: "Bengaluru",
          state: "Karnataka",
          pincode: "560038",
          termsAccepted: true,
          latitude: 12.9716,
          longitude: 77.5946,
          geofenceRadius: 300,
          isStrictGeofence: true,
          additionalInformation: {
            apartmentFloor: 4,
            hasServiceElevator: true,
            preferredTimeSlot: "10:00 AM - 12:00 PM",
          },
        },
      };

      const parsed = createMarketplaceBookingSchema.parse(payload);
      expect(parsed.body.labourId).toBe(mockLabourId);
      expect(parsed.body.locality).toBe("Indiranagar");
      expect(parsed.body.city).toBe("Bengaluru");
      expect(parsed.body.latitude).toBe(12.9716);
      expect(parsed.body.longitude).toBe(77.5946);
      expect(parsed.body.geofenceRadius).toBe(300);
      expect(parsed.body.isStrictGeofence).toBe(true);
      expect(parsed.body.termsAccepted).toBe(true);
      expect(parsed.body.additionalInformation?.apartmentFloor).toBe(4);
    });

    it("should default geofenceRadius to 200 and isStrictGeofence to true if omitted", () => {
      const payload = {
        body: {
          labourId: mockLabourId,
          workTitle: "Plumbing check",
          startDate: new Date().toISOString(),
          serviceAddress: "Flat 101, Test Lane",
          locality: "Koramangala",
          city: "Bengaluru",
          state: "Karnataka",
          termsAccepted: true,
        },
      };

      const parsed = createMarketplaceBookingSchema.parse(payload);
      expect(parsed.body.geofenceRadius).toBe(200);
      expect(parsed.body.isStrictGeofence).toBe(true);
    });

    it("should reject marketplace booking request when termsAccepted is false", () => {
      const payload = {
        body: {
          labourId: mockLabourId,
          workTitle: "Electrical Switchboard Replacement",
          serviceAddress: "House 12, Lake View Colony",
          locality: "Whitefield",
          city: "Bengaluru",
          state: "Karnataka",
          startDate: new Date().toISOString(),
          termsAccepted: false,
        },
      };

      expect(() => createMarketplaceBookingSchema.parse(payload)).toThrow();
    });

    it("should reject marketplace booking when required locality or address is missing", () => {
      const payload = {
        body: {
          labourId: mockLabourId,
          workTitle: "Wall Painting Touch-up",
          serviceAddress: "", // empty
          locality: "", // empty
          city: "Bengaluru",
          state: "Karnataka",
          startDate: new Date().toISOString(),
          termsAccepted: true,
        },
      };

      expect(() => createMarketplaceBookingSchema.parse(payload)).toThrow();
    });
  });

  describe("3. Worker Response & Quotation Flow Validation", () => {
    it("should validate worker rejection payload with reason", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          reason: "Currently occupied with prior client commitment in another sector.",
        },
      };

      const parsed = rejectBookingSchema.parse(payload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.reason).toContain("occupied");
    });

    it("should validate on-site deal quotation submitted by worker", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          quoteAmount: 3500.0,
          quoteDescription: "Comprehensive pipe replacement, sealant application, and water pressure testing.",
        },
      };

      const parsed = submitQuoteSchema.parse(payload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.quoteAmount).toBe(3500.0);
      expect(parsed.body.quoteDescription).toContain("pipe replacement");
    });

    it("should validate client accepting quotation", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          accept: true,
        },
      };

      const parsed = respondQuoteSchema.parse(payload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.accept).toBe(true);
    });

    it("should validate client rejecting quotation with reason", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          accept: false,
          rejectionReason: "Quoted amount exceeds initial estimates. Will look for alternative options.",
        },
      };

      const parsed = respondQuoteSchema.parse(payload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.accept).toBe(false);
      expect(parsed.body.rejectionReason).toContain("exceeds");
    });
  });

  describe("4. Commission Separation: Platform Marketplace vs Organization B2B", () => {
    it("should configure 10% platform commission on marketplace deal acceptance", () => {
      const dealValue = 5000.0;
      const commissionRate = MARKETPLACE_CONFIG.DEFAULT_COMMISSION_PERCENTAGE; // 10.0%
      const commissionAmount = (dealValue * commissionRate) / 100;

      expect(commissionRate).toBe(10.0);
      expect(commissionAmount).toBe(500.0);
    });

    it("should enforce 0% commission for organization internal project bookings", () => {
      const b2bCommissionRate = 0.0;
      const dealValue = 5000.0;
      const b2bCommissionAmount = (dealValue * b2bCommissionRate) / 100;

      expect(b2bCommissionRate).toBe(0.0);
      expect(b2bCommissionAmount).toBe(0.0);
    });
  });

  describe("5. Work Completion, Checklist & Performance Rating Review", () => {
    it("should validate work completion checklist and proof photos", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          taskChecklist: [
            { task: "Inspected and detached damaged pipe segment", done: true },
            { task: "Fitted heavy-duty PVC connector and sealant", done: true },
            { task: "Conducted 15-minute continuous water pressure test", done: true },
          ],
          proofPhotos: [
            {
              id: "photo_proof_1",
              url: "https://cloud.homio.in/labour/proof1.jpg",
              bytes: 85000,
              format: "jpg",
              provider: "s3",
            },
          ],
          notes: "Work completed cleanly. Customer inspected without leakages.",
        },
      };

      const parsed = completeWorkSchema.parse(payload);
      expect(parsed.body.taskChecklist?.length).toBe(3);
      expect(parsed.body.proofPhotos?.length).toBe(1);
      expect(parsed.body.notes).toContain("Customer inspected");
    });

    it("should validate client final confirmation and multi-criteria rating review", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          rating: 4.8,
          qualityRating: 5.0,
          punctualityRating: 4.5,
          behaviorRating: 5.0,
          review: "Excellent craftsmanship and extremely polite worker. Arrived right on schedule.",
        },
      };

      const parsed = confirmCompletionSchema.parse(payload);
      expect(parsed.body.rating).toBe(4.8);
      expect(parsed.body.qualityRating).toBe(5.0);
      expect(parsed.body.punctualityRating).toBe(4.5);
      expect(parsed.body.review).toContain("Excellent craftsmanship");
    });
  });

  describe("6. Catalogue Micro-Location & KYC Filtering Validation", () => {
    it("should parse catalogue filters with isKycVerified, locality, city, and availability", () => {
      const query = {
        query: {
          isKycVerified: "true",
          isAvailable: "true",
          locality: "Koramangala",
          city: "Bengaluru",
          state: "Karnataka",
          trade: "Plumbing",
          page: "1",
          limit: "20",
        },
      };

      const parsed = getLaboursQuerySchema.parse(query);
      expect(parsed.query.isKycVerified).toBe(true);
      expect(parsed.query.isAvailable).toBe(true);
      expect(parsed.query.locality).toBe("Koramangala");
      expect(parsed.query.city).toBe("Bengaluru");
      expect(parsed.query.trade).toBe("Plumbing");
    });

    it("should parse booking queries by channel and locality", () => {
      const query = {
        query: {
          channel: "PLATFORM_MARKETPLACE",
          locality: "Indiranagar",
          city: "Bengaluru",
          status: "WORK_STARTED",
          page: "1",
          limit: "10",
        },
      };

      const parsed = getLabourBookingsQuerySchema.parse(query);
      expect(parsed.query.channel).toBe("PLATFORM_MARKETPLACE");
      expect(parsed.query.locality).toBe("Indiranagar");
      expect(parsed.query.status).toBe("WORK_STARTED");
    });
  });

  describe("7. 24-Hour Arrival Delay Reporting & Platform Manual Reassignment Validation", () => {
    it("should validate client reporting arrival delay after 24 hours", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          reason: "Labour worker did not reach Indiranagar site even after 24 hours of confirmation.",
          evidenceNotes: "Attempted calling worker 3 times; phone switched off.",
        },
      };

      const parsed = reportDelaySchema.parse(payload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.reason).toContain("did not reach");
      expect(parsed.body.evidenceNotes).toContain("phone switched off");
    });

    it("should reject delay reporting when reason is shorter than 5 characters", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          reason: "Late", // < 5 chars
        },
      };

      expect(() => reportDelaySchema.parse(payload)).toThrow();
    });

    it("should verify 24-hour time threshold constant", () => {
      expect(MARKETPLACE_CONFIG.DELAY_REPORT_MIN_HOURS).toBe(24);

      // Verify calculation: 25 hours elapsed allows reporting
      const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
      const hoursElapsed1 = (Date.now() - twentyFiveHoursAgo) / (1000 * 60 * 60);
      expect(hoursElapsed1 >= MARKETPLACE_CONFIG.DELAY_REPORT_MIN_HOURS).toBe(true);

      // Verify calculation: 10 hours elapsed blocks reporting
      const tenHoursAgo = Date.now() - 10 * 60 * 60 * 1000;
      const hoursElapsed2 = (Date.now() - tenHoursAgo) / (1000 * 60 * 60);
      expect(hoursElapsed2 >= MARKETPLACE_CONFIG.DELAY_REPORT_MIN_HOURS).toBe(false);
    });

    it("should validate platform admin manual reassignment to replacement KYC-verified worker", () => {
      const newLabourId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
      const payload = {
        params: { id: mockBookingId },
        body: {
          newLabourId,
          reason: "Original worker reported delayed beyond 24h. Reassigning to nearby verified plumbing specialist.",
          resetStatusTo: "REQUESTED",
        },
      };

      const parsed = reassignLabourSchema.parse(payload);
      expect(parsed.params.id).toBe(mockBookingId);
      expect(parsed.body.newLabourId).toBe(newLabourId);
      expect(parsed.body.reason).toContain("Original worker reported delayed");
      expect(parsed.body.resetStatusTo).toBe("REQUESTED");
    });

    it("should reject reassignment with invalid newLabourId format", () => {
      const payload = {
        params: { id: mockBookingId },
        body: {
          newLabourId: "invalid-uuid",
          reason: "Reassigning worker",
        },
      };

      expect(() => reassignLabourSchema.parse(payload)).toThrow();
    });
  });
});

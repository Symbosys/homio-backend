import { describe, it, expect } from "bun:test";
import {
  createLabourRatingSchema,
  updateLabourRatingSchema,
  getLabourRatingsQuerySchema,
} from "../../src/module/labour/validators/labour-rating.validator.js";
import {
  MOCK_LABOUR_ID_1,
  MOCK_BOOKING_ID_1,
  MOCK_RATING_ID_1,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - Rating & Performance Review Tests", () => {
  describe("1. Rating Submission Validation", () => {
    it("should validate full rating payload with multi-dimensional scores", () => {
      const payload = {
        body: {
          bookingId: MOCK_BOOKING_ID_1,
          labourId: MOCK_LABOUR_ID_1,
          reviewerName: "Amit Verma (Site Supervisor)",
          reviewerRole: "SUPERVISOR" as const,
          rating: 4.8,
          qualityScore: 5.0,
          punctualityScore: 4.5,
          behaviourScore: 5.0,
          reviewNotes: "Flawless false ceiling alignment and clean site housekeeping.",
          additionalInformation: {
            recommendedForFutureProjects: true,
          },
        },
      };

      const parsed = createLabourRatingSchema.parse(payload);
      expect(parsed.body.rating).toBe(4.8);
      expect(parsed.body.qualityScore).toBe(5.0);
      expect(parsed.body.reviewerRole).toBe("SUPERVISOR");
      expect(parsed.body.additionalInformation?.recommendedForFutureProjects).toBe(true);
    });

    it("should reject scores outside 1.0 to 5.0 range", () => {
      expect(() =>
        createLabourRatingSchema.parse({
          body: {
            bookingId: MOCK_BOOKING_ID_1,
            labourId: MOCK_LABOUR_ID_1,
            reviewerName: "Client",
            rating: 5.5, // Exceeds max 5.0
          },
        })
      ).toThrow();

      expect(() =>
        createLabourRatingSchema.parse({
          body: {
            bookingId: MOCK_BOOKING_ID_1,
            labourId: MOCK_LABOUR_ID_1,
            reviewerName: "Client",
            rating: 0.5, // Below min 1.0
          },
        })
      ).toThrow();
    });
  });

  describe("2. Symmetric Full Editability Validation (Rule 19)", () => {
    it("should allow editing reviewer notes and adjusted scores", () => {
      const updatePayload = {
        params: { id: MOCK_RATING_ID_1 },
        body: {
          rating: 4.9,
          reviewNotes: "Updated: Client also personally praised the work.",
        },
      };

      const parsed = updateLabourRatingSchema.parse(updatePayload);
      expect(parsed.body.rating).toBe(4.9);
      expect(parsed.body.reviewNotes).toContain("Client also personally praised");
    });
  });

  describe("3. Query Filtering Validation", () => {
    it("should parse minRating and reviewerRole filters", () => {
      const parsed = getLabourRatingsQuerySchema.parse({
        query: {
          labourId: MOCK_LABOUR_ID_1,
          reviewerRole: "SUPERVISOR",
          minRating: "4",
        },
      });

      expect(parsed.query.reviewerRole).toBe("SUPERVISOR");
      expect(parsed.query.minRating).toBe(4);
    });
  });
});

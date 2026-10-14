import { describe, it, expect } from "bun:test";
import {
  evaluateRoomPlacement,
  calculateDocumentedScore,
  calculatePanchaTattva,
  normalizeDirectionCode,
  getZoneDefinition,
} from "../../src/lib/langchain/chains/vastu-rules.js";
import { VastuAuditChain } from "../../src/lib/langchain/chains/vastu-audit.chain.js";

describe("9-Zone Vedic Vastu Reference Engine & Validation Logic", () => {
  describe("1. Source of Truth Evaluation Rules", () => {
    it("Toilet in North-West (NW) is explicitly permitted and COMPLIANT (OPTIMAL)", () => {
      const result = evaluateRoomPlacement("Common Toilet & Powder Room", "North-West");

      expect(result.status).toBe("OPTIMAL");
      expect(result.complianceScore).toBeGreaterThanOrEqual(90);
      expect(result.doshaSeverity).toBe("NONE");
      expect(result.observations).toContain("auspicious, explicitly compliant");
    });

    it("Bedroom / Master Bedroom in North (N) is strictly avoided and marked as DEFECT", () => {
      const result = evaluateRoomPlacement("Master Bedroom 4.0 x 3.6", "North");

      expect(result.status).toBe("DEFECT");
      expect(result.complianceScore).toBeLessThanOrEqual(45);
      expect(result.doshaSeverity).toBe("CRITICAL");
      expect(result.observations).toContain("strictly advises avoiding bedrooms in the North");
    });

    it("Kitchen in North-East (NE) is strictly avoided and marked as DEFECT (Agni-Jala conflict)", () => {
      const kitchenNE = evaluateRoomPlacement("Kitchen Stove", "NE");
      expect(kitchenNE.status).toBe("DEFECT");
      expect(kitchenNE.doshaSeverity).toBe("CRITICAL");
      expect(kitchenNE.complianceScore).toBe(30);
      expect(kitchenNE.observations).toContain("Agni-Jala");
    });

    it("Puja Room in South-West (SW) is strictly avoided and marked as DEFECT", () => {
      const pujaSW = evaluateRoomPlacement("Puja Room 3.6 x 3.0", "South-West");
      expect(pujaSW.status).toBe("DEFECT");
      expect(pujaSW.doshaSeverity).toBe("CRITICAL");
      expect(pujaSW.complianceScore).toBe(25);
      expect(pujaSW.observations).toContain("Nairuthi");
    });

    it("Store Room in South-West (SW) is recognized as COMPLIANT (OPTIMAL)", () => {
      const storeSW = evaluateRoomPlacement("Store Room 2.8 x 2.4", "South-West");

      expect(storeSW.status).toBe("OPTIMAL");
      expect(storeSW.complianceScore).toBeGreaterThanOrEqual(90);
      expect(storeSW.doshaSeverity).toBe("NONE");
    });

    it("Master Bedroom in South-West (SW) is recognized as COMPLIANT (OPTIMAL)", () => {
      const masterSW = evaluateRoomPlacement("Master Bedroom Suite", "South-West");

      expect(masterSW.status).toBe("OPTIMAL");
      expect(masterSW.complianceScore).toBeGreaterThanOrEqual(90);
      expect(masterSW.doshaSeverity).toBe("NONE");
    });

    it("Dining Room in East (E) is recognized as COMPLIANT (OPTIMAL)", () => {
      const diningE = evaluateRoomPlacement("Dining Room 4.0 x 3.2", "East");

      expect(diningE.status).toBe("OPTIMAL");
      expect(diningE.complianceScore).toBeGreaterThanOrEqual(90);
      expect(diningE.doshaSeverity).toBe("NONE");
    });
  });

  describe("2. Documented Scoring Formula & Pancha Tattva Calculations", () => {
    it("Rule 6: Calculates consistent weighted score from actual room placements", () => {
      const evaluations = [
        evaluateRoomPlacement("Pooja Room", "North-East"), // 92 * 1.5 = 138
        evaluateRoomPlacement("Master Bedroom", "South-West"), // 92 * 1.4 = 128.8
        evaluateRoomPlacement("Kitchen", "South-East"), // 92 * 1.3 = 119.6
        evaluateRoomPlacement("Toilet", "North-West"), // 92 * 1.0 = 92
        evaluateRoomPlacement("Living Room", "East"), // 92 * 1.0 = 92
      ];

      const score = calculateDocumentedScore(evaluations);
      expect(score).toBeGreaterThanOrEqual(90);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("Rule 7: Generates Pancha Tattva percentages only via validated calculation method", () => {
      const zoneMap = new Map<string, number>();
      zoneMap.set("NE", 95);
      zoneMap.set("N", 85);
      zoneMap.set("NW", 92);
      zoneMap.set("E", 75);
      zoneMap.set("SE", 90);
      zoneMap.set("S", 80);
      zoneMap.set("SW", 95);
      zoneMap.set("Center", 85);
      zoneMap.set("W", 80);

      const elements = calculatePanchaTattva(zoneMap);
      expect(elements).toBeDefined();
      if (elements) {
        expect(elements.water).toBe(Math.round(95 * 0.6 + 85 * 0.4)); // 57 + 34 = 91
        expect(elements.earth).toBe(95);
        expect(elements.air).toBe(Math.round(92 * 0.6 + 75 * 0.4)); // 55.2 + 30 = 85
        expect(elements.fire).toBe(Math.round(90 * 0.7 + 80 * 0.3)); // 63 + 24 = 87
        expect(elements.space).toBe(Math.round(85 * 0.7 + 80 * 0.3)); // 59.5 + 24 = 84
      }
    });
  });

  describe("3. Cross-Consistency & Normalization Guardrail", () => {
    it("Ensures layout with critical defects (Master Bed in N, Kitchen in NE, Puja in SW) reflects accurate defects and score", () => {
      const layoutData = {
        isFloorPlanDetected: true,
        imageDetectionConfidence: 0.98,
        overallScore: 58,
        summary: "Vastu spatial audit",
        keyStrengths: [],
        criticalDoshas: [],
        zoneBreakdown: [
          {
            zone: "North-West (NW)",
            direction: "North-West",
            currentStatus: "Toilet",
          },
          {
            zone: "North (N)",
            direction: "North",
            currentStatus: "Master Bedroom",
          },
          {
            zone: "North-East (NE)",
            direction: "North-East",
            currentStatus: "Kitchen",
          },
          {
            zone: "West (W)",
            direction: "West",
            currentStatus: "Staircase / Store Room",
          },
          {
            zone: "Center",
            direction: "Center",
            currentStatus: "Living Room",
          },
          {
            zone: "East (E)",
            direction: "East",
            currentStatus: "Dining Room",
          },
          {
            zone: "South-West (SW)",
            direction: "South-West",
            currentStatus: "Puja Room",
          },
          {
            zone: "South (S)",
            direction: "South",
            currentStatus: "Children's Bedroom",
          },
          {
            zone: "South-East (SE)",
            direction: "South-East",
            currentStatus: "Guest Bedroom",
          },
        ],
        remedialSolutions: [],
      };

      const normalized = VastuAuditChain.validateAndNormalizeAuditOutput(layoutData, "East");

      // 1. Toilet in NW is OPTIMAL (Compliant)
      const nwZone = normalized.zoneBreakdown.find((z) => z.direction === "North-West");
      expect(nwZone?.status).toBe("OPTIMAL");

      // 2. Master Bedroom in North is DEFECT (Non-Compliant)
      const nZone = normalized.zoneBreakdown.find((z) => z.direction === "North");
      expect(nZone?.status).toBe("DEFECT");

      // 3. Kitchen in NE is DEFECT (Non-Compliant)
      const neZone = normalized.zoneBreakdown.find((z) => z.direction === "North-East");
      expect(neZone?.status).toBe("DEFECT");

      // 4. Puja in SW is DEFECT (Non-Compliant)
      const swZone = normalized.zoneBreakdown.find((z) => z.direction === "South-West");
      expect(swZone?.status).toBe("DEFECT");

      // 5. Store / Staircase in W is OPTIMAL (Compliant)
      const wZone = normalized.zoneBreakdown.find((z) => z.direction === "West");
      expect(wZone?.status).toBe("OPTIMAL");

      // 6. Confirmed critical doshas list is populated
      expect(normalized.criticalDoshas.length).toBeGreaterThanOrEqual(3);

      // 7. Overall score reflects non-compliances (not 80+ or 90+)
      expect(normalized.overallScore).toBeLessThan(75);

      // 8. Summary clearly states compliant and non-compliant counts
      expect(normalized.summary).toContain("compliant (optimal)");
      expect(normalized.summary).toContain("non-compliant");
    });

    it("Non-floor-plan images distinguish imageDetectionConfidence from score (score 0)", () => {
      const nonPlan = {
        isFloorPlanDetected: false,
        imageDetectionConfidence: 0.05,
        overallScore: 0,
      };

      const result = VastuAuditChain.validateAndNormalizeAuditOutput(nonPlan, "North");
      expect(result.isFloorPlanDetected).toBe(false);
      expect(result.overallScore).toBe(0);
      expect(result.imageDetectionConfidence).toBe(0.05);
      expect(result.criticalDoshas.length).toBe(1);
      expect(result.elementalBalance).toBeUndefined();
    });
  });
});

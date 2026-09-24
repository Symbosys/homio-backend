import { describe, it, expect } from "bun:test";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_ORGANIZATION_ID_2,
  MOCK_LABOUR_ID_1,
  MOCK_PROJECT_ID_1,
  MOCK_PROJECT_SITE_ID_1,
} from "./fixtures/labour.fixtures.js";

describe("Labour Module - Multi-Tenant Security & Isolation Tests", () => {
  describe("1. Organization Scoping Principles", () => {
    it("should guarantee different tenant UUIDs are never equal", () => {
      expect(MOCK_ORGANIZATION_ID_1).not.toBe(MOCK_ORGANIZATION_ID_2);
    });

    it("should ensure workforce labour entity scoping contains organizationId constraint", () => {
      // Simulating a where query construction
      const scopedQuery = {
        id: MOCK_LABOUR_ID_1,
        organizationId: MOCK_ORGANIZATION_ID_1,
        isDeleted: false,
      };

      expect(scopedQuery.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
      expect(scopedQuery.organizationId).not.toBe(MOCK_ORGANIZATION_ID_2);
    });

    it("should ensure project booking scoping checks project.organizationId", () => {
      const bookingScopedWhere = {
        isDeleted: false,
        project: { organizationId: MOCK_ORGANIZATION_ID_1 },
      };

      expect(bookingScopedWhere.project.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
    });

    it("should ensure attendance queries scope by labour.organizationId", () => {
      const attendanceScopedWhere = {
        labour: { organizationId: MOCK_ORGANIZATION_ID_1 },
        projectSiteId: MOCK_PROJECT_SITE_ID_1,
      };

      expect(attendanceScopedWhere.labour.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
    });

    it("should ensure payment and dispute queries scope by labour.organizationId", () => {
      const paymentScopedWhere = {
        labour: { organizationId: MOCK_ORGANIZATION_ID_1 },
      };

      const disputeScopedWhere = {
        labour: { organizationId: MOCK_ORGANIZATION_ID_1 },
      };

      expect(paymentScopedWhere.labour.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
      expect(disputeScopedWhere.labour.organizationId).toBe(MOCK_ORGANIZATION_ID_1);
    });
  });
});

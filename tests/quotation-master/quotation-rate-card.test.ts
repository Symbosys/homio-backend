import { describe, it, expect } from "bun:test";
import {
  createRateCardSchema,
  updateRateCardSchema,
  getRateCardsQuerySchema,
  rateCardIdParamSchema,
  reorderRateCardsSchema,
} from "../../src/module/quotation-master/validators/quotation-rate-card.validator.js";
import { quotationRateCardService } from "../../src/module/quotation-master/services/quotation-rate-card.service.js";
import { quotationRateCardRepo } from "../../src/module/quotation-master/repos/quotation-rate-card.repo.js";
import { RateCardTierType, QuotationItemCategory } from "../../src/types/types.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_RATE_CARD_ID_1,
  MOCK_RATE_CARD_ID_2,
  mockRateCardRecord,
} from "./fixtures/quotation-master.fixtures.js";

describe("Quotation Rate Card Module Tests", () => {
  // =========================================================================
  // 1. Validator Schemas
  // =========================================================================
  describe("Rate Card Validators", () => {
    it("should validate complete rate card creation payload", () => {
      const payload = {
        body: {
          name: "Standard Residential Tier",
          code: "RC-STD-01",
          tierType: RateCardTierType.STANDARD,
          description: "Default markup tier for apartment fitouts",
          defaultMarkupPercent: 25.0,
          categoryMarkups: {
            CIVIL: 15.0,
            CARPENTRY: 25.0,
          },
          applicableCategories: [QuotationItemCategory.CIVIL, QuotationItemCategory.CARPENTRY],
          isDefault: true,
          isActive: true,
          sortOrder: 0,
        },
      };

      const result = createRateCardSchema.parse(payload);
      expect(result.body.code).toBe("RC-STD-01");
      expect(result.body.tierType).toBe(RateCardTierType.STANDARD);
      expect(result.body.defaultMarkupPercent).toBe(25.0);
    });

    it("should validate dirty update payload", () => {
      const payload = {
        params: { id: MOCK_RATE_CARD_ID_1 },
        body: {
          defaultMarkupPercent: 30.0,
          categoryMarkups: { CIVIL: 22.5 },
        },
      };

      const result = updateRateCardSchema.parse(payload);
      expect(result.body.defaultMarkupPercent).toBe(30.0);
      expect(result.body.categoryMarkups?.CIVIL).toBe(22.5);
    });

    it("should validate reorder payload", () => {
      const payload = {
        body: {
          orders: [
            { id: MOCK_RATE_CARD_ID_1, sortOrder: 1 },
            { id: MOCK_RATE_CARD_ID_2, sortOrder: 0 },
          ],
        },
      };

      const result = reorderRateCardsSchema.parse(payload);
      expect(result.body.orders.length).toBe(2);
      expect(result.body.orders[0]?.sortOrder).toBe(1);
    });
  });

  // =========================================================================
  // 2. Service Layer Logic
  // =========================================================================
  describe("Rate Card Service", () => {
    it("should create rate card and clear existing default when isDefault is true", async () => {
      const originalFindByCode = quotationRateCardRepo.findByCode;
      const originalClearDefault = quotationRateCardRepo.clearExistingDefault;
      const originalCreate = quotationRateCardRepo.create;

      let clearedCalled = false;
      quotationRateCardRepo.findByCode = async () => null;
      quotationRateCardRepo.clearExistingDefault = async () => {
        clearedCalled = true;
        return { count: 1 } as any;
      };
      quotationRateCardRepo.create = async (_orgId, data) => ({
        ...mockRateCardRecord,
        ...data,
      } as any);

      try {
        const input = {
          name: "Luxury Obsidian",
          code: "rc-luxury-01",
          tierType: RateCardTierType.LUXURY,
          description: "High margin tier",
          defaultMarkupPercent: 35.0,
          categoryMarkups: { CIVIL: 20 },
          applicableCategories: [QuotationItemCategory.CIVIL],
          isDefault: true,
          isActive: true,
          sortOrder: 0,
          additionalInformation: null,
        };

        const result = await quotationRateCardService.createRateCard(MOCK_ORGANIZATION_ID_1, input);
        expect(clearedCalled).toBe(true);
        expect(result.code).toBe("RC-LUXURY-01");
        expect(result.name).toBe("Luxury Obsidian");
      } finally {
        quotationRateCardRepo.findByCode = originalFindByCode;
        quotationRateCardRepo.clearExistingDefault = originalClearDefault;
        quotationRateCardRepo.create = originalCreate;
      }
    });

    it("should retrieve the active default rate card", async () => {
      const originalFindDefault = quotationRateCardRepo.findDefault;
      quotationRateCardRepo.findDefault = async () => mockRateCardRecord as any;

      try {
        const result = await quotationRateCardService.getDefaultRateCard(MOCK_ORGANIZATION_ID_1);
        expect(result.isDefault).toBe(true);
        expect(result.name).toBe(mockRateCardRecord.name);
      } finally {
        quotationRateCardRepo.findDefault = originalFindDefault;
      }
    });

    it("should switch the default rate card to a new one", async () => {
      const originalFindById = quotationRateCardRepo.findById;
      const originalClearDefault = quotationRateCardRepo.clearExistingDefault;
      const originalUpdate = quotationRateCardRepo.update;

      let clearedCalled = false;
      quotationRateCardRepo.findById = async () => mockRateCardRecord as any;
      quotationRateCardRepo.clearExistingDefault = async () => {
        clearedCalled = true;
        return { count: 1 } as any;
      };
      quotationRateCardRepo.update = async (_id, _orgId, data) => ({
        ...mockRateCardRecord,
        ...data,
      } as any);

      try {
        const result = await quotationRateCardService.setDefaultRateCard(MOCK_RATE_CARD_ID_1, MOCK_ORGANIZATION_ID_1);
        expect(clearedCalled).toBe(true);
        expect(result.isDefault).toBe(true);
      } finally {
        quotationRateCardRepo.findById = originalFindById;
        quotationRateCardRepo.clearExistingDefault = originalClearDefault;
        quotationRateCardRepo.update = originalUpdate;
      }
    });
  });
});

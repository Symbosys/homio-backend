import { describe, it, expect } from "bun:test";
import {
  createQuotationItem,
  getQuotationItems,
  getQuotationItemById,
  updateQuotationItem,
  deleteQuotationItem,
  toggleActiveQuotationItem,
} from "../../src/module/quotation-master/controllers/quotation-item-master.controller.js";
import {
  createRateCard,
  getRateCards,
  getDefaultRateCard,
  getRateCardById,
  updateRateCard,
  deleteRateCard,
  setDefaultRateCard,
} from "../../src/module/quotation-master/controllers/quotation-rate-card.controller.js";
import {
  createTermsTemplate,
  getTermsTemplates,
  getDefaultTermsTemplate,
  getTermsTemplateById,
  updateTermsTemplate,
  deleteTermsTemplate,
  duplicateTermsTemplate,
} from "../../src/module/quotation-master/controllers/quotation-terms-template.controller.js";
import {
  getPdfAssets,
  getPdfAssetsSummary,
  getPdfAssetById,
  updatePdfAsset,
  deletePdfAsset,
} from "../../src/module/quotation-master/controllers/quotation-pdf-asset.controller.js";
import { quotationItemMasterService } from "../../src/module/quotation-master/services/quotation-item-master.service.js";
import { quotationRateCardService } from "../../src/module/quotation-master/services/quotation-rate-card.service.js";
import { quotationTermsTemplateService } from "../../src/module/quotation-master/services/quotation-terms-template.service.js";
import { quotationPdfAssetService } from "../../src/module/quotation-master/services/quotation-pdf-asset.service.js";
import { QuotationItemCategory, RateCardTierType, PdfPageImagePosition } from "../../src/types/types.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_ITEM_ID_1,
  MOCK_RATE_CARD_ID_1,
  MOCK_TERMS_ID_1,
  MOCK_PDF_ASSET_ID_1,
  mockItemRecord,
  mockRateCardRecord,
  mockTermsTemplateRecord,
  mockPdfAssetRecord,
} from "./fixtures/quotation-master.fixtures.js";

// Helper to mock Express Request and Response
function createMockContext(options?: { body?: any; params?: any; query?: any; user?: any }) {
  const req: any = {
    body: options?.body || {},
    params: options?.params || {},
    query: options?.query || {},
    user: options?.user || {
      id: "user-123",
      email: "architect@homio.app",
      userType: "ADMIN",
      organizationId: MOCK_ORGANIZATION_ID_1,
    },
  };

  let responseData: any = null;
  let responseStatusCode = 200;

  const res: any = {
    status(code: number) {
      responseStatusCode = code;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    getResponse() {
      return { status: responseStatusCode, data: responseData };
    },
  };

  return { req, res };
}

describe("Quotation Master Controllers Integration Tests", () => {
  // =========================================================================
  // 1. Quotation Item Master Controller Tests
  // =========================================================================
  describe("Quotation Item Master Controller", () => {
    it("createQuotationItem should return 201 Created with created record", async () => {
      const originalCreate = quotationItemMasterService.createItem;
      quotationItemMasterService.createItem = async () => mockItemRecord as any;

      try {
        const { req, res } = createMockContext({
          body: {
            sku: "CRP-WDR-SLD-01",
            name: "Wardrobe",
            category: QuotationItemCategory.CARPENTRY,
            technicalSpecs: "18mm Ply",
            unitCost: 1850,
            targetMargin: 30,
          },
        });

        await createQuotationItem(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
        expect(response.data.data.sku).toBe("CRP-WDR-SLD-01");
      } finally {
        quotationItemMasterService.createItem = originalCreate;
      }
    });

    it("getQuotationItems should return 200 OK with paginated results", async () => {
      const originalGetItems = quotationItemMasterService.getItems;
      quotationItemMasterService.getItems = async () => ({
        items: [mockItemRecord],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      } as any);

      try {
        const { req, res } = createMockContext({ query: { page: "1", limit: "20" } });
        await getQuotationItems(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(200);
        expect(response.data.data.items.length).toBe(1);
      } finally {
        quotationItemMasterService.getItems = originalGetItems;
      }
    });

    it("deleteQuotationItem should return 200 OK on soft deletion", async () => {
      const originalDelete = quotationItemMasterService.deleteItem;
      quotationItemMasterService.deleteItem = async () => ({ message: "Deleted successfully" });

      try {
        const { req, res } = createMockContext({ params: { id: MOCK_ITEM_ID_1 } });
        await deleteQuotationItem(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(200);
      } finally {
        quotationItemMasterService.deleteItem = originalDelete;
      }
    });
  });

  // =========================================================================
  // 2. Quotation Rate Card Controller Tests
  // =========================================================================
  describe("Quotation Rate Card Controller", () => {
    it("createRateCard should return 201 Created", async () => {
      const originalCreate = quotationRateCardService.createRateCard;
      quotationRateCardService.createRateCard = async () => mockRateCardRecord as any;

      try {
        const { req, res } = createMockContext({
          body: {
            name: "Obsidian Luxury",
            code: "RC-LUXURY-01",
            tierType: RateCardTierType.LUXURY,
            defaultMarkupPercent: 35,
          },
        });

        await createRateCard(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(201);
        expect(response.data.data.code).toBe("RC-LUXURY-01");
      } finally {
        quotationRateCardService.createRateCard = originalCreate;
      }
    });

    it("getDefaultRateCard should return 200 OK with default rate card", async () => {
      const originalGetDefault = quotationRateCardService.getDefaultRateCard;
      quotationRateCardService.getDefaultRateCard = async () => mockRateCardRecord as any;

      try {
        const { req, res } = createMockContext();
        await getDefaultRateCard(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(200);
        expect(response.data.data.isDefault).toBe(true);
      } finally {
        quotationRateCardService.getDefaultRateCard = originalGetDefault;
      }
    });
  });

  // =========================================================================
  // 3. Quotation Terms Template Controller Tests
  // =========================================================================
  describe("Quotation Terms Template Controller", () => {
    it("createTermsTemplate should return 201 Created", async () => {
      const originalCreate = quotationTermsTemplateService.createTermsTemplate;
      quotationTermsTemplateService.createTermsTemplate = async () => mockTermsTemplateRecord as any;

      try {
        const { req, res } = createMockContext({
          body: {
            name: "Turnkey Terms",
            termsAndConditions: "Standard legal signoff clauses",
          },
        });

        await createTermsTemplate(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(201);
        expect(response.data.data.name).toBe(mockTermsTemplateRecord.name);
      } finally {
        quotationTermsTemplateService.createTermsTemplate = originalCreate;
      }
    });

    it("duplicateTermsTemplate should return 201 Created with cloned data", async () => {
      const originalDuplicate = quotationTermsTemplateService.duplicateTermsTemplate;
      quotationTermsTemplateService.duplicateTermsTemplate = async () => ({
        ...mockTermsTemplateRecord,
        name: "Cloned Commercial Terms",
      } as any);

      try {
        const { req, res } = createMockContext({
          params: { id: MOCK_TERMS_ID_1 },
          body: { name: "Cloned Commercial Terms" },
        });

        await duplicateTermsTemplate(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(201);
        expect(response.data.data.name).toBe("Cloned Commercial Terms");
      } finally {
        quotationTermsTemplateService.duplicateTermsTemplate = originalDuplicate;
      }
    });
  });

  // =========================================================================
  // 4. Quotation PDF Asset Controller Tests
  // =========================================================================
  describe("Quotation PDF Asset Controller", () => {
    it("getPdfAssetsSummary should return 200 OK with capacity breakdown", async () => {
      const originalGetSummary = quotationPdfAssetService.getSummary;
      quotationPdfAssetService.getSummary = async () => ({
        front: { count: 3, maxLimit: 10, remainingSlots: 7, isLimitReached: false },
        back: { count: 1, maxLimit: 10, remainingSlots: 9, isLimitReached: false },
      });

      try {
        const { req, res } = createMockContext();
        await getPdfAssetsSummary(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(200);
        expect(response.data.data.front.remainingSlots).toBe(7);
        expect(response.data.data.back.count).toBe(1);
      } finally {
        quotationPdfAssetService.getSummary = originalGetSummary;
      }
    });

    it("getPdfAssets should return non-paginated asset list", async () => {
      const originalGetAssets = quotationPdfAssetService.getAssets;
      quotationPdfAssetService.getAssets = async () => [mockPdfAssetRecord] as any;

      try {
        const { req, res } = createMockContext({ query: { position: PdfPageImagePosition.FRONT } });
        await getPdfAssets(req, res, () => {});
        const response = res.getResponse();
        expect(response.status).toBe(200);
        expect(response.data.data.length).toBe(1);
        expect(response.data.data[0].position).toBe(PdfPageImagePosition.FRONT);
      } finally {
        quotationPdfAssetService.getAssets = originalGetAssets;
      }
    });
  });
});

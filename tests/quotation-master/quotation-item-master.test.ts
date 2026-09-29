import { describe, it, expect } from "bun:test";
import {
  createQuotationItemSchema,
  updateQuotationItemSchema,
  getQuotationItemsQuerySchema,
  quotationItemIdParamSchema,
  bulkCreateQuotationItemsSchema,
} from "../../src/module/quotation-master/validators/quotation-item-master.validator.js";
import { quotationItemMasterService } from "../../src/module/quotation-master/services/quotation-item-master.service.js";
import { quotationItemMasterRepo } from "../../src/module/quotation-master/repos/quotation-item-master.repo.js";
import { storageService } from "../../src/lib/storage/storage.service.js";
import { QuotationItemCategory } from "../../src/types/types.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_ITEM_ID_1,
  mockItemRecord,
  mockImage1,
  mockImage2,
} from "./fixtures/quotation-master.fixtures.js";

describe("Quotation Item Master Module Tests", () => {
  // =========================================================================
  // 1. Validator Schemas
  // =========================================================================
  describe("Quotation Item Validators", () => {
    it("should successfully validate a complete item creation payload", () => {
      const payload = {
        body: {
          sku: "CRP-WDR-SLD-01",
          name: "Full Height Sliding Wardrobe with Loft",
          category: QuotationItemCategory.CARPENTRY,
          subcategory: "Master Bedroom",
          technicalSpecs: "18mm BWR Ply with Merino Laminate",
          description: "Internal drawers and tie rack included",
          uom: "sqft",
          unitCost: 1850,
          targetMargin: 30,
          approvedBrands: ["Greenply", "CenturyPly"],
          tags: ["wardrobe", "storage"],
          isActive: true,
          additionalInformation: { heightFt: 9, widthFt: 8 },
        },
      };

      const result = createQuotationItemSchema.parse(payload);
      expect(result.body.sku).toBe("CRP-WDR-SLD-01");
      expect(result.body.category).toBe(QuotationItemCategory.CARPENTRY);
      expect(result.body.unitCost).toBe(1850);
      expect(result.body.targetMargin).toBe(30);
    });

    it("should fail validation when sku or technicalSpecs is missing", () => {
      const invalidPayload = {
        body: {
          name: "Incomplete Item",
          category: QuotationItemCategory.CIVIL,
        },
      };

      expect(() => createQuotationItemSchema.parse(invalidPayload)).toThrow();
    });

    it("should validate bulk creation payload", () => {
      const payload = {
        body: {
          items: [
            {
              sku: "CIV-DEM-01",
              name: "Brick Wall Demolition",
              category: QuotationItemCategory.CIVIL,
              technicalSpecs: "Manual demolition including debris clearance",
              unitCost: 45,
              targetMargin: 20,
              uom: "sqft",
            },
            {
              sku: "CIV-MAS-01",
              name: "AAC Block Masonry",
              category: QuotationItemCategory.CIVIL,
              technicalSpecs: "100mm AAC Blocks with adhesive mortar",
              unitCost: 120,
              targetMargin: 25,
              uom: "sqft",
            },
          ],
        },
      };

      const result = bulkCreateQuotationItemsSchema.parse(payload);
      expect(result.body.items.length).toBe(2);
      expect(result.body.items[0]?.sku).toBe("CIV-DEM-01");
    });

    it("should parse query filters with default pagination and search", () => {
      const query = {
        query: {
          page: "2",
          limit: "15",
          search: "Wardrobe",
          category: QuotationItemCategory.CARPENTRY,
          isActive: "true",
          sortBy: "unitCost" as const,
          sortOrder: "asc" as const,
        },
      };

      const result = getQuotationItemsQuerySchema.parse(query);
      expect(result.query.page).toBe(2);
      expect(result.query.limit).toBe(15);
      expect(result.query.isActive).toBe(true);
      expect(result.query.category).toBe(QuotationItemCategory.CARPENTRY);
    });

    it("should validate ID param", () => {
      const validParam = { params: { id: MOCK_ITEM_ID_1 } };
      expect(quotationItemIdParamSchema.parse(validParam).params.id).toBe(MOCK_ITEM_ID_1);

      const invalidParam = { params: { id: "not-a-uuid" } };
      expect(() => quotationItemIdParamSchema.parse(invalidParam)).toThrow();
    });
  });

  // =========================================================================
  // 2. Service Layer Logic
  // =========================================================================
  describe("Quotation Item Service", () => {
    it("should create an item after normalizing SKU and verifying uniqueness", async () => {
      const originalFindBySku = quotationItemMasterRepo.findBySku;
      const originalCreate = quotationItemMasterRepo.create;

      quotationItemMasterRepo.findBySku = async () => null;
      quotationItemMasterRepo.create = async (_orgId, data) => ({
        ...mockItemRecord,
        ...data,
      } as any);

      try {
        const input = {
          sku: "  crp-wdr-sld-01  ",
          name: "Full Height Sliding Wardrobe",
          category: QuotationItemCategory.CARPENTRY,
          technicalSpecs: "18mm Ply",
          uom: "sqft",
          unitCost: 1850,
          targetMargin: 30,
          approvedBrands: ["Hafele"],
          tags: ["wardrobe"],
          isActive: true,
          additionalInformation: null,
          galleryImages: [],
        };

        const result = await quotationItemMasterService.createItem(MOCK_ORGANIZATION_ID_1, input);
        expect(result.sku).toBe("CRP-WDR-SLD-01");
        expect(result.name).toBe("Full Height Sliding Wardrobe");
      } finally {
        quotationItemMasterRepo.findBySku = originalFindBySku;
        quotationItemMasterRepo.create = originalCreate;
      }
    });

    it("should reject creation if SKU already exists for the organization", async () => {
      const originalFindBySku = quotationItemMasterRepo.findBySku;
      quotationItemMasterRepo.findBySku = async () => mockItemRecord as any;

      try {
        const input = {
          sku: "CRP-WDR-SLD-01",
          name: "Duplicate Item",
          category: QuotationItemCategory.CARPENTRY,
          technicalSpecs: "18mm Ply",
          uom: "sqft",
          unitCost: 1000,
          targetMargin: 20,
          approvedBrands: [],
          tags: [],
          isActive: true,
          additionalInformation: null,
          galleryImages: [],
        };

        let threw = false;
        try {
          await quotationItemMasterService.createItem(MOCK_ORGANIZATION_ID_1, input);
        } catch (err: any) {
          threw = true;
          expect(err.message).toContain("already exists");
        }
        expect(threw).toBe(true);
      } finally {
        quotationItemMasterRepo.findBySku = originalFindBySku;
      }
    });

    it("should detect duplicate SKUs in bulk create batch", async () => {
      const input = {
        items: [
          {
            sku: "DUPLICATE-SKU",
            name: "Item A",
            category: QuotationItemCategory.CIVIL,
            technicalSpecs: "Specs A",
            uom: "sqft",
            unitCost: 100,
            targetMargin: 20,
            approvedBrands: [],
            tags: [],
            isActive: true,
            additionalInformation: null,
          },
          {
            sku: "DUPLICATE-SKU",
            name: "Item B",
            category: QuotationItemCategory.CIVIL,
            technicalSpecs: "Specs B",
            uom: "sqft",
            unitCost: 150,
            targetMargin: 25,
            approvedBrands: [],
            tags: [],
            isActive: true,
            additionalInformation: null,
          },
        ],
      };

      let threw = false;
      try {
        await quotationItemMasterService.bulkCreateItems(MOCK_ORGANIZATION_ID_1, input);
      } catch (err: any) {
        threw = true;
        expect(err.message).toContain("Duplicate SKUs detected");
      }
      expect(threw).toBe(true);
    });

    it("should upload primary image and update item record", async () => {
      const originalFindById = quotationItemMasterRepo.findById;
      const originalUpdate = quotationItemMasterRepo.update;
      const originalStorageUpload = storageService.upload;

      quotationItemMasterRepo.findById = async () => mockItemRecord as any;
      storageService.upload = async () => ({
        publicId: "new-cloud-id",
        url: "https://storage.homio.app/new.webp",
        secureUrl: "https://storage.homio.app/new.webp",
        bytes: 12345,
        format: "webp",
        provider: "CLOUDINARY" as const,
      });
      quotationItemMasterRepo.update = async (_id, _orgId, data) => ({
        ...mockItemRecord,
        ...data,
      } as any);

      try {
        const mockFile = {
          buffer: Buffer.from("fake-image"),
          originalname: "render.webp",
          mimetype: "image/webp",
          size: 12345,
        } as Express.Multer.File;

        const result = await quotationItemMasterService.uploadPrimaryImage(
          MOCK_ITEM_ID_1,
          MOCK_ORGANIZATION_ID_1,
          mockFile
        );

        expect((result.imageUrl as any).id).toBe("new-cloud-id");
        expect((result.imageUrl as any).url).toBe("https://storage.homio.app/new.webp");
      } finally {
        quotationItemMasterRepo.findById = originalFindById;
        quotationItemMasterRepo.update = originalUpdate;
        storageService.upload = originalStorageUpload;
      }
    });

    it("should delete a gallery image from an item", async () => {
      const originalFindById = quotationItemMasterRepo.findById;
      const originalUpdate = quotationItemMasterRepo.update;
      const originalStorageDelete = storageService.delete;

      quotationItemMasterRepo.findById = async () => ({
        ...mockItemRecord,
        galleryImages: [mockImage1, mockImage2],
      } as any);
      storageService.delete = async () => true;
      quotationItemMasterRepo.update = async (_id, _orgId, data) => ({
        ...mockItemRecord,
        ...data,
      } as any);

      try {
        const result = await quotationItemMasterService.deleteGalleryImage(
          MOCK_ITEM_ID_1,
          mockImage1.id,
          MOCK_ORGANIZATION_ID_1
        );

        expect((result.galleryImages as any).length).toBe(1);
        expect((result.galleryImages as any)[0].id).toBe(mockImage2.id);
      } finally {
        quotationItemMasterRepo.findById = originalFindById;
        quotationItemMasterRepo.update = originalUpdate;
        storageService.delete = originalStorageDelete;
      }
    });
  });
});

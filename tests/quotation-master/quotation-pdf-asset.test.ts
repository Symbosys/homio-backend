import { describe, it, expect } from "bun:test";
import {
  createPdfAssetSchema,
  updatePdfAssetSchema,
  getPdfAssetsQuerySchema,
  reorderPdfAssetsSchema,
} from "../../src/module/quotation-master/validators/quotation-pdf-asset.validator.js";
import { quotationPdfAssetService } from "../../src/module/quotation-master/services/quotation-pdf-asset.service.js";
import { quotationPdfAssetRepo } from "../../src/module/quotation-master/repos/quotation-pdf-asset.repo.js";
import { storageService } from "../../src/lib/storage/storage.service.js";
import { PdfPageImagePosition } from "../../src/types/types.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_PDF_ASSET_ID_1,
  MOCK_PDF_ASSET_ID_2,
  mockPdfAssetRecord,
} from "./fixtures/quotation-master.fixtures.js";

describe("Quotation PDF Page Asset Module Tests", () => {
  // =========================================================================
  // 1. Validator Schemas
  // =========================================================================
  describe("PDF Asset Validators", () => {
    it("should validate complete PDF asset creation payload", () => {
      const payload = {
        body: {
          title: "Studio Design Philosophy Front Cover",
          position: PdfPageImagePosition.FRONT,
          pageTag: "COVER",
          isDefault: true,
          isActive: true,
        },
      };

      const result = createPdfAssetSchema.parse(payload);
      expect(result.body.title).toBe("Studio Design Philosophy Front Cover");
      expect(result.body.position).toBe(PdfPageImagePosition.FRONT);
    });

    it("should validate reorder payload within FRONT position", () => {
      const payload = {
        body: {
          position: PdfPageImagePosition.FRONT,
          orders: [
            { id: MOCK_PDF_ASSET_ID_1, sortOrder: 0 },
            { id: MOCK_PDF_ASSET_ID_2, sortOrder: 1 },
          ],
        },
      };

      const result = reorderPdfAssetsSchema.parse(payload);
      expect(result.body.position).toBe(PdfPageImagePosition.FRONT);
      expect(result.body.orders.length).toBe(2);
    });

    it("should reject reorder sortOrder > 9", () => {
      const invalidPayload = {
        body: {
          position: PdfPageImagePosition.FRONT,
          orders: [{ id: MOCK_PDF_ASSET_ID_1, sortOrder: 10 }],
        },
      };

      expect(() => reorderPdfAssetsSchema.parse(invalidPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. Service Layer Logic & Max 10 Limit Enforcement
  // =========================================================================
  describe("PDF Asset Service & Quota Controls", () => {
    it("should enforce strict limit of maximum 10 FRONT assets per organization", async () => {
      const originalCountByPosition = quotationPdfAssetRepo.countByPosition;
      quotationPdfAssetRepo.countByPosition = async () => 10; // Already at maximum limit!

      try {
        const mockFile = {
          buffer: Buffer.from("fake-image"),
          originalname: "cover.webp",
          mimetype: "image/webp",
          size: 50000,
        } as Express.Multer.File;

        const input = {
          title: "Eleventh Front Cover",
          position: PdfPageImagePosition.FRONT,
          pageTag: "COVER",
          isDefault: false,
          isActive: true,
          additionalInformation: null,
        };

        let threw = false;
        try {
          await quotationPdfAssetService.createAsset(MOCK_ORGANIZATION_ID_1, input, mockFile);
        } catch (err: any) {
          threw = true;
          expect(err.message).toContain("Maximum limit of 10 FRONT PDF page assets reached");
        }
        expect(threw).toBe(true);
      } finally {
        quotationPdfAssetRepo.countByPosition = originalCountByPosition;
      }
    });

    it("should upload image and auto-assign next sequential sortOrder when under limit", async () => {
      const originalCountByPosition = quotationPdfAssetRepo.countByPosition;
      const originalGetNextSort = quotationPdfAssetRepo.getNextSortOrder;
      const originalStorageUpload = storageService.upload;
      const originalCreate = quotationPdfAssetRepo.create;

      quotationPdfAssetRepo.countByPosition = async () => 3;
      quotationPdfAssetRepo.getNextSortOrder = async () => 3;
      storageService.upload = async () => ({
        publicId: "pdf-asset-cloud-04",
        url: "https://storage.homio.app/pdf-cover.webp",
        secureUrl: "https://storage.homio.app/pdf-cover.webp",
        bytes: 80000,
        format: "webp",
        provider: "CLOUDINARY" as const,
      });
      quotationPdfAssetRepo.create = async (_orgId, data) => ({
        ...mockPdfAssetRecord,
        ...data,
      } as any);

      try {
        const mockFile = {
          buffer: Buffer.from("fake-image"),
          originalname: "cover4.webp",
          mimetype: "image/webp",
          size: 80000,
        } as Express.Multer.File;

        const input = {
          title: "4th Cover Page",
          position: PdfPageImagePosition.FRONT,
          pageTag: "COVER",
          isDefault: false,
          isActive: true,
          additionalInformation: null,
        };

        const result = await quotationPdfAssetService.createAsset(MOCK_ORGANIZATION_ID_1, input, mockFile);
        expect(result.sortOrder).toBe(3);
        expect((result.image as any).id).toBe("pdf-asset-cloud-04");
      } finally {
        quotationPdfAssetRepo.countByPosition = originalCountByPosition;
        quotationPdfAssetRepo.getNextSortOrder = originalGetNextSort;
        storageService.upload = originalStorageUpload;
        quotationPdfAssetRepo.create = originalCreate;
      }
    });

    it("should compute accurate summary of remaining slots for FRONT and BACK", async () => {
      const originalGetSummary = quotationPdfAssetRepo.getSummary;
      quotationPdfAssetRepo.getSummary = async () => ({
        front: {
          count: 4,
          maxLimit: 10,
          remainingSlots: 6,
          isLimitReached: false,
        },
        back: {
          count: 2,
          maxLimit: 10,
          remainingSlots: 8,
          isLimitReached: false,
        },
      });

      try {
        const summary = await quotationPdfAssetService.getSummary(MOCK_ORGANIZATION_ID_1);
        expect(summary.front.count).toBe(4);
        expect(summary.front.remainingSlots).toBe(6);
        expect(summary.back.remainingSlots).toBe(8);
      } finally {
        quotationPdfAssetRepo.getSummary = originalGetSummary;
      }
    });
  });
});

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { channelPartnerService } from "../../src/module/channel-partner/services/channel-partner.service.js";
import { channelPartnerPayoutService } from "../../src/module/channel-partner/services/channel-partner-payout.service.js";
import { channelPartnerRepo } from "../../src/module/channel-partner/repos/channel-partner.repo.js";
import { channelPartnerPayoutRepo } from "../../src/module/channel-partner/repos/channel-partner-payout.repo.js";
import { storageService } from "../../src/lib/storage/storage.service.js";
import { ErrorResponse } from "../../src/utils/response.util.js";
import { statusCode } from "../../src/types/types.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_PARTNER_ID_1,
  MOCK_PARTNER_ID_2,
  MOCK_PAYOUT_ID_1,
  mockPartnerRecord,
  mockPayoutRecord,
} from "./fixtures/channel-partner.fixtures.js";

describe("Channel Partner Service Layer Unit Tests", () => {
  // =========================================================================
  // 1. ChannelPartnerService Tests
  // =========================================================================
  describe("ChannelPartnerService", () => {
    it("should successfully register a channel partner and assign next partnerCode", async () => {
      // Mock repository methods
      const originalFindByPhone = channelPartnerRepo.findByPhone;
      const originalGenerateCode = channelPartnerRepo.generatePartnerCode;
      const originalCreate = channelPartnerRepo.create;

      channelPartnerRepo.findByPhone = async () => null as any;
      channelPartnerRepo.generatePartnerCode = async () => "CP-1001";
      channelPartnerRepo.create = async (_orgId, data) => ({
        ...mockPartnerRecord,
        ...data,
      } as any);

      try {
        const input = {
          name: "Amit Patel",
          phone: " +919876543210 ",
          companyName: "Patel Realty",
          email: "amit@example.com",
          defaultCommissionType: "PERCENTAGE" as const,
          defaultCommissionValue: 5.0,
          additionalInformation: { tier: "Gold" },
        };

        const result = await channelPartnerService.createPartner(MOCK_ORGANIZATION_ID_1, input);

        expect(result.partnerCode).toBe("CP-1001");
        expect(result.phone).toBe("+919876543210");
        expect(result.name).toBe("Amit Patel");
      } finally {
        channelPartnerRepo.findByPhone = originalFindByPhone;
        channelPartnerRepo.generatePartnerCode = originalGenerateCode;
        channelPartnerRepo.create = originalCreate;
      }
    });

    it("should throw 409 Conflict if phone number already registered for organization", async () => {
      const originalFindByPhone = channelPartnerRepo.findByPhone;
      channelPartnerRepo.findByPhone = async () => mockPartnerRecord as any;

      try {
        const input = {
          name: "Duplicate Phone Partner",
          phone: "+919876543210",
        };

        let thrownError: any = null;
        try {
          await channelPartnerService.createPartner(MOCK_ORGANIZATION_ID_1, input);
        } catch (err) {
          thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(ErrorResponse);
        expect(thrownError?.statusCode).toBe(statusCode.Conflict);
        expect(thrownError?.message).toContain("already exists");
      } finally {
        channelPartnerRepo.findByPhone = originalFindByPhone;
      }
    });

    it("should return single channel partner by ID if found", async () => {
      const originalFindById = channelPartnerRepo.findById;
      channelPartnerRepo.findById = async (id, orgId) => {
        if (id === MOCK_PARTNER_ID_1 && orgId === MOCK_ORGANIZATION_ID_1) {
          return mockPartnerRecord as any;
        }
        return null;
      };

      try {
        const result = await channelPartnerService.getPartnerById(MOCK_PARTNER_ID_1, MOCK_ORGANIZATION_ID_1);
        expect(result.id).toBe(MOCK_PARTNER_ID_1);
        expect(result.name).toBe("Amit Patel");
      } finally {
        channelPartnerRepo.findById = originalFindById;
      }
    });

    it("should throw 404 Not Found if channel partner does not exist", async () => {
      const originalFindById = channelPartnerRepo.findById;
      channelPartnerRepo.findById = async () => null;

      try {
        let thrownError: any = null;
        try {
          await channelPartnerService.getPartnerById("non-existent-id", MOCK_ORGANIZATION_ID_1);
        } catch (err) {
          thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(ErrorResponse);
        expect(thrownError?.statusCode).toBe(statusCode.Not_Found);
      } finally {
        channelPartnerRepo.findById = originalFindById;
      }
    });

    it("should update channel partner with status and kycStatus changes on PATCH", async () => {
      const originalFindById = channelPartnerRepo.findById;
      const originalUpdate = channelPartnerRepo.update;

      channelPartnerRepo.findById = async () => mockPartnerRecord as any;
      channelPartnerRepo.update = async (_id, _orgId, data) => ({
        ...mockPartnerRecord,
        ...data,
      } as any);

      try {
        const patchData = {
          status: "INACTIVE" as const,
          kycStatus: "REJECTED" as const,
          notes: "Updated compliance notes",
        };

        const result = await channelPartnerService.updatePartner(MOCK_PARTNER_ID_1, MOCK_ORGANIZATION_ID_1, patchData);
        expect(result.status).toBe("INACTIVE");
        expect(result.kycStatus).toBe("REJECTED");
        expect(result.notes).toBe("Updated compliance notes");
      } finally {
        channelPartnerRepo.findById = originalFindById;
        channelPartnerRepo.update = originalUpdate;
      }
    });

    it("should prevent updating phone if another partner in same org already uses it", async () => {
      const originalFindById = channelPartnerRepo.findById;
      const originalFindByPhone = channelPartnerRepo.findByPhone;

      channelPartnerRepo.findById = async () => mockPartnerRecord as any;
      channelPartnerRepo.findByPhone = async () => ({
        ...mockPartnerRecord,
        id: MOCK_PARTNER_ID_2, // Different partner
        phone: "+919999888877",
      } as any);

      try {
        let thrownError: any = null;
        try {
          await channelPartnerService.updatePartner(MOCK_PARTNER_ID_1, MOCK_ORGANIZATION_ID_1, {
            phone: "+919999888877",
          });
        } catch (err) {
          thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(ErrorResponse);
        expect(thrownError?.statusCode).toBe(statusCode.Conflict);
      } finally {
        channelPartnerRepo.findById = originalFindById;
        channelPartnerRepo.findByPhone = originalFindByPhone;
      }
    });

    it("should soft delete channel partner", async () => {
      const originalFindById = channelPartnerRepo.findById;
      const originalSoftDelete = channelPartnerRepo.softDelete;

      let deletedId: string = "";
      channelPartnerRepo.findById = async () => mockPartnerRecord as any;
      channelPartnerRepo.softDelete = async (id) => {
        deletedId = id;
        return { ...mockPartnerRecord, isDeleted: true } as any;
      };

      try {
        const result = await channelPartnerService.deletePartner(MOCK_PARTNER_ID_1, MOCK_ORGANIZATION_ID_1);
        expect(deletedId).toBe(MOCK_PARTNER_ID_1);
        expect(result.message).toContain("successfully");
      } finally {
        channelPartnerRepo.findById = originalFindById;
        channelPartnerRepo.softDelete = originalSoftDelete;
      }
    });

    it("should upload avatar and store structured ImageType JSON", async () => {
      const originalFindById = channelPartnerRepo.findById;
      const originalUpload = storageService.upload;
      const originalUpdate = channelPartnerRepo.update;

      channelPartnerRepo.findById = async () => mockPartnerRecord as any;
      storageService.upload = async () => ({
        publicId: "avatar_cp_1001",
        secureUrl: "https://storage.example.com/avatar.webp",
        url: "https://storage.example.com/avatar.webp",
        bytes: 12450,
        format: "webp",
        provider: "local",
      } as any);

      let savedAvatarUrl: any = null;
      channelPartnerRepo.update = async (_id, _orgId, data) => {
        savedAvatarUrl = data.avatarUrl;
        return {
          ...mockPartnerRecord,
          avatarUrl: data.avatarUrl,
        } as any;
      };

      try {
        const mockFile = {
          buffer: Buffer.from("image-binary"),
          originalname: "avatar.jpg",
          mimetype: "image/jpeg",
          size: 12450,
        } as Express.Multer.File;

        const result = await channelPartnerService.uploadAvatar(MOCK_PARTNER_ID_1, MOCK_ORGANIZATION_ID_1, mockFile);
        expect(savedAvatarUrl).not.toBeNull();
        expect(savedAvatarUrl.id).toBe("avatar_cp_1001");
        expect(savedAvatarUrl.url).toBe("https://storage.example.com/avatar.webp");
        expect(savedAvatarUrl.format).toBe("webp");
        expect(result.avatarUrl).toEqual(savedAvatarUrl);
      } finally {
        channelPartnerRepo.findById = originalFindById;
        storageService.upload = originalUpload;
        channelPartnerRepo.update = originalUpdate;
      }
    });
  });

  // =========================================================================
  // 2. ChannelPartnerPayoutService Tests
  // =========================================================================
  describe("ChannelPartnerPayoutService", () => {
    it("should successfully record commission payout disbursement", async () => {
      const originalFindPartner = channelPartnerRepo.findById;
      const originalCreatePayout = channelPartnerPayoutRepo.create;

      channelPartnerRepo.findById = async () => mockPartnerRecord as any;
      channelPartnerPayoutRepo.create = async (_orgId, data) => ({
        ...mockPayoutRecord,
        ...data,
      } as any);

      try {
        const input = {
          channelPartnerId: MOCK_PARTNER_ID_1,
          amount: 75000,
          paymentMode: "NEFT" as const,
          transactionReference: "NEFT-2026-9999",
          remarks: "Final project commissioning payout",
          additionalInformation: { approvedBy: "Director" },
        };

        const result = await channelPartnerPayoutService.createPayout(MOCK_ORGANIZATION_ID_1, input);
        expect(Number(result.amount)).toBe(75000);
        expect(result.paymentMode).toBe("NEFT");
        expect(result.transactionReference).toBe("NEFT-2026-9999");
      } finally {
        channelPartnerRepo.findById = originalFindPartner;
        channelPartnerPayoutRepo.create = originalCreatePayout;
      }
    });

    it("should throw 404 Not Found when creating payout if channel partner is not found in organization", async () => {
      const originalFindPartner = channelPartnerRepo.findById;
      channelPartnerRepo.findById = async () => null;

      try {
        const input = {
          channelPartnerId: "unknown-partner-id",
          amount: 25000,
          paymentMode: "UPI" as const,
        };

        let thrownError: any = null;
        try {
          await channelPartnerPayoutService.createPayout(MOCK_ORGANIZATION_ID_1, input);
        } catch (err) {
          thrownError = err;
        }

        expect(thrownError).toBeInstanceOf(ErrorResponse);
        expect(thrownError?.statusCode).toBe(statusCode.Not_Found);
        expect(thrownError?.message).toContain("not found in this organization");
      } finally {
        channelPartnerRepo.findById = originalFindPartner;
      }
    });

    it("should upload receipt file via storageService when provided with payout", async () => {
      const originalFindPartner = channelPartnerRepo.findById;
      const originalUpload = storageService.upload;
      const originalCreatePayout = channelPartnerPayoutRepo.create;

      channelPartnerRepo.findById = async () => mockPartnerRecord as any;
      storageService.upload = async () => ({
        publicId: "receipt_cp_payout_1",
        secureUrl: "https://storage.example.com/receipt.pdf",
        url: "https://storage.example.com/receipt.pdf",
        bytes: 45000,
        format: "pdf",
        provider: "local",
      } as any);

      let savedReceipt: any = null;
      channelPartnerPayoutRepo.create = async (_orgId, data) => {
        savedReceipt = data.receiptUrl;
        return {
          ...mockPayoutRecord,
          ...data,
        } as any;
      };

      try {
        const input = {
          channelPartnerId: MOCK_PARTNER_ID_1,
          amount: 30000,
          paymentMode: "CHEQUE" as const,
        };

        const mockFile = {
          buffer: Buffer.from("pdf-binary"),
          originalname: "cheque_copy.pdf",
          mimetype: "application/pdf",
          size: 45000,
        } as Express.Multer.File;

        await channelPartnerPayoutService.createPayout(MOCK_ORGANIZATION_ID_1, input, mockFile);
        expect(savedReceipt).not.toBeNull();
        expect(savedReceipt.id).toBe("receipt_cp_payout_1");
        expect(savedReceipt.url).toBe("https://storage.example.com/receipt.pdf");
      } finally {
        channelPartnerRepo.findById = originalFindPartner;
        storageService.upload = originalUpload;
        channelPartnerPayoutRepo.create = originalCreatePayout;
      }
    });

    it("should fetch single payout by ID or throw 404", async () => {
      const originalFindById = channelPartnerPayoutRepo.findById;
      channelPartnerPayoutRepo.findById = async (id, orgId) => {
        if (id === MOCK_PAYOUT_ID_1 && orgId === MOCK_ORGANIZATION_ID_1) {
          return mockPayoutRecord as any;
        }
        return null;
      };

      try {
        const found = await channelPartnerPayoutService.getPayoutById(MOCK_PAYOUT_ID_1, MOCK_ORGANIZATION_ID_1);
        expect(found.id).toBe(MOCK_PAYOUT_ID_1);

        let error: any = null;
        try {
          await channelPartnerPayoutService.getPayoutById("wrong-id", MOCK_ORGANIZATION_ID_1);
        } catch (err) {
          error = err;
        }
        expect(error).toBeInstanceOf(ErrorResponse);
        expect(error.statusCode).toBe(statusCode.Not_Found);
      } finally {
        channelPartnerPayoutRepo.findById = originalFindById;
      }
    });

    it("should fetch partner payouts or throw 404 if partner does not exist", async () => {
      const originalFindPartner = channelPartnerRepo.findById;
      const originalFindByPartnerId = channelPartnerPayoutRepo.findByPartnerId;

      channelPartnerRepo.findById = async (id) => (id === MOCK_PARTNER_ID_1 ? (mockPartnerRecord as any) : null);
      channelPartnerPayoutRepo.findByPartnerId = async () => ({
        items: [mockPayoutRecord as any],
        totalAmountPaid: 50000,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      try {
        const result = await channelPartnerPayoutService.getPayoutsByPartnerId(
          MOCK_PARTNER_ID_1,
          MOCK_ORGANIZATION_ID_1,
          1,
          10
        );
        expect(result.items.length).toBe(1);
        expect(result.pagination.total).toBe(1);

        let error: any = null;
        try {
          await channelPartnerPayoutService.getPayoutsByPartnerId("wrong-partner", MOCK_ORGANIZATION_ID_1);
        } catch (err) {
          error = err;
        }
        expect(error).toBeInstanceOf(ErrorResponse);
        expect(error.statusCode).toBe(statusCode.Not_Found);
      } finally {
        channelPartnerRepo.findById = originalFindPartner;
        channelPartnerPayoutRepo.findByPartnerId = originalFindByPartnerId;
      }
    });
  });
});

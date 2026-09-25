import { describe, it, expect } from "bun:test";
import {
  createChannelPartner,
  getChannelPartners,
  getChannelPartnerById,
  updateChannelPartner,
  deleteChannelPartner,
  uploadAvatar,
} from "../../src/module/channel-partner/controllers/channel-partner.controller.js";
import {
  createPayout,
  getPayouts,
  getPayoutById,
  getPayoutsByPartnerId,
} from "../../src/module/channel-partner/controllers/channel-partner-payout.controller.js";
import { channelPartnerService } from "../../src/module/channel-partner/services/channel-partner.service.js";
import { channelPartnerPayoutService } from "../../src/module/channel-partner/services/channel-partner-payout.service.js";
import { ErrorResponse } from "../../src/utils/response.util.js";
import { statusCode } from "../../src/types/types.js";
import {
  MOCK_ORGANIZATION_ID_1,
  MOCK_USER_ID,
  MOCK_PARTNER_ID_1,
  MOCK_PAYOUT_ID_1,
  mockPartnerRecord,
  mockPayoutRecord,
} from "./fixtures/channel-partner.fixtures.js";

/**
 * Creates mock Express Request and Response objects and executes an async controller handler
 */
async function invokeController(
  controllerFn: any,
  options: {
    user?: { id?: string; organizationId?: string } | null;
    body?: any;
    params?: any;
    query?: any;
    file?: any;
  }
) {
  const req: any = {
    user: "user" in options ? options.user : { id: MOCK_USER_ID, organizationId: MOCK_ORGANIZATION_ID_1 },
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    file: options.file,
  };

  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };

  let caughtError: any = null;

  await new Promise<void>((resolve) => {
    const next = (err?: any) => {
      if (err) caughtError = err;
      resolve();
    };

    try {
      const result = controllerFn(req, res, next);
      if (result && typeof result.then === "function") {
        result.then(() => resolve()).catch((err: any) => {
          caughtError = err;
          resolve();
        });
      } else {
        setTimeout(resolve, 20);
      }
    } catch (err) {
      caughtError = err;
      resolve();
    }
  });

  return { req, res, caughtError };
}

describe("Channel Partner Controllers Unit Tests", () => {
  // =========================================================================
  // 1. Channel Partner Controller Endpoints
  // =========================================================================
  describe("channel-partner.controller", () => {
    it("createChannelPartner: should return 201 Created on valid partner registration", async () => {
      const originalServiceCreate = channelPartnerService.createPartner;
      channelPartnerService.createPartner = async () => mockPartnerRecord as any;

      try {
        const { res, caughtError } = await invokeController(createChannelPartner, {
          body: {
            name: "Amit Patel",
            phone: "+919876543210",
            email: "amit.patel@example.com",
            companyName: "Patel Realty",
            defaultCommissionType: "PERCENTAGE",
            defaultCommissionValue: 5,
          },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.Created);
        expect(res.body.success).toBe(true);
        expect(res.body.data.name).toBe("Amit Patel");
      } finally {
        channelPartnerService.createPartner = originalServiceCreate;
      }
    });

    it("createChannelPartner: should pass 400 Bad_Request error to next() if organizationId context is missing", async () => {
      const { caughtError } = await invokeController(createChannelPartner, {
        user: undefined, // Missing user/org context
        body: {
          name: "Amit Patel",
          phone: "+919876543210",
        },
      });

      expect(caughtError).toBeInstanceOf(ErrorResponse);
      expect(caughtError.statusCode).toBe(statusCode.Bad_Request);
      expect(caughtError.message).toContain("Organization context required");
    });

    it("getChannelPartners: should return 200 OK with paginated list", async () => {
      const originalServiceGet = channelPartnerService.getPartners;
      channelPartnerService.getPartners = async () => ({
        items: [mockPartnerRecord as any],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      try {
        const { res, caughtError } = await invokeController(getChannelPartners, {
          query: { page: "1", limit: "10", search: "Patel" },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.success).toBe(true);
        expect(res.body.data.items.length).toBe(1);
      } finally {
        channelPartnerService.getPartners = originalServiceGet;
      }
    });

    it("getChannelPartnerById: should return 200 OK for existing partner", async () => {
      const originalServiceGetById = channelPartnerService.getPartnerById;
      channelPartnerService.getPartnerById = async () => mockPartnerRecord as any;

      try {
        const { res, caughtError } = await invokeController(getChannelPartnerById, {
          params: { id: MOCK_PARTNER_ID_1 },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.data.id).toBe(MOCK_PARTNER_ID_1);
      } finally {
        channelPartnerService.getPartnerById = originalServiceGetById;
      }
    });

    it("updateChannelPartner: should return 200 OK after updating partner details & status", async () => {
      const originalServiceUpdate = channelPartnerService.updatePartner;
      channelPartnerService.updatePartner = async (_id, _orgId, input) => ({
        ...mockPartnerRecord,
        ...input,
      } as any);

      try {
        const { res, caughtError } = await invokeController(updateChannelPartner, {
          params: { id: MOCK_PARTNER_ID_1 },
          body: {
            status: "INACTIVE",
            kycStatus: "VERIFIED",
            notes: "Updated compliance",
          },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.data.status).toBe("INACTIVE");
        expect(res.body.data.kycStatus).toBe("VERIFIED");
      } finally {
        channelPartnerService.updatePartner = originalServiceUpdate;
      }
    });

    it("deleteChannelPartner: should return 200 OK on soft deletion", async () => {
      const originalServiceDelete = channelPartnerService.deletePartner;
      channelPartnerService.deletePartner = async () => ({
        message: "Channel Partner deleted successfully",
      });

      try {
        const { res, caughtError } = await invokeController(deleteChannelPartner, {
          params: { id: MOCK_PARTNER_ID_1 },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.data.message).toContain("successfully");
      } finally {
        channelPartnerService.deletePartner = originalServiceDelete;
      }
    });

    it("uploadAvatar: should pass 400 Bad_Request to next() if file is not attached", async () => {
      const { caughtError } = await invokeController(uploadAvatar, {
        params: { id: MOCK_PARTNER_ID_1 },
        file: undefined,
      });

      expect(caughtError).toBeInstanceOf(ErrorResponse);
      expect(caughtError.statusCode).toBe(statusCode.Bad_Request);
      expect(caughtError.message).toContain("Avatar image file is required");
    });
  });

  // =========================================================================
  // 2. Channel Partner Payout Controller Endpoints
  // =========================================================================
  describe("channel-partner-payout.controller", () => {
    it("createPayout: should return 201 Created on valid disbursement", async () => {
      const originalServiceCreate = channelPartnerPayoutService.createPayout;
      channelPartnerPayoutService.createPayout = async () => mockPayoutRecord as any;

      try {
        const { res, caughtError } = await invokeController(createPayout, {
          body: {
            channelPartnerId: MOCK_PARTNER_ID_1,
            amount: 50000,
            paymentMode: "UPI",
            transactionReference: "UPI-REF-101",
          },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.Created);
        expect(res.body.data.amount).toBe(50000);
      } finally {
        channelPartnerPayoutService.createPayout = originalServiceCreate;
      }
    });

    it("getPayouts: should return 200 OK with payouts ledger list", async () => {
      const originalServiceGet = channelPartnerPayoutService.getPayouts;
      channelPartnerPayoutService.getPayouts = async () => ({
        items: [mockPayoutRecord as any],
        totalAmountPaid: 50000,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      try {
        const { res, caughtError } = await invokeController(getPayouts, {
          query: { page: "1", limit: "10" },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.data.items.length).toBe(1);
      } finally {
        channelPartnerPayoutService.getPayouts = originalServiceGet;
      }
    });

    it("getPayoutById: should return 200 OK for specific payout transaction", async () => {
      const originalServiceGetById = channelPartnerPayoutService.getPayoutById;
      channelPartnerPayoutService.getPayoutById = async () => mockPayoutRecord as any;

      try {
        const { res, caughtError } = await invokeController(getPayoutById, {
          params: { id: MOCK_PAYOUT_ID_1 },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.data.id).toBe(MOCK_PAYOUT_ID_1);
      } finally {
        channelPartnerPayoutService.getPayoutById = originalServiceGetById;
      }
    });

    it("getPayoutsByPartnerId: should return 200 OK for partner-specific payouts", async () => {
      const originalServiceGetPartner = channelPartnerPayoutService.getPayoutsByPartnerId;
      channelPartnerPayoutService.getPayoutsByPartnerId = async () => ({
        items: [mockPayoutRecord as any],
        totalAmountPaid: 50000,
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      try {
        const { res, caughtError } = await invokeController(getPayoutsByPartnerId, {
          params: { id: MOCK_PARTNER_ID_1 },
          query: { page: "1", limit: "5" },
        });

        expect(caughtError).toBeNull();
        expect(res.statusCode).toBe(statusCode.OK);
        expect(res.body.data.items.length).toBe(1);
      } finally {
        channelPartnerPayoutService.getPayoutsByPartnerId = originalServiceGetPartner;
      }
    });
  });
});

import { prisma } from "../../../lib/prisma.js";
import { channelPartnerRepo } from "../repos/channel-partner.repo.js";
import { channelPartnerPayoutRepo } from "../repos/channel-partner-payout.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateCPPayoutInput,
  GetCPPayoutsQueryInput,
} from "../validators/channel-partner-payout.validator.js";

/**
 * Service: Channel Partner Payouts & Finance Management
 * Handles disbursement recording, payment proof receipts, and financial queries
 */
export class ChannelPartnerPayoutService {
  /**
   * Create and record a new payout disbursement
   */
  async createPayout(
    organizationId: string,
    input: CreateCPPayoutInput,
    receiptFile?: Express.Multer.File,
    userId?: string
  ) {
    // Validate partner exists in this organization
    const partner = await channelPartnerRepo.findById(input.channelPartnerId, organizationId);
    if (!partner) {
      throw new ErrorResponse("Channel Partner not found in this organization", statusCode.Not_Found);
    }

    let receiptUrlJson = input.receiptUrl || undefined;

    // Upload receipt file if provided
    if (receiptFile) {
      const uploadResult = await storageService.upload(
        {
          buffer: receiptFile.buffer,
          originalname: receiptFile.originalname,
          mimetype: receiptFile.mimetype,
          size: receiptFile.size,
        },
        {
          folder: `homio/organizations/${organizationId}/channel-partners/payouts`,
        }
      );

      receiptUrlJson = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    let targetCpLeadId = input.cpLeadId || undefined;
    if (!targetCpLeadId && input.leadId) {
      const foundCpLead = await prisma.channelPartnerLead.findUnique({
        where: { leadId: input.leadId },
      });
      if (foundCpLead) {
        targetCpLeadId = foundCpLead.id;
      }
    }

    const payout = await channelPartnerPayoutRepo.create(organizationId, {
      channelPartnerId: input.channelPartnerId,
      leadId: input.leadId || undefined,
      cpLeadId: targetCpLeadId,
      amount: input.amount,
      paymentMode: input.paymentMode,
      transactionReference: input.transactionReference || undefined,
      status: input.status || "COMPLETED",
      paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
      remarks: input.remarks || undefined,
      receiptUrl: receiptUrlJson,
      processedById: userId || undefined,
      additionalInformation: input.additionalInformation || undefined,
    });

    // Update ChannelPartnerLead financial amounts and status if associated with a lead
    if (targetCpLeadId && (input.status === "COMPLETED" || !input.status)) {
      const existingCpLead = await prisma.channelPartnerLead.findUnique({
        where: { id: targetCpLeadId },
      });
      if (existingCpLead) {
        const currentPaid = Number(existingCpLead.commissionPaidAmount || 0);
        const payoutAmount = Number(input.amount);
        const newPaidAmount = currentPaid + payoutAmount;
        const commAmount = Number(existingCpLead.commissionAmount || 0);
        const newDueAmount = Math.max(0, commAmount - newPaidAmount);
        let newStatus = existingCpLead.commissionStatus;
        if (newDueAmount <= 0 && commAmount > 0) {
          newStatus = "PAID";
        } else if (newPaidAmount > 0) {
          newStatus = "PARTIALLY_PAID";
        }

        await prisma.channelPartnerLead.update({
          where: { id: targetCpLeadId },
          data: {
            commissionPaidAmount: newPaidAmount,
            commissionDueAmount: newDueAmount,
            commissionStatus: newStatus,
          },
        });
      }
    }

    return payout;
  }

  /**
   * Get paginated payouts for the organization
   */
  async getPayouts(organizationId: string, query: GetCPPayoutsQueryInput) {
    return channelPartnerPayoutRepo.findAll(organizationId, query);
  }

  /**
   * Get single payout by ID
   */
  async getPayoutById(id: string, organizationId: string) {
    const payout = await channelPartnerPayoutRepo.findById(id, organizationId);
    if (!payout) {
      throw new ErrorResponse("Payout transaction not found", statusCode.Not_Found);
    }
    return payout;
  }

  /**
   * Get payouts for a specific partner
   */
  async getPayoutsByPartnerId(partnerId: string, organizationId: string, page: number = 1, limit: number = 10) {
    const partner = await channelPartnerRepo.findById(partnerId, organizationId);
    if (!partner) {
      throw new ErrorResponse("Channel Partner not found", statusCode.Not_Found);
    }

    return channelPartnerPayoutRepo.findByPartnerId(partnerId, organizationId, page, limit);
  }
}

export const channelPartnerPayoutService = new ChannelPartnerPayoutService();

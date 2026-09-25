import { channelPartnerRepo } from "../repos/channel-partner.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type {
  CreateChannelPartnerInput,
  UpdateChannelPartnerInput,
  GetChannelPartnersQueryInput,
} from "../validators/channel-partner.validator.js";

/**
 * Service: Channel Partner Master Management
 * Implements business rules, uniqueness constraints, avatar upload, and lifecycle management
 */
export class ChannelPartnerService {
  /**
   * Register a new Channel Partner
   */
  async createPartner(organizationId: string, input: CreateChannelPartnerInput, userId?: string) {
    const normalizedPhone = input.phone.trim();

    // Tenant-scoped phone uniqueness validation
    const existing = await channelPartnerRepo.findByPhone(normalizedPhone, organizationId);
    if (existing) {
      throw new ErrorResponse("Channel Partner with this phone number already exists", statusCode.Conflict);
    }

    const partnerCode = await channelPartnerRepo.generatePartnerCode(organizationId);

    const partner = await channelPartnerRepo.create(organizationId, {
      ...input,
      phone: normalizedPhone,
      partnerCode,
      defaultCommissionValue: input.defaultCommissionValue ? input.defaultCommissionValue : null,
      bankDetails: input.bankDetails || undefined,
      kycDetails: input.kycDetails || undefined,
      additionalInformation: input.additionalInformation || undefined,
    });

    return partner;
  }

  /**
   * Fetch all Channel Partners for the organization
   */
  async getPartners(organizationId: string, query: GetChannelPartnersQueryInput) {
    return channelPartnerRepo.findAll(organizationId, query);
  }

  /**
   * Get single Channel Partner by ID
   */
  async getPartnerById(id: string, organizationId: string) {
    const partner = await channelPartnerRepo.findById(id, organizationId);
    if (!partner) {
      throw new ErrorResponse("Channel Partner not found", statusCode.Not_Found);
    }
    return partner;
  }

  /**
   * Update Channel Partner (dirty update, includes status & KYC status change)
   */
  async updatePartner(id: string, organizationId: string, input: UpdateChannelPartnerInput) {
    const existing = await channelPartnerRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Channel Partner not found", statusCode.Not_Found);
    }

    // Phone uniqueness check if changed
    if (input.phone && input.phone.trim() !== existing.phone) {
      const phoneTaken = await channelPartnerRepo.findByPhone(input.phone.trim(), organizationId);
      if (phoneTaken && phoneTaken.id !== id) {
        throw new ErrorResponse("Another Channel Partner is already registered with this phone number", statusCode.Conflict);
      }
    }

    const updated = await channelPartnerRepo.update(id, organizationId, {
      ...input,
      phone: input.phone ? input.phone.trim() : undefined,
      defaultCommissionValue: input.defaultCommissionValue !== undefined ? input.defaultCommissionValue : undefined,
      bankDetails: input.bankDetails !== undefined ? (input.bankDetails || undefined) : undefined,
      kycDetails: input.kycDetails !== undefined ? (input.kycDetails || undefined) : undefined,
      additionalInformation: input.additionalInformation !== undefined ? (input.additionalInformation || undefined) : undefined,
    });

    return updated;
  }

  /**
   * Soft delete Channel Partner
   */
  async deletePartner(id: string, organizationId: string) {
    const existing = await channelPartnerRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Channel Partner not found", statusCode.Not_Found);
    }

    await channelPartnerRepo.softDelete(id, organizationId);
    return { message: "Channel Partner deleted successfully" };
  }

  /**
   * Upload and link avatar image to Channel Partner profile
   */
  async uploadAvatar(id: string, organizationId: string, file: Express.Multer.File) {
    const existing = await channelPartnerRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Channel Partner not found", statusCode.Not_Found);
    }

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/channel-partners/avatars`,
        resourceType: "image",
      }
    );

    const updated = await channelPartnerRepo.update(id, organizationId, {
      avatarUrl: {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      },
    });

    return updated;
  }
}

export const channelPartnerService = new ChannelPartnerService();

import { leadDocumentRepo } from "../repos/lead-document.repo.js";
import { leadRepo } from "../repos/lead.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType, Prisma } from "../../../types/types.js";
import type { UploadLeadDocumentInput } from "../validators/lead-document.validator.js";

export class LeadDocumentService {
  /**
   * Upload and attach a document to a Lead
   */
  async uploadDocument(
    organizationId: string,
    leadId: string,
    input: UploadLeadDocumentInput,
    file: Express.Multer.File,
    uploadedById?: string | null
  ) {
    const lead = await leadRepo.findById(leadId, organizationId);
    if (!lead) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/leads/${leadId}/docs`,
        resourceType: "raw",
      }
    );

    const docFile: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };

    const doc = await leadDocumentRepo.create({
      organizationId,
      leadId,
      name: input.name,
      category: input.category || "OTHER",
      fileUrl: docFile as unknown as Prisma.InputJsonValue,
      uploadedById,
    });

    return doc;
  }

  /**
   * Get all documents attached to a lead
   */
  async getDocumentsByLeadId(leadId: string, organizationId: string) {
    const lead = await leadRepo.findById(leadId, organizationId);
    if (!lead) {
      throw new ErrorResponse("Lead not found", statusCode.Not_Found);
    }

    return leadDocumentRepo.findByLeadId(leadId, organizationId);
  }

  /**
   * Delete lead document
   */
  async deleteDocument(id: string, organizationId: string) {
    const existing = await leadDocumentRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Document not found", statusCode.Not_Found);
    }

    await leadDocumentRepo.delete(id, organizationId);
    return { message: "Document deleted successfully" };
  }
}

export const leadDocumentService = new LeadDocumentService();

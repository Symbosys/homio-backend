import { labourKycRepo } from "../repos/labour-kyc.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type { UpsertLabourKycInput, VerifyLabourKycInput } from "../validators/labour-kyc.validator.js";

/**
 * Labour KYC Service
 * Orchestrates cloud document lifecycle (uploads & automated pruning of replaced cloud files),
 * bank details management, and supervisor verification workflows.
 */
export class LabourKycService {
  /**
   * Helper: Safely deletes a previous cloud asset by public ID if it exists
   */
  private async pruneOldCloudAsset(oldDoc: unknown) {
    if (oldDoc && typeof oldDoc === "object" && "id" in (oldDoc as any)) {
      const publicId = (oldDoc as { id?: string }).id;
      if (publicId && typeof publicId === "string") {
        try {
          await storageService.delete(publicId);
        } catch (error) {
          console.error(`[LabourKycService] Failed to prune old cloud asset ${publicId}:`, error);
        }
      }
    }
  }

  /**
   * Helper: Uploads a multer file buffer to cloud storage and converts to ImageType
   */
  private async uploadToCloud(file: Express.Multer.File, folder: string): Promise<ImageType> {
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder }
    );

    return {
      id: uploadResult.publicId,
      url: uploadResult.url,
      bytes: uploadResult.bytes,
      format: uploadResult.format,
      provider: uploadResult.provider,
    };
  }

  /**
   * Get KYC details for a worker
   */
  async getKycDetails(labourId: string, organizationId: string) {
    const labour = await labourRepo.findById(labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour profile not found or unauthorized", statusCode.Not_Found);
    }
    return labourKycRepo.findByLabourId(labourId, organizationId);
  }

  /**
   * Upsert KYC documents: Uploads new files and PRUNES previous files from cloud
   */
  async upsertKyc(
    labourId: string,
    organizationId: string,
    payload: UpsertLabourKycInput,
    files?: { [fieldname: string]: Express.Multer.File[] }
  ) {
    // 1. Verify labour exists & belongs to tenant
    const labour = await labourRepo.findById(labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour profile not found or unauthorized", statusCode.Not_Found);
    }

    // 2. Fetch existing KYC document record to check for old files
    const existingKyc = await labourKycRepo.findByLabourId(labourId, organizationId);

    const updateData: any = { ...payload };

    // 3. Handle Aadhaar Document upload & old cloud file pruning
    if (files?.aadhaarDoc?.[0]) {
      if (existingKyc?.aadhaarDoc) {
        await this.pruneOldCloudAsset(existingKyc.aadhaarDoc);
      }
      updateData.aadhaarDoc = await this.uploadToCloud(files.aadhaarDoc[0], "homio/labour/kyc");
    }

    // 4. Handle Live Selfie Photo upload & old cloud file pruning
    if (files?.selfiePhoto?.[0]) {
      if (existingKyc?.selfiePhoto) {
        await this.pruneOldCloudAsset(existingKyc.selfiePhoto);
      }
      updateData.selfiePhoto = await this.uploadToCloud(files.selfiePhoto[0], "homio/labour/kyc");
    }

    // 5. Handle Police Clearance upload & old cloud file pruning
    if (files?.policeClearanceDoc?.[0]) {
      if (existingKyc?.policeClearanceDoc) {
        await this.pruneOldCloudAsset(existingKyc.policeClearanceDoc);
      }
      updateData.policeClearanceDoc = await this.uploadToCloud(
        files.policeClearanceDoc[0],
        "homio/labour/kyc"
      );
    }

    return labourKycRepo.upsert(labourId, updateData);
  }

  /**
   * Review and verify KYC status (Approve/Reject/Under Review)
   */
  async verifyKyc(labourId: string, organizationId: string, payload: VerifyLabourKycInput) {
    const labour = await labourRepo.findById(labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour profile not found or unauthorized", statusCode.Not_Found);
    }

    const existingKyc = await labourKycRepo.findByLabourId(labourId, organizationId);
    if (!existingKyc) {
      throw new ErrorResponse("KYC documents have not been submitted yet", statusCode.Bad_Request);
    }

    return labourKycRepo.updateVerificationStatus(labourId, payload);
  }

  /**
   * Delete a specific KYC document from cloud storage and database
   */
  async deleteKycDocument(
    labourId: string,
    organizationId: string,
    docType: "aadhaarDoc" | "selfiePhoto" | "policeClearanceDoc"
  ) {
    const existingKyc = await this.getKycDetails(labourId, organizationId);
    if (!existingKyc) {
      throw new ErrorResponse("KYC record not found", statusCode.Not_Found);
    }

    const docToDelete = (existingKyc as any)[docType];
    if (docToDelete) {
      await this.pruneOldCloudAsset(docToDelete);
    }

    return labourKycRepo.deleteDocumentField(labourId, docType);
  }
}

export const labourKycService = new LabourKycService();

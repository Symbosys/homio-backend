import { labourDisputeRepo } from "../repos/labour-dispute.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  CreateLabourDisputeInput,
  UpdateLabourDisputeInput,
  UpdateDisputeStatusInput,
  GetLabourDisputesQuery,
} from "../validators/labour-dispute.validator.js";

/**
 * Labour Dispute Service
 * Manages site and legal dispute cases, evidence docs, and settlements.
 */
export class LabourDisputeService {
  /**
   * Helper: Prunes old cloud documents
   */
  private async pruneOldCloudAssets(docs: unknown) {
    if (Array.isArray(docs)) {
      for (const doc of docs) {
        if (doc && typeof doc === "object" && "id" in doc && doc.id) {
          try {
            await storageService.delete(doc.id);
          } catch (error) {
            console.error(`[LabourDisputeService] Failed to prune evidence doc ${doc.id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Helper: Upload multiple files to cloud storage
   */
  private async uploadMultipleToCloud(
    files: Express.Multer.File[],
    folder: string
  ): Promise<ImageType[]> {
    const results: ImageType[] = [];
    for (const file of files) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        { folder }
      );
      results.push({
        id: uploadResult.publicId,
        url: uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      });
    }
    return results;
  }

  /**
   * Create dispute case
   */
  async createDispute(
    payload: CreateLabourDisputeInput,
    organizationId: string,
    files?: Express.Multer.File[]
  ) {
    const labour = await labourRepo.findById(payload.labourId, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    if (payload.bookingId) {
      const booking = await labourBookingRepo.findById(payload.bookingId, organizationId);
      if (!booking) {
        throw new ErrorResponse("Labour booking not found or unauthorized", statusCode.Not_Found);
      }
    }

    let evidenceDocs = payload.evidenceDocs || [];
    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = [...evidenceDocs, ...uploaded];
    }

    return labourDisputeRepo.create({
      ...payload,
      evidenceDocs,
    });
  }

  /**
   * Get dispute by ID
   */
  async getDisputeById(id: string, organizationId: string) {
    const dispute = await labourDisputeRepo.findById(id, organizationId);
    if (!dispute) {
      throw new ErrorResponse("Dispute case not found or unauthorized", statusCode.Not_Found);
    }
    return dispute;
  }

  /**
   * Get all paginated disputes
   */
  async getDisputes(query: GetLabourDisputesQuery, organizationId: string) {
    return labourDisputeRepo.findAll(query, organizationId);
  }

  /**
   * Update dispute case
   */
  async updateDispute(
    id: string,
    payload: UpdateLabourDisputeInput,
    organizationId: string,
    files?: Express.Multer.File[]
  ) {
    const existing = await this.getDisputeById(id, organizationId);

    let evidenceDocs = payload.evidenceDocs !== undefined ? payload.evidenceDocs : (existing.evidenceDocs as any) || [];

    if (files && files.length > 0) {
      const uploaded = await this.uploadMultipleToCloud(files, "homio/labour/disputes");
      evidenceDocs = Array.isArray(evidenceDocs) ? [...evidenceDocs, ...uploaded] : uploaded;
    }

    return labourDisputeRepo.update(id, {
      ...payload,
      evidenceDocs,
    });
  }

  /**
   * Update dispute status / resolution
   */
  async updateStatus(id: string, payload: UpdateDisputeStatusInput, organizationId: string) {
    await this.getDisputeById(id, organizationId);
    return labourDisputeRepo.update(id, payload);
  }

  /**
   * Delete dispute and prune cloud evidence docs
   */
  async deleteDispute(id: string, organizationId: string) {
    const existing = await this.getDisputeById(id, organizationId);
    if (existing.evidenceDocs) {
      await this.pruneOldCloudAssets(existing.evidenceDocs);
    }
    return labourDisputeRepo.delete(id);
  }
}

export const labourDisputeService = new LabourDisputeService();

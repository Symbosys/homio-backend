import { labourPaymentRepo } from "../repos/labour-payment.repo.js";
import { labourRepo } from "../repos/labour.repo.js";
import { labourBookingRepo } from "../repos/labour-booking.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  CreateLabourPaymentInput,
  UpdateLabourPaymentInput,
  GetLabourPaymentsQuery,
} from "../validators/labour-payment.validator.js";

/**
 * Labour Payment Service
 * Handles payout records, voucher receipt uploads & automatic cloud pruning upon update.
 */
export class LabourPaymentService {
  /**
   * Prunes an old cloud asset
   */
  private async pruneOldCloudAsset(oldDoc: unknown) {
    if (oldDoc && typeof oldDoc === "object" && "id" in (oldDoc as any)) {
      const publicId = (oldDoc as { id?: string }).id;
      if (publicId && typeof publicId === "string") {
        try {
          await storageService.delete(publicId);
        } catch (error) {
          console.error(`[LabourPaymentService] Failed to prune receipt ${publicId}:`, error);
        }
      }
    }
  }

  /**
   * Uploads receipt buffer to cloud storage
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
   * Create payment record
   */
  async createPayment(
    payload: CreateLabourPaymentInput,
    organizationId?: string | null,
    file?: Express.Multer.File,
    isPlatformAdmin?: boolean,
    requesterUserId?: string
  ) {
    let booking: any = null;
    if (payload.bookingId) {
      booking = await labourBookingRepo.findById(payload.bookingId);
      if (!booking) {
        throw new ErrorResponse("Labour booking not found or unauthorized", statusCode.Not_Found);
      }

      if (!isPlatformAdmin && !organizationId && requesterUserId) {
        const isClient = booking.clientId === requesterUserId;
        const isWorker = booking.labour?.userId === requesterUserId;
        if (!isClient && !isWorker) {
          throw new ErrorResponse("Unauthorized. You are neither the client nor worker for this booking.", statusCode.Forbidden);
        }
      }
    }

    // 1. Verify Labour belongs to tenant or platform or matches booking
    const labour = await labourRepo.findById(
      payload.labourId,
      isPlatformAdmin || booking ? undefined : organizationId || undefined
    );
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }

    // 2. Upload receipt photo if provided
    let receiptPhoto: ImageType | undefined;
    if (file) {
      receiptPhoto = await this.uploadToCloud(file, "homio/labour/payments");
    }

    return labourPaymentRepo.create({
      ...payload,
      ...(receiptPhoto && { receiptPhoto }),
    });
  }

  /**
   * Get single payment by ID
   */
  async getPaymentById(id: string, organizationId: string) {
    const payment = await labourPaymentRepo.findById(id, organizationId);
    if (!payment) {
      throw new ErrorResponse("Payment voucher not found or unauthorized", statusCode.Not_Found);
    }
    return payment;
  }

  /**
   * Get all paginated payments
   */
  async getPayments(query: GetLabourPaymentsQuery, organizationId?: string | null) {
    return labourPaymentRepo.findAll(query, organizationId);
  }

  /**
   * Update payment record (with cloud receipt pruning on replacement)
   */
  async updatePayment(
    id: string,
    payload: UpdateLabourPaymentInput,
    organizationId: string,
    file?: Express.Multer.File
  ) {
    const existing = await this.getPaymentById(id, organizationId);

    const updateData: any = { ...payload };

    if (file) {
      if (existing.receiptPhoto) {
        await this.pruneOldCloudAsset(existing.receiptPhoto);
      }
      updateData.receiptPhoto = await this.uploadToCloud(file, "homio/labour/payments");
    }

    return labourPaymentRepo.update(id, updateData);
  }

  /**
   * Quick status transition
   */
  async updateStatus(id: string, status: "PAID" | "PENDING" | "CANCELLED", organizationId: string) {
    await this.getPaymentById(id, organizationId);
    return labourPaymentRepo.update(id, { status });
  }

  /**
   * Delete payment record and prune cloud receipt
   */
  async deletePayment(id: string, organizationId: string) {
    const existing = await this.getPaymentById(id, organizationId);
    if (existing.receiptPhoto) {
      await this.pruneOldCloudAsset(existing.receiptPhoto);
    }
    return labourPaymentRepo.delete(id);
  }
}

export const labourPaymentService = new LabourPaymentService();

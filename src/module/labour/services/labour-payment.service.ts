import { prisma } from "../../../lib/prisma.js";
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
  GetLabourEarningsQuery,
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
          console.error(
            `[LabourPaymentService] Failed to prune receipt ${publicId}:`,
            error,
          );
        }
      }
    }
  }

  /**
   * Uploads receipt buffer to cloud storage
   */
  private async uploadToCloud(
    file: Express.Multer.File,
    folder: string,
  ): Promise<ImageType> {
    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      { folder },
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
    requesterUserId?: string,
  ) {
    let booking: any = null;
    if (payload.bookingId) {
      booking = await labourBookingRepo.findById(payload.bookingId);
      if (!booking) {
        throw new ErrorResponse(
          "Labour booking not found or unauthorized",
          statusCode.Not_Found,
        );
      }

      if (!isPlatformAdmin && !organizationId && requesterUserId) {
        const isClient = booking.clientId === requesterUserId;
        const isWorker = booking.labour?.userId === requesterUserId;
        if (!isClient && !isWorker) {
          throw new ErrorResponse(
            "Unauthorized. You are neither the client nor worker for this booking.",
            statusCode.Forbidden,
          );
        }
      }
    }

    // 1. Verify Labour belongs to tenant or platform or matches booking
    const labour = await labourRepo.findById(
      payload.labourId,
      isPlatformAdmin || booking ? undefined : organizationId || undefined,
    );
    if (!labour) {
      throw new ErrorResponse(
        "Labour not found or unauthorized",
        statusCode.Not_Found,
      );
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
      throw new ErrorResponse(
        "Payment voucher not found or unauthorized",
        statusCode.Not_Found,
      );
    }
    return payment;
  }

  /**
   * Get all paginated payments
   */
  async getPayments(
    query: GetLabourPaymentsQuery,
    organizationId?: string | null,
  ) {
    return labourPaymentRepo.findAll(query, organizationId);
  }

  /**
   * Update payment record (with cloud receipt pruning on replacement)
   */
  async updatePayment(
    id: string,
    payload: UpdateLabourPaymentInput,
    organizationId: string,
    file?: Express.Multer.File,
  ) {
    const existing = await this.getPaymentById(id, organizationId);

    const updateData: any = { ...payload };

    if (file) {
      if (existing.receiptPhoto) {
        await this.pruneOldCloudAsset(existing.receiptPhoto);
      }
      updateData.receiptPhoto = await this.uploadToCloud(
        file,
        "homio/labour/payments",
      );
    }

    return labourPaymentRepo.update(id, updateData);
  }

  /**
   * Quick status transition
   */
  async updateStatus(
    id: string,
    status: "PAID" | "PENDING" | "CANCELLED",
    organizationId: string,
  ) {
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

  /**
   * Get monthly earnings overview and transactions strictly for labour booking amounts paid by clients
   */
  async getWorkerMonthlyEarnings(
    actor: { id: string; userType?: string; organizationId?: string | null },
    query: GetLabourEarningsQuery,
  ) {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-indexed (1 to 12)

    const year = query.year ?? currentYear;
    const selectedMonth = query.month ?? currentMonth;

    const MONTH_NAMES = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const MONTH_SHORT_NAMES = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Resolve labour profile
    let targetLabourId = query.labourId;
    if (!targetLabourId) {
      const labour = await prisma.labour.findFirst({
        where: { userId: actor.id, isDeleted: false },
        select: { id: true, name: true, trade: true, dailyRate: true },
      });
      if (!labour) {
        throw new ErrorResponse(
          "No labour profile found linked to your account",
          statusCode.Not_Found,
        );
      }
      targetLabourId = labour.id;
    }

    const labourProfile = await prisma.labour.findUnique({
      where: { id: targetLabourId },
      select: { id: true, name: true, trade: true, dailyRate: true },
    });

    if (!labourProfile) {
      throw new ErrorResponse("Labour profile not found", statusCode.Not_Found);
    }

    // 1. Fetch entire year client payments for the month dropdown overview
    const startOfYear = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const yearPayments = await prisma.labourPayment.findMany({
      where: {
        labourId: targetLabourId,
        paymentDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
        status: "PAID",
      },
      select: {
        id: true,
        paymentDate: true,
        amount: true,
        bookingId: true,
        booking: {
          select: {
            channel: true,
            commissionRate: true,
          },
        },
      },
    });

    // Build 12 months overview for the dropdown (showing NET earnings after commission)
    const monthsOverview = Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const mPayments = yearPayments.filter((pmt) => {
        const d = new Date(pmt.paymentDate);
        return d.getUTCMonth() + 1 === m;
      });

      let monthGross = 0;
      let monthCommission = 0;
      let monthNet = 0;

      for (const pmt of mPayments) {
        const gross = Number(pmt.amount ?? 0);
        const rawRate =
          pmt.booking?.commissionRate != null
            ? Number(pmt.booking.commissionRate)
            : 0;
        const rate =
          rawRate > 0
            ? rawRate
            : pmt.booking?.channel === "ORGANIZATION_PROJECT"
              ? 0
              : 10;
        const comm = Math.round(((gross * rate) / 100) * 100) / 100;
        const net = Math.max(0, Math.round((gross - comm) * 100) / 100);

        monthGross += gross;
        monthCommission += comm;
        monthNet += net;
      }

      const uniqueBookings = new Set(
        mPayments.map((p) => p.bookingId).filter(Boolean),
      );

      return {
        month: m,
        monthName: MONTH_NAMES[idx],
        shortName: MONTH_SHORT_NAMES[idx],
        totalEarned: Math.round(monthNet * 100) / 100, // Net earnings after commission
        grossEarned: Math.round(monthGross * 100) / 100,
        commissionDeducted: Math.round(monthCommission * 100) / 100,
        transactionCount: mPayments.length,
        bookingsCount: uniqueBookings.size,
      };
    });

    // 2. Fetch detailed client booking payments for the selected month
    const startOfMonth = new Date(
      Date.UTC(year, selectedMonth - 1, 1, 0, 0, 0, 0),
    );
    const endOfMonth = new Date(
      Date.UTC(year, selectedMonth, 0, 23, 59, 59, 999),
    );

    const rawPayments = await prisma.labourPayment.findMany({
      where: {
        labourId: targetLabourId,
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            channel: true,
            serviceAddress: true,
            locality: true,
            city: true,
            state: true,
            totalBudget: true,
            dealValue: true,
            quoteAmount: true,
            totalPaid: true,
            commissionRate: true,
            commissionAmount: true,
            commissionStatus: true,
            commissionPaidAt: true,
            status: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    });

    // Enrich each transaction with commission breakdown
    const enrichedPayments = rawPayments.map((p) => {
      const grossAmount = Number(p.amount ?? 0);
      const rawRate =
        p.booking?.commissionRate != null
          ? Number(p.booking.commissionRate)
          : 0;
      const commissionRate =
        rawRate > 0
          ? rawRate
          : p.booking?.channel === "ORGANIZATION_PROJECT"
            ? 0
            : 10;
      const commissionDeducted = Math.round(((grossAmount * commissionRate) / 100) * 100) / 100;
      const netLabourEarned = Math.max(0, Math.round((grossAmount - commissionDeducted) * 100) / 100);

      return {
        ...p,
        grossAmount,
        commissionRate,
        commissionDeducted,
        netLabourEarned,
      };
    });

    const paidPayments = enrichedPayments.filter((p) => p.status === "PAID");
    const totalGrossPaid = paidPayments.reduce((sum, p) => sum + p.grossAmount, 0);
    const totalCommissionDeducted = paidPayments.reduce((sum, p) => sum + p.commissionDeducted, 0);
    const totalNetEarned = paidPayments.reduce((sum, p) => sum + p.netLabourEarned, 0);

    const pendingAmount = enrichedPayments
      .filter((p) => p.status === "PENDING")
      .reduce((sum, p) => sum + p.netLabourEarned, 0);

    const uniqueBookingIds = new Set(
      enrichedPayments.map((p) => p.bookingId).filter(Boolean),
    );
    const totalTransactions = enrichedPayments.length;
    const averageTransaction =
      paidPayments.length > 0
        ? Math.round((totalNetEarned / paidPayments.length) * 100) / 100
        : 0;

    return {
      year,
      selectedMonth,
      selectedMonthName: MONTH_NAMES[selectedMonth - 1],
      labour: {
        id: labourProfile.id,
        name: labourProfile.name,
        trade: labourProfile.trade,
        dailyRate: Number(labourProfile.dailyRate),
      },
      summary: {
        totalNetEarned: Math.round(totalNetEarned * 100) / 100, // Net money worker takes home
        totalGrossPaid: Math.round(totalGrossPaid * 100) / 100, // Total client paid
        totalCommissionDeducted: Math.round(totalCommissionDeducted * 100) / 100, // Commission paid
        totalEarned: Math.round(totalNetEarned * 100) / 100, // backward compatible alias
        pendingAmount: Math.round(pendingAmount * 100) / 100,
        totalBookingsCount: uniqueBookingIds.size,
        totalTransactions,
        averageTransaction,
      },
      monthsOverview,
      payments: enrichedPayments,
    };
  }
}

export const labourPaymentService = new LabourPaymentService();

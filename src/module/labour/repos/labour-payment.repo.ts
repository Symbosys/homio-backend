import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourPaymentsQuery } from "../validators/labour-payment.validator.js";

/**
 * Labour Payment Repository
 * Manages wage payouts, disbursement vouchers, and booking balance reconciliation.
 */
export class LabourPaymentRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Create payment record and atomically increment booking totalPaid if attached
   */
  async create(data: any) {
    const formattedData: any = {
      ...data,
      ...(data.receiptPhoto !== undefined && { receiptPhoto: this.formatJsonValue(data.receiptPhoto) }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.$transaction(async (tx) => {
      const payment = await tx.labourPayment.create({
        data: formattedData,
        include: {
          labour: {
            select: {
              id: true,
              name: true,
              phone: true,
              trade: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              workTitle: true,
              totalBudget: true,
              totalPaid: true,
            },
          },
        },
      });

      // If linked to booking and status is PAID, update booking totalPaid
      if (data.bookingId && data.status === "PAID") {
        await tx.labourBooking.update({
          where: { id: data.bookingId },
          data: {
            totalPaid: {
              increment: data.amount,
            },
          },
        });
      }

      return payment;
    });
  }

  /**
   * Find payment by ID with tenant verification
   */
  async findById(id: string, organizationId: string) {
    return prisma.labourPayment.findFirst({
      where: {
        id,
        labour: { organizationId },
      },
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            photoUrl: true,
            kycDocument: {
              select: {
                bankAccountNo: true,
                ifscCode: true,
                bankName: true,
                upiId: true,
              },
            },
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            totalBudget: true,
            totalPaid: true,
            project: {
              select: {
                id: true,
                name: true,
                projectCode: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find all paginated payments with filters
   */
  async findAll(query: GetLabourPaymentsQuery, organizationId: string) {
    const { page, limit, labourId, bookingId, paymentMethod, status, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LabourPaymentWhereInput = {
      labour: { organizationId },
      ...(labourId && { labourId }),
      ...(bookingId && { bookingId }),
      ...(paymentMethod && { paymentMethod }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            paymentDate: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [total, payments] = await Promise.all([
      prisma.labourPayment.count({ where }),
      prisma.labourPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: "desc" },
        include: {
          labour: {
            select: {
              id: true,
              name: true,
              phone: true,
              trade: true,
            },
          },
          booking: {
            select: {
              id: true,
              bookingNumber: true,
              workTitle: true,
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      payments,
    };
  }

  /**
   * Update payment record
   */
  async update(id: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.receiptPhoto !== undefined && { receiptPhoto: this.formatJsonValue(data.receiptPhoto) }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourPayment.update({
      where: { id },
      data: formattedData,
      include: {
        labour: {
          select: {
            id: true,
            name: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
          },
        },
      },
    });
  }

  /**
   * Delete payment record
   */
  async delete(id: string) {
    return prisma.labourPayment.delete({
      where: { id },
    });
  }
}

export const labourPaymentRepo = new LabourPaymentRepo();

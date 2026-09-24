import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourDisputesQuery } from "../validators/labour-dispute.validator.js";

/**
 * Labour Dispute Repository
 * Handles legal and site dispute case tracking, damages, and resolution.
 */
export class LabourDisputeRepo {
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Create dispute case
   */
  async create(data: any) {
    const formattedData: any = {
      ...data,
      ...(data.evidenceDocs !== undefined && { evidenceDocs: this.formatJsonValue(data.evidenceDocs) }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourDispute.create({
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
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Find dispute by ID with tenant verification
   */
  async findById(id: string, organizationId: string) {
    return prisma.labourDispute.findFirst({
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
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
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
   * List paginated disputes with filters
   */
  async findAll(query: GetLabourDisputesQuery, organizationId: string) {
    const { page, limit, labourId, bookingId, disputeType, status, initiator } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.LabourDisputeWhereInput = {
      labour: { organizationId },
      ...(labourId && { labourId }),
      ...(bookingId && { bookingId }),
      ...(disputeType && { disputeType }),
      ...(status && { status }),
      ...(initiator && { initiator }),
    };

    const [total, disputes] = await Promise.all([
      prisma.labourDispute.count({ where }),
      prisma.labourDispute.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          labour: {
            select: {
              id: true,
              name: true,
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
      disputes,
    };
  }

  /**
   * Update dispute case
   */
  async update(id: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.evidenceDocs !== undefined && { evidenceDocs: this.formatJsonValue(data.evidenceDocs) }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourDispute.update({
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
   * Delete dispute case
   */
  async delete(id: string) {
    return prisma.labourDispute.delete({
      where: { id },
    });
  }
}

export const labourDisputeRepo = new LabourDisputeRepo();

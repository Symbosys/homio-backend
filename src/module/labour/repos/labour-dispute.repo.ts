import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type { GetLabourDisputesQuery } from "../validators/labour-dispute.validator.js";

/**
 * Labour Dispute Repository
 * Handles legal and site dispute case tracking, damages, empanelled lawyers, and resolution.
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
      ...(data.legalNoticeDoc !== undefined && { legalNoticeDoc: this.formatJsonValue(data.legalNoticeDoc) }),
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
            averageRating: true,
            warningCount: true,
            isBlacklisted: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            channel: true,
            clientId: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                clientRating: true,
                clientDuesCount: true,
                isBlacklisted: true,
              },
            },
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
   * Find dispute by ID with optional tenant/client/worker verification
   */
  async findById(
    id: string,
    scope?: {
      organizationId?: string | null;
      clientId?: string | null;
      labourId?: string | null;
      isPlatformAdmin?: boolean;
    }
  ) {
    const andConditions: Prisma.LabourDisputeWhereInput[] = [{ id }];

    if (scope && !scope.isPlatformAdmin) {
      if (scope.organizationId) {
        andConditions.push({
          OR: [
            { labour: { organizationId: scope.organizationId } },
            { booking: { organizationId: scope.organizationId } },
          ],
        });
      }

      if (scope.clientId) {
        andConditions.push({ booking: { clientId: scope.clientId } });
      }

      if (scope.labourId) {
        andConditions.push({ labourId: scope.labourId });
      }
    }

    return prisma.labourDispute.findFirst({
      where: { AND: andConditions },
      include: {
        labour: {
          select: {
            id: true,
            name: true,
            phone: true,
            trade: true,
            photoUrl: true,
            averageRating: true,
            warningCount: true,
            isBlacklisted: true,
          },
        },
        booking: {
          select: {
            id: true,
            bookingNumber: true,
            workTitle: true,
            channel: true,
            clientId: true,
            client: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                clientRating: true,
                clientDuesCount: true,
                isBlacklisted: true,
              },
            },
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
  async findAll(
    query: GetLabourDisputesQuery,
    scope?: {
      organizationId?: string | null;
      clientId?: string | null;
      labourId?: string | null;
      isPlatformAdmin?: boolean;
    }
  ) {
    const { page, limit, labourId, bookingId, disputeType, status, initiator } = query;
    const skip = (page - 1) * limit;

    const andConditions: Prisma.LabourDisputeWhereInput[] = [];

    if (scope && !scope.isPlatformAdmin) {
      if (scope.organizationId) {
        andConditions.push({
          OR: [
            { labour: { organizationId: scope.organizationId } },
            { booking: { organizationId: scope.organizationId } },
          ],
        });
      }

      if (scope.clientId) {
        andConditions.push({ booking: { clientId: scope.clientId } });
      }

      if (scope.labourId) {
        andConditions.push({ labourId: scope.labourId });
      }
    }

    if (labourId) andConditions.push({ labourId });
    if (bookingId) andConditions.push({ bookingId });
    if (disputeType) andConditions.push({ disputeType });
    if (status) andConditions.push({ status });
    if (initiator) andConditions.push({ initiator });

    const where: Prisma.LabourDisputeWhereInput = { AND: andConditions };

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
      ...(data.legalNoticeDoc !== undefined && { legalNoticeDoc: this.formatJsonValue(data.legalNoticeDoc) }),
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

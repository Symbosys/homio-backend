import { prisma } from "../../../lib/prisma.js";
import { Prisma, type ImageType } from "../../../types/types.js";
import type {
  CreateWarrantyClaimInput,
  UpdateWarrantyClaimInput,
  ReviewWarrantyClaimInput,
  GetWarrantyClaimsQueryInput,
} from "../validators/claim.validator.js";

export class ClaimRepository {
  /**
   * Auto-generates sequential claim code (CLM-YYYY-NNNN)
   */
  async generateNextClaimNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CLM-${year}-`;

    const latest = await prisma.warrantyClaim.findFirst({
      where: {
        warranty: {
          project: { organizationId },
        },
        claimNumber: { startsWith: prefix },
      },
      orderBy: { claimNumber: "desc" },
      select: { claimNumber: true },
    });

    let nextSeq = 1;
    if (latest?.claimNumber) {
      const parts = latest.claimNumber.split("-");
      if (parts[2]) {
        const currentSeq = parseInt(parts[2], 10);
        if (!isNaN(currentSeq)) {
          nextSeq = currentSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, "0")}`;
  }

  /**
   * Create a new warranty claim
   */
  async create(
    organizationId: string,
    data: CreateWarrantyClaimInput,
    evidencePhotos?: ImageType[]
  ) {
    const claimNumber = await this.generateNextClaimNumber(organizationId);

    return prisma.warrantyClaim.create({
      data: {
        warrantyId: data.warrantyId,
        claimNumber,
        title: data.title,
        description: data.description,
        areaRoom: data.areaRoom,
        claimDate: data.claimDate ? new Date(data.claimDate) : new Date(),
        status: "SUBMITTED",
        evidencePhotos: evidencePhotos ? (evidencePhotos as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        additionalInformation: data.additionalInformation !== undefined ? (data.additionalInformation as Prisma.InputJsonValue) : undefined,
      },
      include: {
        warranty: {
          select: {
            id: true,
            warrantyNumber: true,
            category: true,
            title: true,
            status: true,
            projectId: true,
            project: { select: { id: true, name: true, projectCode: true } },
          },
        },
      },
    });
  }

  /**
   * Find claim by ID with tenant verification
   */
  async findById(organizationId: string, id: string) {
    return prisma.warrantyClaim.findFirst({
      where: {
        id,
        warranty: {
          project: { organizationId },
        },
        isDeleted: false,
      },
      include: {
        warranty: {
          include: {
            project: { select: { id: true, name: true, projectCode: true, customerId: true } },
          },
        },
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
        serviceRequest: {
          select: { id: true, requestNumber: true, status: true, priority: true },
        },
      },
    });
  }

  /**
   * List paginated warranty claims
   */
  async list(organizationId: string, query: GetWarrantyClaimsQueryInput) {
    const {
      warrantyId,
      projectId,
      status,
      reviewedById,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.WarrantyClaimWhereInput = {
      warranty: {
        project: {
          organizationId,
          ...(projectId && { id: projectId }),
        },
        ...(warrantyId && { id: warrantyId }),
      },
      isDeleted: false,
      ...(status && { status }),
      ...(reviewedById && { reviewedById }),
      ...(startDate && { claimDate: { gte: new Date(startDate) } }),
      ...(endDate && { claimDate: { lte: new Date(endDate) } }),
      ...(search && {
        OR: [
          { claimNumber: { contains: search, mode: "insensitive" } },
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { areaRoom: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      prisma.warrantyClaim.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warranty: {
            select: {
              id: true,
              warrantyNumber: true,
              category: true,
              title: true,
              project: { select: { id: true, name: true, projectCode: true } },
            },
          },
          reviewedBy: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          },
          serviceRequest: {
            select: { id: true, requestNumber: true, status: true },
          },
        },
      }),
      prisma.warrantyClaim.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update claim details & evidence photos
   */
  async update(
    organizationId: string,
    id: string,
    data: UpdateWarrantyClaimInput,
    evidencePhotos?: ImageType[]
  ) {
    return prisma.warrantyClaim.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.areaRoom !== undefined && { areaRoom: data.areaRoom }),
        ...(evidencePhotos !== undefined && {
          evidencePhotos: evidencePhotos as unknown as Prisma.InputJsonValue,
        }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Review claim (Approve/Reject)
   */
  async review(
    organizationId: string,
    id: string,
    reviewedById: string | null,
    data: ReviewWarrantyClaimInput
  ) {
    const amount = data.approvedCoverageAmount ?? data.coveredAmount;

    return prisma.warrantyClaim.update({
      where: { id },
      data: {
        status: data.status,
        reviewedById: reviewedById || null,
        reviewedAt: new Date(),
        ...(amount !== undefined && {
          approvedCoverageAmount: amount !== null ? new Prisma.Decimal(amount) : null,
        }),
        ...(data.rejectionReason !== undefined && { rejectionReason: data.rejectionReason }),
      },
      include: {
        reviewedBy: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        },
      },
    });
  }

  /**
   * Link service request to warranty claim
   */
  async linkServiceRequest(organizationId: string, claimId: string, serviceRequestId: string) {
    return prisma.warrantyClaim.update({
      where: { id: claimId },
      data: { serviceRequestId },
    });
  }

  /**
   * Soft delete warranty claim
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.warrantyClaim.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const claimRepository = new ClaimRepository();

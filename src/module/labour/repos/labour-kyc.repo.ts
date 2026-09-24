import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";

/**
 * Labour KYC Repository
 * Manages database operations for Labour KYC Documents and Verification records.
 */
export class LabourKycRepo {
  /**
   * Helper to format values for Prisma JSON columns safely handling null vs undefined vs JSON values.
   */
  private formatJsonValue(val: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (val === undefined) return undefined;
    if (val === null) return Prisma.JsonNull;
    return val as unknown as Prisma.InputJsonValue;
  }

  /**
   * Fetch KYC details for a given labour ID with tenant authorization check
   */
  async findByLabourId(labourId: string, organizationId: string) {
    const labour = await prisma.labour.findFirst({
      where: { id: labourId, organizationId, isDeleted: false },
      select: { id: true },
    });

    if (!labour) return null;

    return prisma.labourKycDocument.findUnique({
      where: { labourId },
    });
  }

  /**
   * Upsert Labour KYC document and banking details
   */
  async upsert(labourId: string, data: any) {
    const formattedData: any = {
      ...data,
      ...(data.aadhaarDoc !== undefined && { aadhaarDoc: this.formatJsonValue(data.aadhaarDoc) }),
      ...(data.selfiePhoto !== undefined && { selfiePhoto: this.formatJsonValue(data.selfiePhoto) }),
      ...(data.policeClearanceDoc !== undefined && {
        policeClearanceDoc: this.formatJsonValue(data.policeClearanceDoc),
      }),
      ...(data.additionalInformation !== undefined && {
        additionalInformation: this.formatJsonValue(data.additionalInformation),
      }),
    };

    return prisma.labourKycDocument.upsert({
      where: { labourId },
      create: {
        ...formattedData,
        labourId,
      },
      update: formattedData,
    });
  }

  /**
   * Update KYC Verification Status & Audit Fields
   */
  async updateVerificationStatus(labourId: string, data: any) {
    return prisma.labourKycDocument.update({
      where: { labourId },
      data: {
        ...data,
        verifiedAt: new Date(),
      },
    });
  }

  /**
   * Set specific document field to JsonNull when deleted
   */
  async deleteDocumentField(labourId: string, docType: "aadhaarDoc" | "selfiePhoto" | "policeClearanceDoc") {
    return prisma.labourKycDocument.update({
      where: { labourId },
      data: {
        [docType]: Prisma.JsonNull,
      },
    });
  }
}

export const labourKycRepo = new LabourKycRepo();

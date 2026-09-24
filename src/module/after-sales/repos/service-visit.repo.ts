import { prisma } from "../../../lib/prisma.js";
import { Prisma, type ImageType, ServiceVisitStatus } from "../../../types/types.js";
import type {
  CreateServiceVisitInput,
  UpdateServiceVisitInput,
  CheckInServiceVisitInput,
  SubmitWorkReportInput,
  SignOffServiceVisitInput,
  GetServiceVisitsQueryInput,
} from "../validators/service-visit.validator.js";

export class ServiceVisitRepository {
  /**
   * Auto-generates sequential visit code (SV-YYYY-NNNN)
   */
  async generateNextVisitNumber(organizationId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `SV-${year}-`;

    const latest = await prisma.afterSalesServiceVisit.findFirst({
      where: {
        project: { organizationId },
        visitNumber: { startsWith: prefix },
      },
      orderBy: { visitNumber: "desc" },
      select: { visitNumber: true },
    });

    let nextSeq = 1;
    if (latest?.visitNumber) {
      const parts = latest.visitNumber.split("-");
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
   * Create field service visit
   */
  async create(organizationId: string, data: CreateServiceVisitInput & { projectId: string }) {
    const visitNumber = await this.generateNextVisitNumber(organizationId);

    return prisma.afterSalesServiceVisit.create({
      data: {
        projectId: data.projectId,
        serviceRequestId: data.serviceRequestId,
        visitNumber,
        visitType: data.visitType || "CORRECTIVE_REPAIR",
        status: data.status || "SCHEDULED",
        scheduledDate: new Date(data.scheduledDate),
        startTime: data.startTime,
        endTime: data.endTime,
        assignedEmployeeId: data.assignedEmployeeId,
        contactPerson: data.contactPerson,
        contactNumber: data.contactNumber,
        specialInstructions: data.specialInstructions,
        additionalInformation: data.additionalInformation !== undefined ? (data.additionalInformation as Prisma.InputJsonValue) : undefined,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        serviceRequest: {
          select: { id: true, requestNumber: true, subject: true, priority: true },
        },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, workPhone: true },
        },
      },
    });
  }

  /**
   * Find visit by ID with tenant verification
   */
  async findById(organizationId: string, id: string) {
    return prisma.afterSalesServiceVisit.findFirst({
      where: {
        id,
        project: { organizationId },
        isDeleted: false,
      },
      include: {
        project: {
          select: { id: true, name: true, projectCode: true, customerId: true },
        },
        serviceRequest: {
          include: {
            category: true,
          },
        },
        assignedEmployee: {
          select: { id: true, firstName: true, lastName: true, employeeCode: true, workPhone: true, workEmail: true },
        },
        feedback: true,
      },
    });
  }

  /**
   * List paginated service visits
   */
  async list(organizationId: string, query: GetServiceVisitsQueryInput) {
    const {
      projectId,
      serviceRequestId,
      assignedEmployeeId,
      visitType,
      status,
      scheduledDate,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AfterSalesServiceVisitWhereInput = {
      project: { organizationId },
      isDeleted: false,
      ...(projectId && { projectId }),
      ...(serviceRequestId && { serviceRequestId }),
      ...(assignedEmployeeId && { assignedEmployeeId }),
      ...(visitType && { visitType }),
      ...(status && { status }),
      ...(scheduledDate && { scheduledDate: new Date(scheduledDate) }),
      ...(startDate && { scheduledDate: { gte: new Date(startDate) } }),
      ...(endDate && { scheduledDate: { lte: new Date(endDate) } }),
    };

    const [items, total] = await Promise.all([
      prisma.afterSalesServiceVisit.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
        include: {
          project: {
            select: { id: true, name: true, projectCode: true },
          },
          serviceRequest: {
            select: { id: true, requestNumber: true, subject: true },
          },
          assignedEmployee: {
            select: { id: true, firstName: true, lastName: true, employeeCode: true },
          },
        },
      }),
      prisma.afterSalesServiceVisit.count({ where }),
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
   * Partial update visit details
   */
  async update(organizationId: string, id: string, data: UpdateServiceVisitInput) {
    return prisma.afterSalesServiceVisit.update({
      where: { id },
      data: {
        ...(data.serviceRequestId !== undefined && { serviceRequestId: data.serviceRequestId }),
        ...(data.projectId !== undefined && { projectId: data.projectId }),
        ...(data.visitType !== undefined && { visitType: data.visitType }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.scheduledDate !== undefined && { scheduledDate: new Date(data.scheduledDate) }),
        ...(data.startTime !== undefined && { startTime: data.startTime }),
        ...(data.endTime !== undefined && { endTime: data.endTime }),
        ...(data.assignedEmployeeId !== undefined && { assignedEmployeeId: data.assignedEmployeeId }),
        ...(data.contactPerson !== undefined && { contactPerson: data.contactPerson }),
        ...(data.contactNumber !== undefined && { contactNumber: data.contactNumber }),
        ...(data.specialInstructions !== undefined && { specialInstructions: data.specialInstructions }),
        ...(data.additionalInformation !== undefined && {
          additionalInformation: data.additionalInformation as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Technician mobile check-in with GPS telemetry & photo
   */
  async checkIn(
    organizationId: string,
    id: string,
    data: CheckInServiceVisitInput,
    checkInPhotoUrl?: ImageType | null
  ) {
    return prisma.afterSalesServiceVisit.update({
      where: { id },
      data: {
        checkInAt: new Date(),
        status: "IN_PROGRESS",
        checkInLatitude: new Prisma.Decimal(data.checkInLatitude),
        checkInLongitude: new Prisma.Decimal(data.checkInLongitude),
        checkInAddress: data.checkInAddress,
        ...(checkInPhotoUrl && {
          checkInPhotoUrl: checkInPhotoUrl as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Field work report submission
   */
  async submitWorkReport(
    organizationId: string,
    id: string,
    data: SubmitWorkReportInput,
    beforePhotoUrls?: ImageType[],
    afterPhotoUrls?: ImageType[]
  ) {
    return prisma.afterSalesServiceVisit.update({
      where: { id },
      data: {
        diagnosisNotes: data.diagnosisNotes,
        workPerformed: data.workPerformed,
        materialsUsed: data.materialsUsed,
        labourHours: data.labourHours !== undefined ? new Prisma.Decimal(data.labourHours) : undefined,
        ...(beforePhotoUrls && {
          beforePhotoUrls: beforePhotoUrls as unknown as Prisma.InputJsonValue,
        }),
        ...(afterPhotoUrls && {
          afterPhotoUrls: afterPhotoUrls as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Client digital touch sign-off & CSAT rating
   */
  async signOff(
    organizationId: string,
    id: string,
    data: SignOffServiceVisitInput,
    customerSignatureUrl?: ImageType | null
  ) {
    return prisma.afterSalesServiceVisit.update({
      where: { id },
      data: {
        status: "COMPLETED",
        clientConfirmedAt: new Date(),
        customerSignatureName: data.customerSignatureName,
        rating: data.rating !== undefined && data.rating !== null ? new Prisma.Decimal(data.rating) : undefined,
        ...(customerSignatureUrl && {
          customerSignatureUrl: customerSignatureUrl as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  /**
   * Update status
   */
  async updateStatus(organizationId: string, id: string, status: ServiceVisitStatus) {
    return prisma.afterSalesServiceVisit.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Soft delete visit
   */
  async softDelete(organizationId: string, id: string) {
    return prisma.afterSalesServiceVisit.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const serviceVisitRepository = new ServiceVisitRepository();

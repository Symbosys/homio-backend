import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../types/types.js";
import type {
  CreateProjectInput,
  GetProjectsQueryInput,
  UpdateProjectInput
} from "../validators/project.validator.js";

export class ProjectRepository {
  /**
   * Auto-generate sequential, tenant-scoped Project Code e.g. "PRJ-2026-0001"
   */
  async generateProjectCode(organizationId: string, tx?: Prisma.TransactionClient): Promise<string> {
    const db = tx || prisma;
    const currentYear = new Date().getFullYear();
    const prefix = `PRJ-${currentYear}-`;

    const latestProject = await db.project.findFirst({
      where: {
        organizationId,
        projectCode: { startsWith: prefix },
      },
      orderBy: { projectCode: "desc" },
      select: { projectCode: true },
    });

    let nextNumber = 1;
    if (latestProject?.projectCode) {
      const parts = latestProject.projectCode.split("-");
      const seqStr = parts[2];
      if (seqStr) {
        const lastSeq = parseInt(seqStr, 10);
        if (!isNaN(lastSeq)) {
          nextNumber = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(nextNumber).padStart(4, "0")}`;
  }

  /**
   * Create a Project with its segregated sub-components in an atomic transaction
   */
  async create(
    organizationId: string,
    data: CreateProjectInput & { projectCode: string },
    createdById?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    const {
      site,
      schedule,
      metric,
      commercial,
      members,
      coverImageUrl,
      customFields,
      additionalInformation,
      stageStatuses,
      tags,
      client,
      clientAlternatePhone,
      clientAlternateRelation,
      clientPan,
      clientAadhaar,
      ...coreFields
    } = data;

    return db.project.create({
      data: {
        ...coreFields,
        organizationId,
        createdById: createdById || null,
        coverImageUrl: coverImageUrl ? (coverImageUrl as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        customFields: customFields ? (customFields as Prisma.InputJsonValue) : Prisma.JsonNull,
        stageStatuses: stageStatuses ? (stageStatuses as Prisma.InputJsonValue) : Prisma.JsonNull,
        additionalInformation: additionalInformation ? (additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull,
        tags: tags || [],

        // 1-to-1 Site details
        site: site
          ? {
              create: {
                siteName: site.siteName || null,
                address: site.address || null,
                city: site.city || null,
                state: site.state || null,
                country: site.country || "IN",
                pincode: site.pincode || null,
                gpsLat: site.gpsLat || null,
                gpsLng: site.gpsLng || null,
                propertyType: site.propertyType || null,
                floorNumber: site.floorNumber || null,
                totalAreaSqft: site.totalAreaSqft || null,
                workableAreaSqft: site.workableAreaSqft || null,
                carpetAreaSqft: site.carpetAreaSqft || null,
                contactPerson: site.contactPerson || null,
                contactPersonRelation: site.contactPersonRelation || null,
                contactPhone: site.contactPhone || null,
                contactEmail: site.contactEmail || null,
                accessInstructions: site.accessInstructions || null,
                additionalInformation: site.additionalInformation ? (site.additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull,
              },
            }
          : undefined,

        // 1-to-1 Schedule details
        schedule: schedule
          ? {
              create: {
                plannedStartDate: new Date(schedule.plannedStartDate),
                plannedEndDate: new Date(schedule.plannedEndDate),
                actualStartDate: schedule.actualStartDate ? new Date(schedule.actualStartDate) : null,
                actualEndDate: schedule.actualEndDate ? new Date(schedule.actualEndDate) : null,
                kickoffDate: schedule.kickoffDate ? new Date(schedule.kickoffDate) : null,
                siteHandoverDate: schedule.siteHandoverDate ? new Date(schedule.siteHandoverDate) : null,
                warrantyStartDate: schedule.warrantyStartDate ? new Date(schedule.warrantyStartDate) : null,
                warrantyEndDate: schedule.warrantyEndDate ? new Date(schedule.warrantyEndDate) : null,
                extendedWarrantyEndDate: schedule.extendedWarrantyEndDate
                  ? new Date(schedule.extendedWarrantyEndDate)
                  : null,
                estimatedDurationDays: schedule.estimatedDurationDays ?? null,
                actualDurationDays: schedule.actualDurationDays ?? null,
                additionalInformation: schedule.additionalInformation ? (schedule.additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull,
              },
            }
          : undefined,

        // 1-to-1 Metrics & Quality Scores
        metric: metric
          ? {
              create: {
                progressPercent: metric.progressPercent ?? 0,
                designProgress: metric.designProgress ?? 0,
                executionProgress: metric.executionProgress ?? 0,
                procurementProgress: metric.procurementProgress ?? 0,
                paymentProgress: metric.paymentProgress ?? 0,
                qualityScore: metric.qualityScore ?? null,
                safetyScore: metric.safetyScore ?? null,
                lastEvaluatedAt: metric.lastEvaluatedAt ? new Date(metric.lastEvaluatedAt) : null,
                additionalInformation: metric.additionalInformation ? (metric.additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull,
              },
            }
          : undefined,

        // 1-to-1 Financials & Commercials
        commercial: commercial
          ? {
              create: {
                currency: commercial.currency || "INR",
                pricingModel: commercial.pricingModel || "TURNKEY_WITH_MATERIALS",
                contractAmount: new Prisma.Decimal(commercial.contractAmount ?? 0),
                initialEstimate: new Prisma.Decimal(commercial.initialEstimate ?? 0),
                revisedEstimate: new Prisma.Decimal(commercial.revisedEstimate ?? 0),
                designFee: new Prisma.Decimal(commercial.designFee ?? 0),
                materialPayment: new Prisma.Decimal(commercial.materialPayment ?? 0),
                labourPayment: new Prisma.Decimal(commercial.labourPayment ?? 0),
                supervisionFee: new Prisma.Decimal(commercial.supervisionFee ?? 0),
                consultingPercentage: commercial.consultingPercentage !== undefined ? commercial.consultingPercentage : null,
                consultingLumpSum:
                  commercial.consultingLumpSum !== undefined && commercial.consultingLumpSum !== null
                    ? new Prisma.Decimal(commercial.consultingLumpSum)
                    : null,
                consultingRateSqft:
                  commercial.consultingRateSqft !== undefined && commercial.consultingRateSqft !== null
                    ? new Prisma.Decimal(commercial.consultingRateSqft)
                    : null,
                billableAreaSqft: commercial.billableAreaSqft !== undefined ? commercial.billableAreaSqft : null,
                additionalInformation: commercial.additionalInformation
                  ? (commercial.additionalInformation as Prisma.InputJsonValue)
                  : Prisma.JsonNull,
              },
            }
          : undefined,

        // 1-to-Many Dynamic Team Members
        members: members && members.length > 0
          ? {
              create: members.map((m) => ({
                employeeId: m.employeeId,
                role: m.role || "OTHER",
                customRoleTitle: m.customRoleTitle || null,
                responsibilities: m.responsibilities || null,
                isPrimary: m.isPrimary ?? false,
                isActive: m.isActive ?? true,
                allocatedHoursPerWeek: m.allocatedHoursPerWeek ?? null,
                assignedById: createdById || null,
                additionalInformation: m.additionalInformation ? (m.additionalInformation as Prisma.InputJsonValue) : Prisma.JsonNull,
              })),
            }
          : undefined,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
          },
        },
        serviceCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            color: true,
            icon: true,
          },
        },
        site: true,
        schedule: true,
        metric: true,
        commercial: true,
        members: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatarUrl: true,
                workEmail: true,
                workPhone: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get single project by ID with tenant isolation check and all child relations
   */
  async findById(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.project.findFirst({
      where: {
        id,
        organizationId,
        isDeleted: false,
      },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerType: true,
            salutation: true,
            firstName: true,
            lastName: true,
            displayName: true,
            phone: true,
            alternatePhone: true,
            alternateContactRelation: true,
            email: true,
            companyName: true,
            gstin: true,
            panNumber: true,
            aadhaarNumber: true,
            billingAddress: true,
            billingCity: true,
            billingState: true,
            billingCountry: true,
            billingPincode: true,
            avatarUrl: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
            source: true,
            priority: true,
          },
        },
        serviceCategory: {
          select: {
            id: true,
            name: true,
            slug: true,
            code: true,
            color: true,
            icon: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        site: true,
        schedule: true,
        metric: true,
        commercial: true,
        members: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatarUrl: true,
                workEmail: true,
                workPhone: true,
              },
            },
            assignedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  /**
   * Find paginated projects with full text search, multiple filters, and sorting
   */
  async findAll(organizationId: string, query: GetProjectsQueryInput, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    const {
      page = 1,
      limit = 20,
      search,
      status,
      health,
      designStatus,
      executionStatus,
      currentStage,
      priority,
      type,
      customerId,
      leadId,
      employeeId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      organizationId,
      isDeleted: false,
      ...(status ? { status } : {}),
      ...(designStatus ? { designStatus } : {}),
      ...(executionStatus ? { executionStatus } : {}),
      ...(health ? { health } : {}),
      ...(currentStage ? { currentStage } : {}),
      ...(priority ? { priority } : {}),
      ...(type ? { type } : {}),
      ...(customerId ? { customerId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(employeeId ? { members: { some: { employeeId, isActive: true } } } : {}),
    };

    if (search && search.trim() !== "") {
      const term = search.trim();
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { projectCode: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { category: { contains: term, mode: "insensitive" } },
        { site: { siteName: { contains: term, mode: "insensitive" } } },
        { site: { city: { contains: term, mode: "insensitive" } } },
        { site: { address: { contains: term, mode: "insensitive" } } },
        { customer: { firstName: { contains: term, mode: "insensitive" } } },
        { customer: { lastName: { contains: term, mode: "insensitive" } } },
        { customer: { displayName: { contains: term, mode: "insensitive" } } },
        { customer: { companyName: { contains: term, mode: "insensitive" } } },
      ];
    }

    const [total, projects] = await Promise.all([
      db.project.count({ where }),
      db.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          customer: {
            select: {
              id: true,
              customerCode: true,
              customerType: true,
              salutation: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              alternatePhone: true,
              alternateContactRelation: true,
              email: true,
              companyName: true,
              gstin: true,
              panNumber: true,
              aadhaarNumber: true,
              billingAddress: true,
              billingCity: true,
              billingState: true,
              billingCountry: true,
              billingPincode: true,
              avatarUrl: true,
            },
          },
          lead: {
            select: {
              id: true,
              leadCode: true,
              title: true,
              status: true,
            },
          },
          serviceCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              code: true,
              color: true,
              icon: true,
            },
          },
          site: true,
          schedule: true,
          metric: true,
          commercial: true,
          members: {
            where: { isActive: true },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeCode: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data: projects,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * Update a project and any/all of its segregated sub-components transactionally
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateProjectInput,
    updatedById?: string,
    tx?: Prisma.TransactionClient
  ) {
    const db = tx || prisma;

    const {
      site,
      schedule,
      metric,
      commercial,
      members,
      coverImageUrl,
      customFields,
      tags,
      additionalInformation,
      stageStatuses,
      client,
      clientAlternatePhone,
      clientAlternateRelation,
      clientPan,
      clientAadhaar,
      ...coreFields
    } = data;

    // Prepare core update data
    const projectUpdateData: Prisma.ProjectUpdateInput = {
      ...coreFields,
      updatedAt: new Date(),
    };

    if (coverImageUrl !== undefined) {
      projectUpdateData.coverImageUrl = coverImageUrl
        ? (coverImageUrl as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (customFields !== undefined) {
      projectUpdateData.customFields = customFields
        ? (customFields as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (stageStatuses !== undefined) {
      projectUpdateData.stageStatuses = stageStatuses
        ? (stageStatuses as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }
    if (tags !== undefined) {
      projectUpdateData.tags = tags;
    }
    if (additionalInformation !== undefined) {
      projectUpdateData.additionalInformation = additionalInformation
        ? (additionalInformation as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    // 1-to-1 Site upsert
    if (site !== undefined) {
      if (site === null) {
        projectUpdateData.site = { delete: true };
      } else {
        projectUpdateData.site = {
          upsert: {
            create: {
              siteName: site.siteName || null,
              address: site.address || null,
              city: site.city || null,
              state: site.state || null,
              country: site.country || "IN",
              pincode: site.pincode || null,
              gpsLat: site.gpsLat || null,
              gpsLng: site.gpsLng || null,
              propertyType: site.propertyType || null,
              floorNumber: site.floorNumber || null,
              totalAreaSqft: site.totalAreaSqft || null,
              workableAreaSqft: site.workableAreaSqft || null,
              carpetAreaSqft: site.carpetAreaSqft || null,
              contactPerson: site.contactPerson || null,
              contactPersonRelation: site.contactPersonRelation || null,
              contactPhone: site.contactPhone || null,
              contactEmail: site.contactEmail || null,
              accessInstructions: site.accessInstructions || null,
              additionalInformation: site.additionalInformation
                ? (site.additionalInformation as Prisma.InputJsonValue)
                : Prisma.JsonNull,
            },
            update: {
              ...(site.siteName !== undefined ? { siteName: site.siteName } : {}),
              ...(site.address !== undefined ? { address: site.address } : {}),
              ...(site.city !== undefined ? { city: site.city } : {}),
              ...(site.state !== undefined ? { state: site.state } : {}),
              ...(site.country !== undefined ? { country: site.country } : {}),
              ...(site.pincode !== undefined ? { pincode: site.pincode } : {}),
              ...(site.gpsLat !== undefined ? { gpsLat: site.gpsLat } : {}),
              ...(site.gpsLng !== undefined ? { gpsLng: site.gpsLng } : {}),
              ...(site.propertyType !== undefined ? { propertyType: site.propertyType } : {}),
              ...(site.floorNumber !== undefined ? { floorNumber: site.floorNumber } : {}),
              ...(site.totalAreaSqft !== undefined ? { totalAreaSqft: site.totalAreaSqft } : {}),
              ...(site.workableAreaSqft !== undefined ? { workableAreaSqft: site.workableAreaSqft } : {}),
              ...(site.carpetAreaSqft !== undefined ? { carpetAreaSqft: site.carpetAreaSqft } : {}),
              ...(site.contactPerson !== undefined ? { contactPerson: site.contactPerson } : {}),
              ...(site.contactPersonRelation !== undefined ? { contactPersonRelation: site.contactPersonRelation } : {}),
              ...(site.contactPhone !== undefined ? { contactPhone: site.contactPhone } : {}),
              ...(site.contactEmail !== undefined ? { contactEmail: site.contactEmail } : {}),
              ...(site.accessInstructions !== undefined ? { accessInstructions: site.accessInstructions } : {}),
              ...(site.additionalInformation !== undefined
                ? {
                    additionalInformation: site.additionalInformation
                      ? (site.additionalInformation as Prisma.InputJsonValue)
                      : Prisma.JsonNull,
                  }
                : {}),
            },
          },
        };
      }
    }

    // 1-to-1 Schedule upsert
    if (schedule !== undefined) {
      if (schedule === null) {
        projectUpdateData.schedule = { delete: true };
      } else {
        const scheduleCreateData = {
          plannedStartDate: schedule.plannedStartDate ? new Date(schedule.plannedStartDate) : new Date(),
          plannedEndDate: schedule.plannedEndDate ? new Date(schedule.plannedEndDate) : new Date(),
          actualStartDate: schedule.actualStartDate ? new Date(schedule.actualStartDate) : null,
          actualEndDate: schedule.actualEndDate ? new Date(schedule.actualEndDate) : null,
          kickoffDate: schedule.kickoffDate ? new Date(schedule.kickoffDate) : null,
          siteHandoverDate: schedule.siteHandoverDate ? new Date(schedule.siteHandoverDate) : null,
          warrantyStartDate: schedule.warrantyStartDate ? new Date(schedule.warrantyStartDate) : null,
          warrantyEndDate: schedule.warrantyEndDate ? new Date(schedule.warrantyEndDate) : null,
          extendedWarrantyEndDate: schedule.extendedWarrantyEndDate
            ? new Date(schedule.extendedWarrantyEndDate)
            : null,
          estimatedDurationDays: schedule.estimatedDurationDays ?? null,
          actualDurationDays: schedule.actualDurationDays ?? null,
          additionalInformation: schedule.additionalInformation
            ? (schedule.additionalInformation as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };

        const scheduleUpdateData: Prisma.ProjectScheduleUpdateInput = {};
        if (schedule.plannedStartDate !== undefined)
          scheduleUpdateData.plannedStartDate = new Date(schedule.plannedStartDate);
        if (schedule.plannedEndDate !== undefined)
          scheduleUpdateData.plannedEndDate = new Date(schedule.plannedEndDate);
        if (schedule.actualStartDate !== undefined)
          scheduleUpdateData.actualStartDate = schedule.actualStartDate ? new Date(schedule.actualStartDate) : null;
        if (schedule.actualEndDate !== undefined)
          scheduleUpdateData.actualEndDate = schedule.actualEndDate ? new Date(schedule.actualEndDate) : null;
        if (schedule.kickoffDate !== undefined)
          scheduleUpdateData.kickoffDate = schedule.kickoffDate ? new Date(schedule.kickoffDate) : null;
        if (schedule.siteHandoverDate !== undefined)
          scheduleUpdateData.siteHandoverDate = schedule.siteHandoverDate ? new Date(schedule.siteHandoverDate) : null;
        if (schedule.warrantyStartDate !== undefined)
          scheduleUpdateData.warrantyStartDate = schedule.warrantyStartDate ? new Date(schedule.warrantyStartDate) : null;
        if (schedule.warrantyEndDate !== undefined)
          scheduleUpdateData.warrantyEndDate = schedule.warrantyEndDate ? new Date(schedule.warrantyEndDate) : null;
        if (schedule.extendedWarrantyEndDate !== undefined)
          scheduleUpdateData.extendedWarrantyEndDate = schedule.extendedWarrantyEndDate
            ? new Date(schedule.extendedWarrantyEndDate)
            : null;
        if (schedule.estimatedDurationDays !== undefined)
          scheduleUpdateData.estimatedDurationDays = schedule.estimatedDurationDays;
        if (schedule.actualDurationDays !== undefined)
          scheduleUpdateData.actualDurationDays = schedule.actualDurationDays;
        if (schedule.additionalInformation !== undefined)
          scheduleUpdateData.additionalInformation = schedule.additionalInformation
            ? (schedule.additionalInformation as Prisma.InputJsonValue)
            : Prisma.JsonNull;

        projectUpdateData.schedule = {
          upsert: {
            create: scheduleCreateData,
            update: scheduleUpdateData,
          },
        };
      }
    }

    // 1-to-1 Metric upsert
    if (metric !== undefined) {
      if (metric === null) {
        projectUpdateData.metric = { delete: true };
      } else {
        const metricCreateData = {
          progressPercent: metric.progressPercent ?? 0,
          designProgress: metric.designProgress ?? 0,
          executionProgress: metric.executionProgress ?? 0,
          procurementProgress: metric.procurementProgress ?? 0,
          paymentProgress: metric.paymentProgress ?? 0,
          qualityScore: metric.qualityScore ?? null,
          safetyScore: metric.safetyScore ?? null,
          lastEvaluatedAt: metric.lastEvaluatedAt ? new Date(metric.lastEvaluatedAt) : null,
          additionalInformation: metric.additionalInformation
            ? (metric.additionalInformation as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };

        const metricUpdateData: Prisma.ProjectMetricUpdateInput = {};
        if (metric.progressPercent !== undefined) metricUpdateData.progressPercent = metric.progressPercent;
        if (metric.designProgress !== undefined) metricUpdateData.designProgress = metric.designProgress;
        if (metric.executionProgress !== undefined) metricUpdateData.executionProgress = metric.executionProgress;
        if (metric.procurementProgress !== undefined) metricUpdateData.procurementProgress = metric.procurementProgress;
        if (metric.paymentProgress !== undefined) metricUpdateData.paymentProgress = metric.paymentProgress;
        if (metric.qualityScore !== undefined) metricUpdateData.qualityScore = metric.qualityScore;
        if (metric.safetyScore !== undefined) metricUpdateData.safetyScore = metric.safetyScore;
        if (metric.lastEvaluatedAt !== undefined)
          metricUpdateData.lastEvaluatedAt = metric.lastEvaluatedAt ? new Date(metric.lastEvaluatedAt) : null;
        if (metric.additionalInformation !== undefined)
          metricUpdateData.additionalInformation = metric.additionalInformation
            ? (metric.additionalInformation as Prisma.InputJsonValue)
            : Prisma.JsonNull;

        projectUpdateData.metric = {
          upsert: {
            create: metricCreateData,
            update: metricUpdateData,
          },
        };
      }
    }

    // 1-to-1 Commercial upsert
    if (commercial !== undefined) {
      if (commercial === null) {
        projectUpdateData.commercial = { delete: true };
      } else {
        const commercialCreateData: Prisma.ProjectCommercialCreateWithoutProjectInput = {
          currency: commercial.currency || "INR",
          pricingModel: commercial.pricingModel || "TURNKEY_WITH_MATERIALS",
          contractAmount: new Prisma.Decimal(commercial.contractAmount ?? 0),
          initialEstimate: new Prisma.Decimal(commercial.initialEstimate ?? 0),
          revisedEstimate: new Prisma.Decimal(commercial.revisedEstimate ?? 0),
          designFee: new Prisma.Decimal(commercial.designFee ?? 0),
          materialPayment: new Prisma.Decimal(commercial.materialPayment ?? 0),
          labourPayment: new Prisma.Decimal(commercial.labourPayment ?? 0),
          supervisionFee: new Prisma.Decimal(commercial.supervisionFee ?? 0),
          consultingPercentage: commercial.consultingPercentage !== undefined ? commercial.consultingPercentage : null,
          consultingLumpSum:
            commercial.consultingLumpSum !== undefined && commercial.consultingLumpSum !== null
              ? new Prisma.Decimal(commercial.consultingLumpSum)
              : null,
          consultingRateSqft:
            commercial.consultingRateSqft !== undefined && commercial.consultingRateSqft !== null
              ? new Prisma.Decimal(commercial.consultingRateSqft)
              : null,
          billableAreaSqft: commercial.billableAreaSqft !== undefined ? commercial.billableAreaSqft : null,
          additionalInformation: commercial.additionalInformation
            ? (commercial.additionalInformation as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        };

        const commercialUpdateData: Prisma.ProjectCommercialUpdateInput = {};
        if (commercial.currency !== undefined) commercialUpdateData.currency = commercial.currency;
        if (commercial.pricingModel !== undefined) commercialUpdateData.pricingModel = commercial.pricingModel;
        if (commercial.contractAmount !== undefined)
          commercialUpdateData.contractAmount = new Prisma.Decimal(commercial.contractAmount);
        if (commercial.initialEstimate !== undefined)
          commercialUpdateData.initialEstimate = new Prisma.Decimal(commercial.initialEstimate);
        if (commercial.revisedEstimate !== undefined)
          commercialUpdateData.revisedEstimate = new Prisma.Decimal(commercial.revisedEstimate);
        if (commercial.designFee !== undefined)
          commercialUpdateData.designFee = new Prisma.Decimal(commercial.designFee);
        if (commercial.materialPayment !== undefined)
          commercialUpdateData.materialPayment = new Prisma.Decimal(commercial.materialPayment);
        if (commercial.labourPayment !== undefined)
          commercialUpdateData.labourPayment = new Prisma.Decimal(commercial.labourPayment);
        if (commercial.supervisionFee !== undefined)
          commercialUpdateData.supervisionFee = new Prisma.Decimal(commercial.supervisionFee);
        if (commercial.consultingPercentage !== undefined)
          commercialUpdateData.consultingPercentage = commercial.consultingPercentage;
        if (commercial.consultingLumpSum !== undefined)
          commercialUpdateData.consultingLumpSum =
            commercial.consultingLumpSum !== null ? new Prisma.Decimal(commercial.consultingLumpSum) : null;
        if (commercial.consultingRateSqft !== undefined)
          commercialUpdateData.consultingRateSqft =
            commercial.consultingRateSqft !== null ? new Prisma.Decimal(commercial.consultingRateSqft) : null;
        if (commercial.billableAreaSqft !== undefined)
          commercialUpdateData.billableAreaSqft = commercial.billableAreaSqft;
        if (commercial.additionalInformation !== undefined)
          commercialUpdateData.additionalInformation = commercial.additionalInformation
            ? (commercial.additionalInformation as Prisma.InputJsonValue)
            : Prisma.JsonNull;

        projectUpdateData.commercial = {
          upsert: {
            create: commercialCreateData,
            update: commercialUpdateData,
          },
        };
      }
    }

    // 1-to-Many Dynamic Team Members update/replacement
    if (members !== undefined) {
      // Delete existing and replace with new member definitions
      await db.projectMember.deleteMany({
        where: { projectId: id },
      });

      if (members.length > 0) {
        projectUpdateData.members = {
          create: members.map((m) => ({
            employeeId: m.employeeId,
            role: m.role || "OTHER",
            customRoleTitle: m.customRoleTitle || null,
            responsibilities: m.responsibilities || null,
            isPrimary: m.isPrimary ?? false,
            isActive: m.isActive ?? true,
            allocatedHoursPerWeek: m.allocatedHoursPerWeek ?? null,
            assignedById: updatedById || null,
            additionalInformation: m.additionalInformation
              ? (m.additionalInformation as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          })),
        };
      }
    }

    return db.project.update({
      where: {
        id,
        organizationId,
      },
      data: projectUpdateData,
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            displayName: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        lead: {
          select: {
            id: true,
            leadCode: true,
            title: true,
            status: true,
          },
        },
        site: true,
        schedule: true,
        metric: true,
        commercial: true,
        members: {
          include: {
            employee: {
              select: {
                id: true,
                employeeCode: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatarUrl: true,
                workEmail: true,
                workPhone: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Soft delete a project
   */
  async softDelete(id: string, organizationId: string, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;
    return db.project.update({
      where: {
        id,
        organizationId,
      },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }
}

export const projectRepo = new ProjectRepository();

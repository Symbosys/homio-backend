import { prisma } from "../../../lib/prisma.js";
import type { Prisma } from "../../../types/types.js";
import type { GetDesignReportsQueryInput } from "../validators/design-report.validator.js";

export interface DateRange {
  start?: Date;
  end?: Date;
}

export class DesignReportRepository {
  /**
   * Fetches raw aggregated metrics and ground truth for design reporting
   */
  async getDesignAnalytics(
    organizationId: string,
    filters: GetDesignReportsQueryInput,
    dateRange: DateRange
  ) {
    const { projectId, employeeId, folderId, stage, designType, status } = filters;

    // Base attachment where condition
    const attachmentWhere: Prisma.DesignVersionAttachmentWhereInput = {
      designVersion: {
        design: {
          organizationId,
          isDeleted: false,
          ...(projectId ? { projectId } : {}),
          ...(folderId ? { folderId } : {}),
          ...(stage ? { folder: { stage } } : {}),
          ...(designType ? { designType } : {}),
          ...(status ? { status } : {}),
        },
      },
      ...(employeeId ? { createdById: employeeId } : {}),
      ...(dateRange.start || dateRange.end
        ? {
            createdAt: {
              ...(dateRange.start ? { gte: dateRange.start } : {}),
              ...(dateRange.end ? { lte: dateRange.end } : {}),
            },
          }
        : {}),
    };

    // Base design where condition
    const designWhere: Prisma.ProjectDesignWhereInput = {
      organizationId,
      isDeleted: false,
      ...(projectId ? { projectId } : {}),
      ...(folderId ? { folderId } : {}),
      ...(stage ? { folder: { stage } } : {}),
      ...(designType ? { designType } : {}),
      ...(status ? { status } : {}),
      ...(employeeId ? { createdById: employeeId } : {}),
      ...(dateRange.start || dateRange.end
        ? {
            createdAt: {
              ...(dateRange.start ? { gte: dateRange.start } : {}),
              ...(dateRange.end ? { lte: dateRange.end } : {}),
            },
          }
        : {}),
    };

    // 1. Fetch KPI Aggregations in Parallel
    const [
      totalDesigns,
      designsByStatus,
      totalVersions,
      allAttachments,
      allApprovals,
      allChangeRequests,
      allProjects,
      employees,
    ] = await Promise.all([
      // Total Master Designs
      prisma.projectDesign.count({ where: designWhere }),

      // Designs Grouped by Status
      prisma.projectDesign.groupBy({
        by: ["status"],
        where: designWhere,
        _count: { id: true },
      }),

      // Total Versions
      prisma.designVersion.count({
        where: {
          design: designWhere,
        },
      }),

      // All Attachments with createdBy and designVersion info
      prisma.designVersionAttachment.findMany({
        where: attachmentWhere,
        select: {
          id: true,
          attachmentType: true,
          createdById: true,
          createdAt: true,
          isPrimary: true,
          fileSizeBytes: true,
          designVersion: {
            select: {
              id: true,
              versionNumber: true,
              status: true,
              isLocked: true,
              design: {
                select: {
                  id: true,
                  projectId: true,
                  status: true,
                  folder: {
                    select: {
                      stage: true,
                    },
                  },
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
              displayName: true,
              designation: true,
              avatarUrl: true,
            },
          },
        },
      }),

      // Approvals matching filters
      prisma.designVersionApproval.findMany({
        where: {
          organizationId,
          ...(projectId ? { projectId } : {}),
          ...(dateRange.start || dateRange.end
            ? {
                decidedAt: {
                  ...(dateRange.start ? { gte: dateRange.start } : {}),
                  ...(dateRange.end ? { lte: dateRange.end } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          decision: true,
          clientRating: true,
          decidedAt: true,
          projectId: true,
        },
      }),

      // Change Requests matching filters
      prisma.designChangeRequest.findMany({
        where: {
          designVersion: {
            design: {
              organizationId,
              isDeleted: false,
              ...(projectId ? { projectId } : {}),
            },
          },
          ...(dateRange.start || dateRange.end
            ? {
                createdAt: {
                  ...(dateRange.start ? { gte: dateRange.start } : {}),
                  ...(dateRange.end ? { lte: dateRange.end } : {}),
                },
              }
            : {}),
        },
        select: {
          id: true,
          category: true,
          urgency: true,
          status: true,
          createdAt: true,
        },
      }),

      // Active Projects in Organization
      prisma.project.findMany({
        where: {
          organizationId,
          isDeleted: false,
          ...(projectId ? { id: projectId } : {}),
        },
        select: {
          id: true,
          projectCode: true,
          name: true,
          status: true,
        },
      }),

      // All Organization Employees for complete productivity mapping
      prisma.employee.findMany({
        where: {
          organizationId,
          isDeleted: false,
          ...(employeeId ? { id: employeeId } : {}),
        },
        select: {
          id: true,
          employeeCode: true,
          firstName: true,
          lastName: true,
          displayName: true,
          designation: true,
          avatarUrl: true,
        },
      }),
    ]);

    return {
      totalDesigns,
      designsByStatus,
      totalVersions,
      allAttachments,
      allApprovals,
      allChangeRequests,
      allProjects,
      employees,
    };
  }
}

export const designReportRepo = new DesignReportRepository();

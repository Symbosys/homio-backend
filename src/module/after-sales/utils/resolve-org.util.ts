import type { Request } from "express";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";

export interface ResolveOrgOptions {
  projectId?: string;
  warrantyId?: string;
  claimId?: string;
  visitId?: string;
  requestId?: string;
  feedbackId?: string;
}

/**
 * Robustly resolves the organizationId for after-sales controllers.
 * 1. Uses req.user.organizationId if present (Staff / Org Admin).
 * 2. If client user (userType === 'USER') or organizationId is null, resolves from:
 *    - Explicit projectId (query/body/params)
 *    - Active ProjectWarranty record
 *    - Active WarrantyClaim record
 *    - Active AfterSalesServiceVisit record
 *    - Active AfterSalesServiceRequest record
 *    - Client's linked Project records
 */
export async function resolveAfterSalesOrgId(
  req: Request,
  opts?: ResolveOrgOptions
): Promise<string> {
  if (req.user?.organizationId) {
    return req.user.organizationId;
  }

  // 1. Check projectId from options or req
  const projectId =
    opts?.projectId ||
    (req.params.projectId as string) ||
    (req.query.projectId as string) ||
    (req.body?.projectId as string);

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, isDeleted: false },
      select: { organizationId: true },
    });
    if (project?.organizationId) {
      return project.organizationId;
    }
  }

  // 2. Check warrantyId from options or req
  const warrantyId =
    opts?.warrantyId ||
    (req.params.warrantyId as string) ||
    (req.query.warrantyId as string) ||
    (req.body?.warrantyId as string) ||
    (req.params.id as string);

  if (warrantyId) {
    const warranty = await prisma.projectWarranty.findFirst({
      where: { id: warrantyId, isDeleted: false },
      select: { project: { select: { organizationId: true } } },
    });
    if (warranty?.project?.organizationId) {
      return warranty.project.organizationId;
    }
  }

  // 3. Check claimId from options or req
  const claimId =
    opts?.claimId ||
    (req.params.claimId as string) ||
    (req.query.claimId as string) ||
    (req.body?.claimId as string) ||
    (req.params.id as string);

  if (claimId) {
    const claim = await prisma.warrantyClaim.findFirst({
      where: { id: claimId, isDeleted: false },
      select: { warranty: { select: { project: { select: { organizationId: true } } } } },
    });
    if (claim?.warranty?.project?.organizationId) {
      return claim.warranty.project.organizationId;
    }
  }

  // 4. Check visitId from options or req
  const visitId =
    opts?.visitId ||
    (req.params.visitId as string) ||
    (req.query.visitId as string) ||
    (req.body?.visitId as string) ||
    (req.params.id as string);

  if (visitId) {
    const visit = await prisma.afterSalesServiceVisit.findFirst({
      where: { id: visitId, isDeleted: false },
      select: { project: { select: { organizationId: true } } },
    });
    if (visit?.project?.organizationId) {
      return visit.project.organizationId;
    }
  }

  // 5. Check requestId from options or req
  const requestId =
    opts?.requestId ||
    (req.params.requestId as string) ||
    (req.query.requestId as string) ||
    (req.body?.requestId as string) ||
    (req.params.id as string);

  if (requestId) {
    const request = await prisma.afterSalesServiceRequest.findFirst({
      where: { id: requestId, isDeleted: false },
      select: { project: { select: { organizationId: true } } },
    });
    if (request?.project?.organizationId) {
      return request.project.organizationId;
    }
  }

  // 6. Check if user is linked to any active project
  if (req.user?.id) {
    const clientProject = await prisma.project.findFirst({
      where: {
        OR: [
          { customer: { userId: req.user.id } },
          ...(req.user.phone ? [{ customer: { phone: req.user.phone } }] : []),
        ],
        isDeleted: false,
      },
      select: { organizationId: true },
    });
    if (clientProject?.organizationId) {
      return clientProject.organizationId;
    }
  }

  throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
}

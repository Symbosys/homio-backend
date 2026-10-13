import { prisma } from "../../../lib/prisma.js";
import { statusCode } from "../../../types/types.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import type { AuthenticatedUser } from "../../../middlewares/auth.middleware.js";

export interface ResolvedAiTargetUser {
  targetUserId: string;
  actorEmployeeId: string | null;
  actorUserId: string;
}

/**
 * Resolves and authorizes the effective AI wallet owner for the given request context.
 * 
 * Standard Behavior:
 * 1. Retail Client (no organizationId):
 *    - Always operates on their own user wallet (caller.id).
 *    - Any attempt to access another user's wallet is rejected unless caller is PLATFORM_ADMIN.
 * 2. Platform Admin:
 *    - Can specify any valid user ID via requestedOrgUserId or operates on self.
 * 3. Organization Admin (userType = 'ADMIN' with organizationId):
 *    - Operates on self (caller.id), who acts as the primary holder of the organization's AI credits.
 * 4. Organization Employee (userType = 'USER' or other with organizationId):
 *    - If requestedOrgUserId is supplied:
 *        - Validates that the requested target user belongs to the SAME organizationId.
 *        - If target user does not belong to the same organization, rejects with 403 Forbidden.
 *        - If valid, resolves to that target org user.
 *    - If requestedOrgUserId is omitted:
 *        - Automatically resolves the primary ADMIN user of caller's organization.
 *        - Falls back to caller.id if no admin is found.
 * 
 * @param caller AuthenticatedUser extracted from req.user
 * @param requestedOrgUserId Optional target user ID passed from frontend
 * @returns ResolvedAiTargetUser containing targetUserId and actor employee audit ID
 */
export async function resolveAiTargetUser(
  caller: AuthenticatedUser,
  requestedOrgUserId?: string
): Promise<ResolvedAiTargetUser> {
  const actorUserId = caller.id;

  // Resolve actor employee record if one exists
  let actorEmployeeId: string | null = null;
  if (caller.organizationId) {
    const employee = await prisma.employee.findFirst({
      where: {
        userId: caller.id,
        organizationId: caller.organizationId,
      },
      select: { id: true },
    });
    if (employee) {
      actorEmployeeId = employee.id;
    }
  }

  // 1. Platform Admin override
  if (caller.userType === "PLATFORM_ADMIN") {
    if (requestedOrgUserId) {
      const targetExists = await prisma.user.findUnique({
        where: { id: requestedOrgUserId },
        select: { id: true },
      });
      if (!targetExists) {
        throw new ErrorResponse("Target AI user not found", statusCode.Not_Found);
      }
      return {
        targetUserId: requestedOrgUserId,
        actorEmployeeId,
        actorUserId,
      };
    }
    return {
      targetUserId: caller.id,
      actorEmployeeId,
      actorUserId,
    };
  }

  // 2. Retail Client (No organization linkage)
  if (!caller.organizationId) {
    if (requestedOrgUserId && requestedOrgUserId !== caller.id) {
      throw new ErrorResponse(
        "Forbidden: Retail client accounts cannot access other user credit pools",
        statusCode.Forbidden
      );
    }
    return {
      targetUserId: caller.id,
      actorEmployeeId: null,
      actorUserId,
    };
  }

  // 3. Organization Admin (Owner of the organization credit pool)
  if (caller.userType === "ADMIN") {
    // If Org Admin specifically targets another user within their organization, verify ownership
    if (requestedOrgUserId && requestedOrgUserId !== caller.id) {
      const orgMember = await prisma.user.findFirst({
        where: {
          id: requestedOrgUserId,
          organizationId: caller.organizationId,
        },
        select: { id: true },
      });
      if (!orgMember) {
        throw new ErrorResponse(
          "Forbidden: Target user does not belong to your organization",
          statusCode.Forbidden
        );
      }
      return {
        targetUserId: orgMember.id,
        actorEmployeeId,
        actorUserId,
      };
    }
    return {
      targetUserId: caller.id,
      actorEmployeeId,
      actorUserId,
    };
  }

  // 4. Organization Employee (Accessing Org User credit pool)
  if (requestedOrgUserId) {
    // Strict multi-tenant verification: Target user MUST belong to caller's organization
    const verifiedOrgUser = await prisma.user.findFirst({
      where: {
        id: requestedOrgUserId,
        organizationId: caller.organizationId,
      },
      select: { id: true },
    });

    if (!verifiedOrgUser) {
      throw new ErrorResponse(
        "Forbidden: Target organization user does not belong to your organization",
        statusCode.Forbidden
      );
    }

    return {
      targetUserId: verifiedOrgUser.id,
      actorEmployeeId,
      actorUserId,
    };
  }

  // Auto-resolve: If no orgUserId passed, find the primary Organization Admin
  const primaryOrgAdmin = await prisma.user.findFirst({
    where: {
      organizationId: caller.organizationId,
      userType: "ADMIN",
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return {
    targetUserId: primaryOrgAdmin ? primaryOrgAdmin.id : caller.id,
    actorEmployeeId,
    actorUserId,
  };
}

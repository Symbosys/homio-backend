import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { statusCode } from "../types/types.js";
import { ErrorResponse } from "../utils/response.util.js";
import type { UserPermissionName } from "../types/permission.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  userType: "ADMIN" | "USER";
  status: string;
  roles: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
  permissions: Set<string>;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      token?: string;
    }
  }
}

export interface JwtUserPayload {
  userId: string;
  email: string;
  userType: "ADMIN" | "USER";
}

/**
 * Authentication Middleware:
 * Verifies JWT token, ensures user account is active & unlocked,
 * loads assigned roles and resolves effective permissions.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ErrorResponse("Authentication token required", statusCode.Unauthorized);
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new ErrorResponse("Invalid authorization format", statusCode.Unauthorized);
    }

    if (!ENV.JWT_SECRET) {
      throw new ErrorResponse("JWT secret is not configured on server", statusCode.Internal_Server_Error);
    }

    let decoded: JwtUserPayload;
    try {
      decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtUserPayload;
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        throw new ErrorResponse("Token has expired. Please log in again", statusCode.Unauthorized);
      }
      throw new ErrorResponse("Invalid authentication token", statusCode.Unauthorized);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user || user.isDeleted) {
      throw new ErrorResponse("User account not found or deactivated", statusCode.Unauthorized);
    }

    if (user.status !== "ACTIVE") {
      throw new ErrorResponse(`Account is ${user.status.toLowerCase()}. Please contact support.`, statusCode.Forbidden);
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ErrorResponse("Account is temporarily locked due to multiple failed attempts. Try again later.", statusCode.Forbidden);
    }

    // Resolve permissions:
    // 1. Roles provide base permissions
    // 2. Direct user permissions override roles (DENY overrides ALLOW)
    const effectivePermissions = new Set<string>();
    const deniedPermissions = new Set<string>();

    for (const directPerm of user.permissions) {
      if (directPerm.effect === "DENY") {
        deniedPermissions.add(directPerm.permission.name);
      } else if (directPerm.effect === "ALLOW") {
        effectivePermissions.add(directPerm.permission.name);
      }
    }

    for (const userRole of user.roles) {
      if (!userRole.role.isActive) continue;
      for (const rolePerm of userRole.role.permissions) {
        const permName = rolePerm.permission.name;
        if (!deniedPermissions.has(permName)) {
          effectivePermissions.add(permName);
        }
      }
    }

    req.token = token;
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      userType: user.userType as "ADMIN" | "USER",
      status: user.status,
      roles: user.roles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        slug: ur.role.slug,
      })),
      permissions: effectivePermissions,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Portal/Audience Guard Middleware:
 * Ensures the authenticated user belongs to the required userType
 * (e.g. 'ADMIN' for CRM Admin Panel vs 'USER' for Customer App).
 */
export const requireUserType = (...allowedTypes: Array<"ADMIN" | "USER">) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ErrorResponse("Unauthorized: Login required", statusCode.Unauthorized));
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return next(
        new ErrorResponse(
          `Forbidden: This portal is restricted to ${allowedTypes.join(" or ")} accounts`,
          statusCode.Forbidden
        )
      );
    }

    next();
  };
};

/**
 * RBAC Permission Guard Middleware:
 * Verifies that the user possesses the required permission
 * (either through an assigned Role or direct UserPermission override).
 */
export const requirePermission = (permission: UserPermissionName) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ErrorResponse("Unauthorized: Login required", statusCode.Unauthorized));
    }

    if (!req.user.permissions.has(permission)) {
      return next(
        new ErrorResponse(
          `Forbidden: You lack permission '${permission}' to perform this action`,
          statusCode.Forbidden
        )
      );
    }

    next();
  };
};



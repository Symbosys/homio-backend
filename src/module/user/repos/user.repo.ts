import { prisma } from "../../../lib/prisma.js";

export class UserRepository {
  /**
   * Create a new user record with optional initial roles
   */
  async create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    status?: any;
    userType?: any;
    invitedById?: string | null;
    roleIds?: string[];
  }) {
    const { roleIds, ...userData } = data;

    return prisma.user.create({
      data: {
        ...userData,
        roles: roleIds && roleIds.length > 0
          ? {
              create: roleIds.map((roleId) => ({
                roleId,
                assignedById: data.invitedById ?? undefined,
              })),
            }
          : undefined,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Find user by ID (excluding soft-deleted)
   */
  async findById(id: string, includeFullProfile = false) {
    return prisma.user.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: includeFullProfile
        ? {
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
            invitedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          }
        : {
            roles: {
              include: {
                role: true,
              },
            },
          },
    });
  }

  /**
   * Find user by unique email
   */
  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
      },
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
  }

  /**
   * Find user by phone number
   */
  async findByPhone(phone: string, includeDeleted = false) {
    return prisma.user.findFirst({
      where: {
        phone: phone.trim(),
        ...(includeDeleted ? {} : { isDeleted: false }),
      },
    });
  }

  /**
   * Query paginated users with filters
   */
  async findMany(params: {
    skip: number;
    take: number;
    search?: string;
    status?: any;
    userType?: any;
    roleId?: string;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
  }) {
    const { skip, take, search, status, userType, roleId, sortBy = "createdAt", sortOrder = "desc" } = params;

    const where: any = {
      isDeleted: false,
    };

    if (status) {
      where.status = status;
    }

    if (userType) {
      where.userType = userType;
    }

    if (roleId) {
      where.roles = {
        some: {
          roleId,
        },
      };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          status: true,
          userType: true,
          emailVerifiedAt: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  /**
   * Update user details
   */
  async update(id: string, data: any) {
    return prisma.user.update({
      where: { id },
      data,
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Soft-delete a user and revoke active sessions
   */
  async softDelete(id: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          status: "INACTIVE",
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);
  }

  /**
   * Reset user password and invalidate sessions
   */
  async updatePassword(id: string, passwordHash: string) {
    return prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      }),
    ]);
  }

  /**
   * Record a failed login attempt; lock account if threshold exceeded
   */
  async recordFailedLogin(userId: string, currentAttempts: number, lockThreshold = 5, lockMinutes = 15) {
    const nextAttempts = currentAttempts + 1;
    const shouldLock = nextAttempts >= lockThreshold;
    const lockedUntil = shouldLock ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;

    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedUntil,
      },
    });
  }

  /**
   * Reset failed login counter upon successful authentication
   */
  async recordSuccessfulLogin(userId: string, ipAddress?: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });
  }

  /**
   * Atomically assign roles to a user
   */
  async assignRoles(userId: string, roleIds: string[], assignedById?: string) {
    return prisma.$transaction(async (tx) => {
      // Clear existing roles
      await tx.userRole.deleteMany({
        where: { userId },
      });

      // Insert new roles
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({
            userId,
            roleId,
            assignedById: assignedById ?? undefined,
          })),
        });
      }

      return tx.userRole.findMany({
        where: { userId },
        include: {
          role: true,
        },
      });
    });
  }

  /**
   * Atomically upsert permission overrides for a user
   */
  async assignPermissions(
    userId: string,
    permissions: Array<{ permissionId: string; effect: "ALLOW" | "DENY" }>,
    grantedById?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const results = [];
      for (const p of permissions) {
        const item = await tx.userPermission.upsert({
          where: {
            userId_permissionId: {
              userId,
              permissionId: p.permissionId,
            },
          },
          update: {
            effect: p.effect,
            grantedById: grantedById ?? undefined,
            grantedAt: new Date(),
          },
          create: {
            userId,
            permissionId: p.permissionId,
            effect: p.effect,
            grantedById: grantedById ?? undefined,
          },
          include: {
            permission: true,
          },
        });
        results.push(item);
      }
      return results;
    });
  }

  /**
   * Create refresh token for user
   */
  async createRefreshToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    deviceInfo?: string;
    ipAddress?: string;
  }) {
    return prisma.refreshToken.create({
      data,
    });
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(tokenHash: string) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  /**
   * Revoke all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string) {
    return prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  // ==========================================
  // ROLES MANAGEMENT
  // ==========================================

  /**
   * Create a new role with optional initial permissions
   */
  async createRole(data: {
    name: string;
    slug: string;
    description?: string;
    isSystem?: boolean;
    isActive?: boolean;
    permissionIds?: string[];
  }) {
    const { permissionIds, ...roleData } = data;

    return prisma.role.create({
      data: {
        ...roleData,
        permissions:
          permissionIds && permissionIds.length > 0
            ? {
                create: permissionIds.map((permissionId) => ({
                  permissionId,
                })),
              }
            : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  /**
   * Find roles with optional search and active status filters
   */
  async findRoles(params?: { search?: string; isActive?: boolean }) {
    const where: any = {};

    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { slug: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    return prisma.role.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  /**
   * Find role by ID
   */
  async findRoleById(id: string) {
    return prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  /**
   * Find role by slug
   */
  async findRoleBySlug(slug: string) {
    return prisma.role.findUnique({
      where: { slug },
    });
  }

  /**
   * Update role details
   */
  async updateRole(
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string | null;
      isActive?: boolean;
    }
  ) {
    return prisma.role.update({
      where: { id },
      data,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  /**
   * Delete custom role (system roles and roles with active assigned users cannot be deleted)
   */
  async deleteRole(id: string) {
    return prisma.role.delete({
      where: { id },
    });
  }

  /**
   * Atomically assign/replace permissions for a role
   */
  async assignRolePermissions(roleId: string, permissionIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // Clear existing role permissions
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      // Assign new permissions
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
      });
    });
  }

  // ==========================================
  // PERMISSIONS MANAGEMENT
  // ==========================================

  /**
   * Find all permissions, optionally filtered by resource
   */
  async findPermissions(params?: { resource?: string; search?: string }) {
    const where: any = {};

    if (params?.resource) {
      where.resource = params.resource;
    }

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { slug: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    return prisma.permission.findMany({
      where,
      orderBy: [{ resource: "asc" }, { name: "asc" }],
    });
  }
}

export const userRepo = new UserRepository();
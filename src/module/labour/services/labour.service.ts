import bcrypt from "bcryptjs";
import { labourRepo } from "../repos/labour.repo.js";
import { userRepo } from "../../user/repos/user.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import type { CreateLabourInput, UpdateLabourInput, GetLaboursQuery } from "../validators/labour.validator.js";

/**
 * Service layer coordinating Labour business logic, data validation, and operations
 */
export class LabourService {
  /**
   * Onboard / create a new labour profile under the specified tenant organization
   * @param organizationId - Tenant organization UUID
   * @param payload - Validated labour creation payload
   * @param file - Optional uploaded photo file
   * @param createdById - UUID of admin/manager creating the labour
   */
  async createLabour(
    organizationId: string,
    payload: CreateLabourInput,
    file?: Express.Multer.File,
    createdById?: string
  ) {
    if (file) {
      const uploadResult = await storageService.upload(file, {
        folder: `organizations/${organizationId}/labour/photos`,
      });
      payload.photoUrl = uploadResult;
    }

    // 1. Validate Labour Profile Phone, Email & AltPhone Uniqueness (Independent of SaaS User)
    if (payload.phone && payload.phone.trim()) {
      const existingPhone = await prisma.labour.findFirst({
        where: { organizationId, phone: payload.phone.trim(), isDeleted: false },
      });
      if (existingPhone) {
        throw new ErrorResponse(
          `A labour profile with phone number "${payload.phone}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (payload.email && payload.email.trim()) {
      const existingEmail = await prisma.labour.findFirst({
        where: { organizationId, email: payload.email.trim().toLowerCase(), isDeleted: false },
      });
      if (existingEmail) {
        throw new ErrorResponse(
          `A labour profile with email "${payload.email}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (payload.altPhone && payload.altPhone.trim()) {
      const existingAltPhone = await prisma.labour.findFirst({
        where: { organizationId, altPhone: payload.altPhone.trim(), isDeleted: false },
      });
      if (existingAltPhone) {
        throw new ErrorResponse(
          `A labour profile with alternate phone "${payload.altPhone}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    // 2. Prepare Optional SaaS User Account & Login Creation
    let userCreationParams: {
      email: string;
      passwordHash: string;
      firstName: string;
      lastName: string | null;
      phone: string | null;
      status: any;
      userType: any;
      invitedById?: string;
      roleIds?: string[];
    } | null = null;

    if (payload.createUserAccount || payload.userPassword) {
      const loginEmail = payload.userEmail?.trim().toLowerCase();
      if (!loginEmail) {
        throw new ErrorResponse(
          "A valid login email address is required in the User Account section to create portal access",
          statusCode.Bad_Request
        );
      }

      if (!payload.userPassword || payload.userPassword.trim().length < 6) {
        throw new ErrorResponse(
          "A password of at least 6 characters is required to create a user login account",
          statusCode.Bad_Request
        );
      }

      // Check if login email is already registered in SaaS users table
      const existingUser = await userRepo.findByEmail(loginEmail);
      if (existingUser) {
        throw new ErrorResponse(
          `A user account with login email "${loginEmail}" already exists`,
          statusCode.Conflict
        );
      }

      // Check user phone if provided in User section
      const loginPhone = payload.userPhone?.trim() || null;
      if (loginPhone) {
        const existingPhoneUser = await prisma.user.findFirst({
          where: { phone: loginPhone, isDeleted: false },
        });
        if (existingPhoneUser) {
          throw new ErrorResponse(
            `A user account with phone number "${loginPhone}" already exists`,
            statusCode.Conflict
          );
        }
      }

      // Validate roles if provided
      if (payload.userRoleIds && payload.userRoleIds.length > 0) {
        const rolesInOrg = await prisma.role.findMany({
          where: { id: { in: payload.userRoleIds }, organizationId },
          select: { id: true },
        });
        if (rolesInOrg.length !== payload.userRoleIds.length) {
          throw new ErrorResponse("One or more selected roles are invalid for this organization", statusCode.Bad_Request);
        }
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(payload.userPassword.trim(), salt);

      const nameParts = payload.name.trim().split(" ");
      const firstName = nameParts[0] || payload.name.trim();
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

      userCreationParams = {
        email: loginEmail,
        passwordHash,
        firstName,
        lastName,
        phone: loginPhone,
        status: payload.userStatus || "ACTIVE",
        userType: payload.userType || "USER",
        invitedById: createdById,
        roleIds: payload.userRoleIds && payload.userRoleIds.length > 0 ? payload.userRoleIds : undefined,
      };
    } else if (payload.userId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: payload.userId, organizationId, isDeleted: false },
      });
      if (!existingUser) {
        throw new ErrorResponse("Specified user account not found in this organization", statusCode.Not_Found);
      }
      const userAlreadyAssigned = await prisma.labour.findFirst({
        where: { userId: payload.userId, isDeleted: false },
      });
      if (userAlreadyAssigned) {
        throw new ErrorResponse("User is already linked to another labour profile", statusCode.Conflict);
      }
    }

    // 3. Atomically create User (if requested) and Labour Profile inside a single Transaction
    return prisma.$transaction(async (tx) => {
      if (userCreationParams) {
        const createdUser = await userRepo.create({
          organizationId,
          ...userCreationParams,
        }, tx);
        payload.userId = createdUser.id;
      }

      return labourRepo.create(organizationId, payload, tx);
    });
  }

  /**
   * Fetch paginated list of labours with search and filter parameters
   * @param organizationId - Tenant organization UUID
   * @param query - Validated query parameters
   */
  async getLabours(organizationId: string, query: GetLaboursQuery) {
    return labourRepo.findAll(organizationId, query);
  }

  /**
   * Retrieve complete labour details by ID along with KYC and relations
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID
   */
  async getLabourById(id: string, organizationId: string) {
    const labour = await labourRepo.findById(id, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }
    return labour;
  }

  /**
   * Update labour profile symmetrically (supporting all creation fields via partial dirty payload)
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID
   * @param payload - Validated update payload
   * @param file - Optional uploaded photo file
   * @param updatedById - UUID of admin/manager performing update
   */
  async updateLabour(
    id: string,
    organizationId: string,
    payload: UpdateLabourInput,
    file?: Express.Multer.File,
    updatedById?: string
  ) {
    // Verify existence & ownership
    const existing = await this.getLabourById(id, organizationId);

    if (file) {
      const uploadResult = await storageService.upload(file, {
        folder: `organizations/${organizationId}/labour/photos`,
      });
      payload.photoUrl = uploadResult;
    }

    // 1. Validate Labour Profile Phone, Email & AltPhone Uniqueness on Update
    if (payload.phone && payload.phone.trim() !== existing.phone) {
      const duplicatePhone = await prisma.labour.findFirst({
        where: { organizationId, phone: payload.phone.trim(), id: { not: id }, isDeleted: false },
      });
      if (duplicatePhone) {
        throw new ErrorResponse(
          `A labour profile with phone number "${payload.phone}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (payload.email && payload.email.trim() !== existing.email) {
      const duplicateEmail = await prisma.labour.findFirst({
        where: { organizationId, email: payload.email.trim().toLowerCase(), id: { not: id }, isDeleted: false },
      });
      if (duplicateEmail) {
        throw new ErrorResponse(
          `A labour profile with email "${payload.email}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    if (payload.altPhone && payload.altPhone.trim() !== existing.altPhone) {
      const duplicateAltPhone = await prisma.labour.findFirst({
        where: { organizationId, altPhone: payload.altPhone.trim(), id: { not: id }, isDeleted: false },
      });
      if (duplicateAltPhone) {
        throw new ErrorResponse(
          `A labour profile with alternate phone "${payload.altPhone}" already exists in this organization`,
          statusCode.Conflict
        );
      }
    }

    // 2. Atomically perform User updates/creation and Labour Profile update inside a single Transaction
    return prisma.$transaction(async (tx) => {
      if (existing.userId) {
        // 1. Password update
        if (payload.userPassword && payload.userPassword.trim().length >= 6) {
          const salt = await bcrypt.genSalt(10);
          const passwordHash = await bcrypt.hash(payload.userPassword.trim(), salt);
          await tx.user.update({
            where: { id: existing.userId },
            data: { passwordHash, passwordChangedAt: new Date() },
          });
        }

        // 2. User Email update
        if (payload.userEmail) {
          const newEmail = payload.userEmail.trim().toLowerCase();
          const currentUser = await tx.user.findUnique({ where: { id: existing.userId } });
          if (currentUser && currentUser.email !== newEmail) {
            const duplicate = await userRepo.findByEmail(newEmail);
            if (duplicate && duplicate.id !== existing.userId) {
              throw new ErrorResponse(`A user account with login email "${newEmail}" already exists`, statusCode.Conflict);
            }
            await tx.user.update({
              where: { id: existing.userId },
              data: { email: newEmail },
            });
          }
        }

        // 3. User Phone update
        if (payload.userPhone !== undefined) {
          const newPhone = payload.userPhone ? payload.userPhone.trim() : null;
          if (newPhone) {
            const duplicatePhone = await tx.user.findFirst({
              where: { phone: newPhone, id: { not: existing.userId }, isDeleted: false },
            });
            if (duplicatePhone) {
              throw new ErrorResponse(`A user account with phone number "${newPhone}" already exists`, statusCode.Conflict);
            }
          }
          await tx.user.update({
            where: { id: existing.userId },
            data: { phone: newPhone },
          });
        }

        // 4. Status or UserType update
        if (payload.userStatus || payload.userType) {
          await tx.user.update({
            where: { id: existing.userId },
            data: {
              ...(payload.userStatus ? { status: payload.userStatus } : {}),
              ...(payload.userType ? { userType: payload.userType } : {}),
            },
          });
        }

        // 5. Role synchronization
        if (payload.userRoleIds !== undefined) {
          await tx.userRole.deleteMany({
            where: { userId: existing.userId },
          });
          if (payload.userRoleIds && payload.userRoleIds.length > 0) {
            await tx.userRole.createMany({
              data: payload.userRoleIds.map((roleId) => ({
                userId: existing.userId!,
                roleId,
                assignedById: updatedById,
              })),
            });
          }
        }
      } else if (payload.createUserAccount || payload.userPassword) {
        // Create new user account for existing labour worker
        const loginEmail = payload.userEmail?.trim().toLowerCase();

        if (!loginEmail) {
          throw new ErrorResponse(
            "A valid login email address is required in the User Account section to create portal access",
            statusCode.Bad_Request
          );
        }

        if (!payload.userPassword || payload.userPassword.trim().length < 6) {
          throw new ErrorResponse(
            "A password of at least 6 characters is required to create a user login account",
            statusCode.Bad_Request
          );
        }

        const duplicate = await userRepo.findByEmail(loginEmail);
        if (duplicate) {
          throw new ErrorResponse(`A user account with login email "${loginEmail}" already exists`, statusCode.Conflict);
        }

        const loginPhone = payload.userPhone?.trim() || null;
        if (loginPhone) {
          const duplicatePhone = await tx.user.findFirst({
            where: { phone: loginPhone, isDeleted: false },
          });
          if (duplicatePhone) {
            throw new ErrorResponse(`A user account with phone number "${loginPhone}" already exists`, statusCode.Conflict);
          }
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(payload.userPassword.trim(), salt);

        const nameParts = (payload.name || existing.name).trim().split(" ");
        const firstName = nameParts[0] || (payload.name || existing.name).trim();
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

        const createdUser = await userRepo.create({
          organizationId,
          email: loginEmail,
          passwordHash,
          firstName,
          lastName,
          phone: loginPhone,
          status: payload.userStatus || "ACTIVE",
          userType: payload.userType || "USER",
          invitedById: updatedById,
          roleIds: payload.userRoleIds && payload.userRoleIds.length > 0 ? payload.userRoleIds : undefined,
        }, tx);

        payload.userId = createdUser.id;
      }

      return labourRepo.update(id, organizationId, payload, tx);
    });
  }

  /**
   * Soft delete labour profile within tenant organization
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID
   */
  async deleteLabour(id: string, organizationId: string) {
    // Verify existence & ownership
    await this.getLabourById(id, organizationId);
    return labourRepo.softDelete(id, organizationId);
  }
}

export const labourService = new LabourService();

import bcrypt from "bcryptjs";
import { labourRepo } from "../repos/labour.repo.js";
import { userRepo } from "../../user/repos/user.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, UserType, UserStatus, LabourStatus } from "../../../types/types.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import type {
  CreateLabourInput,
  UpdateLabourInput,
  GetLaboursQuery,
  PlatformCreateLabourInput,
  PlatformGetLaboursQuery,
  RegisterLabourInput,
  ApproveLabourInput,
  RejectLabourInput,
} from "../validators/labour.validator.js";

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
    organizationId: string | undefined | null,
    payload: CreateLabourInput,
    file?: Express.Multer.File,
    createdById?: string
  ) {
    if (file) {
      const folder = organizationId ? `organizations/${organizationId}/labour/photos` : `platform/labour/photos`;
      const uploadResult = await storageService.upload(file, {
        folder,
      });
      payload.photoUrl = uploadResult;
    }

    // 1. Validate Labour Profile Phone, Email & AltPhone Uniqueness (Independent of SaaS User)
    const orgScope = organizationId ? { organizationId } : { organizationId: null };

    if (payload.phone && payload.phone.trim()) {
      const existingPhone = await prisma.labour.findFirst({
        where: { ...orgScope, phone: payload.phone.trim(), isDeleted: false },
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
        where: { ...orgScope, email: payload.email.trim().toLowerCase(), isDeleted: false },
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
        where: { ...orgScope, altPhone: payload.altPhone.trim(), isDeleted: false },
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
          where: { id: { in: payload.userRoleIds }, ...(organizationId ? { organizationId } : {}) },
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
        userType: UserType.LABOUR,
        invitedById: createdById,
        roleIds: payload.userRoleIds && payload.userRoleIds.length > 0 ? payload.userRoleIds : undefined,
      };
    } else if (payload.userId) {
      const existingUser = await prisma.user.findFirst({
        where: { id: payload.userId, ...(organizationId ? { organizationId } : {}), isDeleted: false },
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
   * @param organizationId - Tenant organization UUID (optional for marketplace/platform)
   * @param query - Validated query parameters
   */
  async getLabours(organizationId: string | undefined | null, query: GetLaboursQuery) {
    return labourRepo.findAll(organizationId, query);
  }

  /**
   * Platform Admin: Fetch paginated list of labours across all organizations or platform-only
   * @param query - Validated query parameters including scope and organizationId
   */
  async getPlatformLabours(query: PlatformGetLaboursQuery) {
    const { organizationId, scope, ...restQuery } = query;
    return labourRepo.findAll(organizationId, {
      ...restQuery,
      scope,
    });
  }

  /**
   * Retrieve complete labour details by ID along with KYC and relations
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID (optional for platform admin)
   */
  async getLabourById(id: string, organizationId?: string | null) {
    const labour = await labourRepo.findById(id, organizationId);
    if (!labour) {
      throw new ErrorResponse("Labour not found or unauthorized", statusCode.Not_Found);
    }
    return labour;
  }

  /**
   * Platform Admin: Retrieve complete labour details by ID
   * @param id - Labour UUID
   */
  async getPlatformLabourById(id: string) {
    return this.getLabourById(id);
  }

  /**
   * Platform Admin: Create labour profile
   */
  async createPlatformLabour(
    payload: PlatformCreateLabourInput,
    file?: Express.Multer.File,
    createdById?: string
  ) {
    const { organizationId, ...labourPayload } = payload;
    return this.createLabour(organizationId || null, labourPayload, file, createdById);
  }

  /**
   * Platform Admin: Update labour profile
   */
  async updatePlatformLabour(
    id: string,
    payload: UpdateLabourInput,
    file?: Express.Multer.File,
    updatedById?: string
  ) {
    const existing = await this.getPlatformLabourById(id);
    return this.updateLabour(id, existing.organizationId || null, payload, file, updatedById);
  }

  /**
   * Platform Admin: Delete labour profile
   */
  async deletePlatformLabour(id: string) {
    const existing = await this.getPlatformLabourById(id);
    return this.deleteLabour(id, existing.organizationId || null);
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
    organizationId: string | undefined | null,
    payload: UpdateLabourInput,
    file?: Express.Multer.File,
    updatedById?: string
  ) {
    // Verify existence & ownership
    const existing = await this.getLabourById(id, organizationId);

    if (file) {
      const folder = organizationId ? `organizations/${organizationId}/labour/photos` : `platform/labour/photos`;
      const uploadResult = await storageService.upload(file, {
        folder,
      });
      payload.photoUrl = uploadResult;
    }

    // 1. Validate Labour Profile Phone, Email & AltPhone Uniqueness on Update
    const orgScope = organizationId ? { organizationId } : { organizationId: null };

    if (payload.phone && payload.phone.trim() !== existing.phone) {
      const duplicatePhone = await prisma.labour.findFirst({
        where: { ...orgScope, phone: payload.phone.trim(), id: { not: id }, isDeleted: false },
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
        where: { ...orgScope, email: payload.email.trim().toLowerCase(), id: { not: id }, isDeleted: false },
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
        where: { ...orgScope, altPhone: payload.altPhone.trim(), id: { not: id }, isDeleted: false },
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
          userType: UserType.LABOUR,
          invitedById: updatedById,
          roleIds: payload.userRoleIds && payload.userRoleIds.length > 0 ? payload.userRoleIds : undefined,
        }, tx);

        payload.userId = createdUser.id;
      }

      return labourRepo.update(id, organizationId, payload, tx);
    });
  }

  /**
   * Soft delete labour profile within tenant organization or platform
   * @param id - Labour UUID
   * @param organizationId - Tenant organization UUID (optional for platform admin)
   */
  async deleteLabour(id: string, organizationId?: string | null) {
    // Verify existence & ownership
    await this.getLabourById(id, organizationId);
    return labourRepo.softDelete(id, organizationId);
  }

  /**
   * Public Self-Registration for independent labours (Platform Pool)
   * Captures personal, trade, wage, KYC, bank & login details.
   * Atomically creates SaaS User (status: PENDING_VERIFICATION) and Labour (status: PENDING).
   */
  async registerPublicLabour(
    payload: RegisterLabourInput,
    photoFile?: Express.Multer.File
  ) {
    if (photoFile) {
      const uploadResult = await storageService.upload(photoFile, {
        folder: "platform/labour/photos",
      });
      payload.photoUrl = uploadResult;
    }

    const cleanPhone = payload.phone.trim();
    const cleanEmail =
      payload.email && payload.email.trim()
        ? payload.email.trim().toLowerCase()
        : `${cleanPhone}@labour.homio.internal`;
    const cleanAltPhone = payload.altPhone?.trim() || null;

    // 1. Verify phone uniqueness in Labour directory
    const existingLabourPhone = await prisma.labour.findFirst({
      where: { phone: cleanPhone, isDeleted: false },
    });
    if (existingLabourPhone) {
      throw new ErrorResponse(
        `A labour profile with phone number "${cleanPhone}" is already registered.`,
        statusCode.Conflict
      );
    }

    if (payload.email && payload.email.trim()) {
      const existingLabourEmail = await prisma.labour.findFirst({
        where: { email: cleanEmail, isDeleted: false },
      });
      if (existingLabourEmail) {
        throw new ErrorResponse(
          `A labour profile with email "${cleanEmail}" is already registered.`,
          statusCode.Conflict
        );
      }
    }

    // 2. Check SaaS User credentials uniqueness
    const existingUser = await userRepo.findByEmail(cleanEmail);
    if (existingUser) {
      throw new ErrorResponse(
        `A user account with email "${cleanEmail}" already exists. Please log in or use another email.`,
        statusCode.Conflict
      );
    }

    const existingPhoneUser = await prisma.user.findFirst({
      where: { phone: cleanPhone, isDeleted: false },
    });
    if (existingPhoneUser) {
      throw new ErrorResponse(
        `A user account with phone "${cleanPhone}" already exists.`,
        statusCode.Conflict
      );
    }

    // 3. Hash password for SaaS login account
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(payload.password.trim(), salt);

    const nameParts = payload.name.trim().split(" ");
    const firstName = nameParts[0] || payload.name.trim();
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    return prisma.$transaction(async (tx) => {
      // Create User account with PENDING_VERIFICATION & LABOUR type
      const createdUser = await userRepo.create(
        {
          organizationId: null,
          email: cleanEmail,
          passwordHash,
          firstName,
          lastName,
          phone: cleanPhone,
          status: UserStatus.PENDING_VERIFICATION,
          userType: UserType.LABOUR,
        },
        tx
      );

      // Prepare payload for labourRepo.create
      const labourCreatePayload: CreateLabourInput = {
        name: payload.name.trim(),
        phone: cleanPhone,
        altPhone: cleanAltPhone,
        email: payload.email?.trim().toLowerCase() || null,
        photoUrl: payload.photoUrl || null,
        trade: payload.trade.trim(),
        skillLevel: payload.skillLevel || "Skilled",
        dailyRate: payload.dailyRate,
        hourlyRate: payload.hourlyRate || null,
        address: payload.address?.trim() || null,
        state: payload.state.trim(),
        city: payload.city.trim(),
        locality: payload.locality?.trim() || null,
        pincode: payload.pincode?.trim() || null,
        isAvailable: false,
        isKycVerified: false,
        status: LabourStatus.PENDING,
        aadhaarNo: payload.aadhaarNo?.trim() || null,
        aadhaarDoc: payload.aadhaarDoc || null,
        bankName: payload.bankName?.trim() || null,
        bankAccountNo: payload.bankAccountNo?.trim() || null,
        ifscCode: payload.ifscCode?.trim().toUpperCase() || null,
        upiId: payload.upiId?.trim() || null,
        emergencyContact: payload.emergencyContact?.trim() || null,
        emergencyPhone: payload.emergencyPhone?.trim() || null,
        userId: createdUser.id,
        additionalInformation: payload.additionalInformation || null,
        kyc: {
          aadhaarNumber: payload.aadhaarNo?.trim() || null,
          aadhaarDoc: payload.aadhaarDoc || null,
          selfiePhoto: payload.selfiePhoto || null,
          policeClearanceDoc: payload.policeClearanceDoc || null,
          policeStationName: payload.policeStationName?.trim() || null,
          bankAccountNo: payload.bankAccountNo?.trim() || null,
          ifscCode: payload.ifscCode?.trim().toUpperCase() || null,
          bankName: payload.bankName?.trim() || null,
          accountHolderName: payload.accountHolderName?.trim() || payload.name.trim(),
          upiId: payload.upiId?.trim() || null,
          status: "PENDING",
        },
      };

      return labourRepo.create(null, labourCreatePayload, tx);
    });
  }

  /**
   * Platform Admin: Verify & Approve a Labour profile
   * Transitions status to AVAILABLE, activates isAvailable & isKycVerified,
   * updates LabourKycDocument to APPROVED, and activates linked User account.
   */
  async approveLabour(
    id: string,
    adminUser: { id: string; firstName?: string | null; lastName?: string | null },
    payload?: ApproveLabourInput
  ) {
    const labour = await labourRepo.findById(id);
    if (!labour) {
      throw new ErrorResponse("Labour profile not found", statusCode.Not_Found);
    }

    const verifiedByName = `${adminUser.firstName || "Platform"} ${adminUser.lastName || "Admin"}`.trim();
    const targetStatus = payload?.status || LabourStatus.AVAILABLE;

    return prisma.$transaction(async (tx) => {
      // 1. Update Labour profile
      const updatedLabour = await tx.labour.update({
        where: { id },
        data: {
          status: targetStatus,
          isAvailable: true,
          isKycVerified: true,
        },
        include: {
          organization: true,
          kycDocument: true,
          user: true,
        },
      });

      // 2. Update or Upsert Labour KYC document
      await tx.labourKycDocument.upsert({
        where: { labourId: id },
        create: {
          labourId: id,
          status: "APPROVED",
          tradeTestScore: payload?.tradeTestScore ?? null,
          verificationNotes: payload?.verificationNotes || "Approved by Platform Admin",
          verifiedAt: new Date(),
          verifiedBy: verifiedByName,
        },
        update: {
          status: "APPROVED",
          tradeTestScore: payload?.tradeTestScore !== undefined ? payload.tradeTestScore : undefined,
          verificationNotes: payload?.verificationNotes || "Approved by Platform Admin",
          verifiedAt: new Date(),
          verifiedBy: verifiedByName,
        },
      });

      // 3. If linked to SaaS User, activate the user account
      if (labour.userId) {
        await tx.user.update({
          where: { id: labour.userId },
          data: {
            status: UserStatus.ACTIVE,
          },
        });
      }

      return updatedLabour;
    });
  }

  /**
   * Platform Admin: Reject a Labour application with mandatory audit reason
   */
  async rejectLabour(
    id: string,
    adminUser: { id: string; firstName?: string | null; lastName?: string | null },
    payload: RejectLabourInput
  ) {
    const labour = await labourRepo.findById(id);
    if (!labour) {
      throw new ErrorResponse("Labour profile not found", statusCode.Not_Found);
    }

    const verifiedByName = `${adminUser.firstName || "Platform"} ${adminUser.lastName || "Admin"}`.trim();

    return prisma.$transaction(async (tx) => {
      // 1. Update Labour profile
      const updatedLabour = await tx.labour.update({
        where: { id },
        data: {
          status: LabourStatus.REJECTED,
          isAvailable: false,
          isKycVerified: false,
        },
        include: {
          organization: true,
          kycDocument: true,
          user: true,
        },
      });

      // 2. Update KYC Document
      await tx.labourKycDocument.upsert({
        where: { labourId: id },
        create: {
          labourId: id,
          status: "REJECTED",
          rejectionReason: payload.rejectionReason,
          verificationNotes: payload.verificationNotes || null,
          verifiedAt: new Date(),
          verifiedBy: verifiedByName,
        },
        update: {
          status: "REJECTED",
          rejectionReason: payload.rejectionReason,
          verificationNotes: payload.verificationNotes || null,
          verifiedAt: new Date(),
          verifiedBy: verifiedByName,
        },
      });

      // 3. If linked to SaaS User, suspend user account
      if (labour.userId) {
        await tx.user.update({
          where: { id: labour.userId },
          data: {
            status: UserStatus.SUSPENDED,
          },
        });
      }

      return updatedLabour;
    });
  }

  /**
   * Platform Admin or Manager: Transition Labour Status (e.g. AVAILABLE, AT_WORK, UNAVAILABLE)
   */
  async updateLabourStatus(
    id: string,
    status: LabourStatus,
    organizationId?: string | null
  ) {
    await this.getLabourById(id, organizationId);
    const isAvailable = status === LabourStatus.AVAILABLE;

    return prisma.labour.update({
      where: { id },
      data: {
        status,
        isAvailable,
      },
      include: {
        organization: true,
        kycDocument: true,
        user: true,
      },
    });
  }
}

export const labourService = new LabourService();

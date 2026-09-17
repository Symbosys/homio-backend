import bcrypt from "bcryptjs";
import { organizationRepo } from "../repos/organization.repo.js";
import { subscriptionRepo } from "../../subscription/repos/subscription.repo.js";
import { userRepo } from "../../user/repos/user.repo.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { statusCode, type ImageType } from "../../../types/types.js";
import type {
  OnboardOrganizationInput,
  UpdateOrganizationInput,
  AssignSubscriptionInput,
  GetOrganizationsQueryInput,
} from "../validators/organization.validator.js";

export class OrganizationService {
  /**
   * Calculate subscription billing period dates based on cycle and trial settings
   */
  private calculatePeriodDates(
    billingCycle: "MONTHLY" | "QUARTERLY" | "YEARLY",
    status: string,
    trialDays = 14
  ) {
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date(currentPeriodStart);

    switch (billingCycle) {
      case "YEARLY":
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
        break;
      case "QUARTERLY":
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
        break;
      case "MONTHLY":
      default:
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        break;
    }

    let trialEndsAt: Date | null = null;
    if (status === "TRIALING") {
      trialEndsAt = new Date(currentPeriodStart);
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
    }

    return {
      currentPeriodStart,
      currentPeriodEnd,
      trialEndsAt,
    };
  }

  /**
   * Onboard a new organization with a subscription plan and optional initial admin user
   */
  async onboardOrganization(input: OnboardOrganizationInput, file?: Express.Multer.File) {
    const normalizedSlug = input.organization.slug.trim().toLowerCase();

    // If logo file was uploaded via multipart, upload via active storage provider
    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/organizations/logos",
          resourceType: "image",
        }
      );

      const logoData: ImageType = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };

      input.organization.logoUrl = logoData;
    }

    // Check slug uniqueness
    const existingOrg = await organizationRepo.findBySlug(normalizedSlug);
    if (existingOrg) {
      throw new ErrorResponse(
        `Organization with slug '${normalizedSlug}' already exists`,
        statusCode.Conflict
      );
    }

    // Validate Subscription Plan exists and is active
    const plan = await subscriptionRepo.findById(input.subscription.planId);
    if (!plan) {
      throw new ErrorResponse("Selected subscription plan does not exist", statusCode.Not_Found);
    }
    if (!plan.isActive) {
      throw new ErrorResponse(
        "Cannot subscribe to an inactive plan",
        statusCode.Bad_Request
      );
    }

    // Check admin user credentials if provided
    let passwordHash: string | undefined;
    if (input.adminUser) {
      const normalizedEmail = input.adminUser.email.trim().toLowerCase();
      const existingUser = await userRepo.findByEmail(normalizedEmail);
      if (existingUser) {
        throw new ErrorResponse(
          `User with email '${normalizedEmail}' already exists`,
          statusCode.Conflict
        );
      }

      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(input.adminUser.password, salt);
    }

    // Calculate dates
    const dates = this.calculatePeriodDates(
      input.subscription.billingCycle,
      input.subscription.status,
      input.subscription.trialDays
    );

    const result = await organizationRepo.onboard(
      {
        ...input,
        organization: {
          ...input.organization,
          slug: normalizedSlug,
        },
      },
      dates,
      passwordHash
    );

    return result;
  }

  /**
   * Get all organizations with pagination (PLATFORM_ADMIN)
   */
  async getAllOrganizations(query?: GetOrganizationsQueryInput) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const { organizations, total } = await organizationRepo.findAll({
      skip,
      take: limit,
      search: query?.search,
      status: query?.status,
    });

    const formatted = organizations.map((org) => {
      const activeSub = org.subscriptions[0] || null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        legalName: org.legalName,
        email: org.email,
        phone: org.phone,
        website: org.website,
        logoUrl: org.logoUrl,
        taxId: org.taxId,
        city: org.city,
        state: org.state,
        country: org.country,
        currency: org.currency,
        status: org.status,
        createdAt: org.createdAt,
        activeSubscription: activeSub
          ? {
              id: activeSub.id,
              status: activeSub.status,
              billingCycle: activeSub.billingCycle,
              currentPeriodStart: activeSub.currentPeriodStart,
              currentPeriodEnd: activeSub.currentPeriodEnd,
              trialEndsAt: activeSub.trialEndsAt,
              plan: {
                id: activeSub.plan.id,
                name: activeSub.plan.name,
                slug: activeSub.plan.slug,
                priceMonthly: activeSub.plan.priceMonthly,
                priceYearly: activeSub.plan.priceYearly,
                currency: activeSub.plan.currency,
                limits: activeSub.plan.planFeature
                  ? {
                      maxUser: activeSub.plan.planFeature.maxUser,
                      maxEmployee: activeSub.plan.planFeature.maxEmployee,
                    }
                  : null,
              },
            }
          : null,
        totalUsers: org._count.users,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      org: formatted,
      organizations: formatted,
      pagination: {
        totalOrg: total,
        totalPage: totalPages,
        currentPage: page,
        count: formatted.length,
        limit,
      },
    };
  }

  /**
   * Get single organization details by ID (PLATFORM_ADMIN)
   */
  async getOrganizationById(id: string) {
    const org = await organizationRepo.findById(id);
    if (!org) {
      throw new ErrorResponse("Organization not found", statusCode.Not_Found);
    }
    return org;
  }

  /**
   * Update organization details (PLATFORM_ADMIN)
   */
  async updateOrganization(id: string, input: UpdateOrganizationInput, file?: Express.Multer.File) {
    const existing = await organizationRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Organization not found", statusCode.Not_Found);
    }

    if (file) {
      const uploadResult = await storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: "homio/organizations/logos",
          resourceType: "image",
        }
      );

      const logoData: ImageType = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };

      input.logoUrl = logoData;
    }

    const updated = await organizationRepo.update(id, input);
    return updated;
  }

  /**
   * Update organization status e.g. ACTIVE, SUSPENDED (PLATFORM_ADMIN)
   */
  async updateOrganizationStatus(id: string, status: any) {
    const existing = await organizationRepo.findById(id);
    if (!existing) {
      throw new ErrorResponse("Organization not found", statusCode.Not_Found);
    }

    const updated = await organizationRepo.updateStatus(id, status);
    return updated;
  }

  /**
   * Assign or change organization's subscription plan (PLATFORM_ADMIN)
   */
  async assignSubscription(organizationId: string, input: AssignSubscriptionInput) {
    const org = await organizationRepo.findById(organizationId);
    if (!org) {
      throw new ErrorResponse("Organization not found", statusCode.Not_Found);
    }

    const plan = await subscriptionRepo.findById(input.planId);
    if (!plan) {
      throw new ErrorResponse("Subscription plan not found", statusCode.Not_Found);
    }
    if (!plan.isActive) {
      throw new ErrorResponse("Cannot assign an inactive plan", statusCode.Bad_Request);
    }

    const dates = this.calculatePeriodDates(
      input.billingCycle,
      input.status,
      input.trialDays ?? 14
    );

    const newSubscription = await organizationRepo.assignSubscription(
      organizationId,
      input,
      dates
    );

    return newSubscription;
  }
}

export const organizationService = new OrganizationService();

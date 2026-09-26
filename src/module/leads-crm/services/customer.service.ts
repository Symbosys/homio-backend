import { customerRepo } from "../repos/customer.repo.js";
import { userRepo } from "../../user/repos/user.repo.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode, type ImageType, Prisma } from "../../../types/types.js";
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
  GetCustomersQueryInput,
} from "../validators/customer.validator.js";
import type { CreateCustomerActivityInput } from "../validators/lead-activity.validator.js";
import type { UploadCustomerDocumentInput } from "../validators/lead-document.validator.js";

export class CustomerService {
  /**
   * Create a new Customer with optional avatar upload and platform User lookup
   */
  async createCustomer(
    organizationId: string,
    input: CreateCustomerInput,
    avatarFile?: Express.Multer.File
  ) {
    const normalizedPhone = input.phone.trim();
    const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

    // Check if customer already exists for this tenant
    const existingInOrg = await customerRepo.findByPhone(normalizedPhone, organizationId);
    if (existingInOrg) {
      throw new ErrorResponse(
        `Customer with phone number '${normalizedPhone}' already exists in your organization`,
        statusCode.Conflict
      );
    }

    // Check if platform User exists for cross-tenant linking
    let linkedUserId: string | null = null;
    const existingUser = await userRepo.findByPhone(normalizedPhone);
    if (existingUser) {
      linkedUserId = existingUser.id;
    } else if (normalizedEmail) {
      const existingUserByEmail = await userRepo.findByEmail(normalizedEmail);
      if (existingUserByEmail) {
        linkedUserId = existingUserByEmail.id;
      }
    }

    // Handle avatar upload via multi-cloud storage
    let avatarData: ImageType | undefined;
    if (avatarFile) {
      const uploadResult = await storageService.upload(
        {
          buffer: avatarFile.buffer,
          originalname: avatarFile.originalname,
          mimetype: avatarFile.mimetype,
          size: avatarFile.size,
        },
        {
          folder: "homio/customers/avatars",
          resourceType: "image",
        }
      );

      avatarData = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    const customerCode = await customerRepo.generateCustomerCode(organizationId);

    const customer = await customerRepo.create(organizationId, {
      ...input,
      phone: normalizedPhone,
      email: normalizedEmail,
      customerCode,
      userId: linkedUserId,
      avatarUrl: avatarData ? (avatarData as unknown as Prisma.InputJsonValue) : undefined,
    });

    return customer;
  }

  /**
   * Get all customers with pagination and filtering
   */
  async getCustomers(organizationId: string, query: GetCustomersQueryInput) {
    return customerRepo.findAll(organizationId, query);
  }

  /**
   * Get customer details by ID
   */
  async getCustomerById(id: string, organizationId: string) {
    const customer = await customerRepo.findById(id, organizationId);
    if (!customer) {
      throw new ErrorResponse("Customer not found", statusCode.Not_Found);
    }
    return customer;
  }

  /**
   * Update customer profile
   */
  async updateCustomer(
    id: string,
    organizationId: string,
    input: UpdateCustomerInput,
    avatarFile?: Express.Multer.File
  ) {
    const existing = await customerRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Customer not found", statusCode.Not_Found);
    }

    if (input.phone && input.phone !== existing.phone) {
      const duplicate = await customerRepo.findByPhone(input.phone.trim(), organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse(
          `Another customer with phone '${input.phone}' already exists`,
          statusCode.Conflict
        );
      }
    }

    let avatarData: ImageType | undefined;
    if (avatarFile) {
      const uploadResult = await storageService.upload(
        {
          buffer: avatarFile.buffer,
          originalname: avatarFile.originalname,
          mimetype: avatarFile.mimetype,
          size: avatarFile.size,
        },
        {
          folder: "homio/customers/avatars",
          resourceType: "image",
        }
      );

      avatarData = {
        id: uploadResult.publicId,
        url: uploadResult.secureUrl || uploadResult.url,
        bytes: uploadResult.bytes,
        format: uploadResult.format,
        provider: uploadResult.provider,
      };
    }

    const updated = await customerRepo.update(id, organizationId, {
      ...input,
      ...(avatarData ? { avatarUrl: avatarData as unknown as Prisma.InputJsonValue } : {}),
    });

    return updated;
  }

  /**
   * Toggle Customer Client Portal Access
   */
  async togglePortalAccess(id: string, organizationId: string, enabled: boolean) {
    const existing = await customerRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Customer not found", statusCode.Not_Found);
    }

    const updated = await customerRepo.update(id, organizationId, {
      portalAccessEnabled: enabled,
      ...(enabled && !existing.portalActivatedAt ? { portalActivatedAt: new Date() } : {}),
    });

    return updated;
  }

  /**
   * Soft delete customer
   */
  async deleteCustomer(id: string, organizationId: string) {
    const existing = await customerRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Customer not found", statusCode.Not_Found);
    }

    await customerRepo.softDelete(id, organizationId);
    return { message: "Customer deleted successfully" };
  }

  /**
   * Add Customer Activity log
   */
  async addCustomerActivity(
    organizationId: string,
    customerId: string,
    input: CreateCustomerActivityInput
  ) {
    const customer = await customerRepo.findById(customerId, organizationId);
    if (!customer) {
      throw new ErrorResponse("Customer not found", statusCode.Not_Found);
    }

    return customerRepo.createActivity({
      organizationId,
      customerId,
      type: input.type,
      title: input.title,
      description: input.description,
      performedById: input.performedById,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
    });
  }

  /**
   * Upload Customer Document / KYC
   */
  async uploadCustomerDocument(
    organizationId: string,
    customerId: string,
    input: UploadCustomerDocumentInput,
    file: Express.Multer.File,
    uploadedById?: string | null
  ) {
    const customer = await customerRepo.findById(customerId, organizationId);
    if (!customer) {
      throw new ErrorResponse("Customer not found", statusCode.Not_Found);
    }

    const isImage = file.mimetype?.startsWith("image/") || file.originalname.match(/\.(jpe?g|png|webp|gif)$/i);

    const uploadResult = await storageService.upload(
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      },
      {
        folder: `homio/organizations/${organizationId}/customers/${customerId}/docs`,
        resourceType: isImage ? "image" : "auto",
      }
    );

    const fileFormat =
      uploadResult.format ||
      file.originalname.split(".").pop()?.toLowerCase() ||
      file.mimetype.split("/")[1] ||
      "pdf";

    const docFile: ImageType = {
      id: uploadResult.publicId,
      url: uploadResult.secureUrl || uploadResult.url,
      bytes: uploadResult.bytes || file.size,
      format: fileFormat,
      provider: uploadResult.provider,
    };

    const doc = await customerRepo.createDocument({
      organizationId,
      customerId,
      name: input.name || file.originalname,
      category: input.category || "KYC_ID",
      fileUrl: docFile as unknown as Prisma.InputJsonValue,
      uploadedById,
    });

    return doc;
  }

  /**
   * Delete Customer Document
   */
  async deleteCustomerDocument(docId: string, organizationId: string) {
    await customerRepo.deleteDocument(docId, organizationId);
    return { message: "Document deleted successfully" };
  }
}

export const customerService = new CustomerService();

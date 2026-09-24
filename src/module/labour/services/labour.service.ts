import { labourRepo } from "../repos/labour.repo.js";
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
   */
  async createLabour(organizationId: string, payload: CreateLabourInput, file?: Express.Multer.File) {
    if (file) {
      const uploadResult = await storageService.upload(file, {
        folder: `organizations/${organizationId}/labour/photos`,
      });
      payload.photoUrl = uploadResult;
    }
    return labourRepo.create(organizationId, payload);
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
   */
  async updateLabour(id: string, organizationId: string, payload: UpdateLabourInput, file?: Express.Multer.File) {
    // Verify existence & ownership
    await this.getLabourById(id, organizationId);
    if (file) {
      const uploadResult = await storageService.upload(file, {
        folder: `organizations/${organizationId}/labour/photos`,
      });
      payload.photoUrl = uploadResult;
    }
    return labourRepo.update(id, organizationId, payload);
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

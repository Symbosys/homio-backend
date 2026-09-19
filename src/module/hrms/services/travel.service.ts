import { travelRepo } from "../repos/travel.repo.js";
import { prisma } from "../../../lib/prisma.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import type { ImageType } from "../../../types/types.js";
import type {
  CreateTravelInput,
  UpdateTravelInput,
  GetTravelsQueryInput,
  AssignEmployeesToTravelInput,
  UpdateTravelExpensesInput,
} from "../validators/travel.validator.js";

export class TravelService {
  /**
   * Helper: Resolve employee for user
   */
  private async resolveEmployeeForUser(userId: string, organizationId: string) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
    });
    if (!employee) {
      throw new ErrorResponse("Employee profile not found for your user account", statusCode.Forbidden);
    }
    return employee;
  }

  /**
   * Helper: Upload files to storage service
   */
  private async uploadDocuments(
    files: Express.Multer.File[] | undefined,
    organizationId: string,
    subfolder: string = "itinerary"
  ): Promise<ImageType[]> {
    if (!files || files.length === 0) return [];

    const uploadPromises = files.map((file) =>
      storageService.upload(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
        },
        {
          folder: `homio/organizations/${organizationId}/hrms/travels/${subfolder}`,
          resourceType: "auto",
        }
      )
    );

    const results = await Promise.all(uploadPromises);

    return results.map((res, index) => ({
      id: res.publicId,
      url: res.secureUrl || res.url,
      bytes: res.bytes || files[index]?.size || 0,
      format: res.format || "pdf",
      provider: res.provider || "cloudinary",
    }));
  }

  /**
   * Create field travel trip
   */
  async createTravel(
    organizationId: string,
    input: CreateTravelInput,
    files?: Express.Multer.File[],
    userId?: string
  ) {
    if (input.code) {
      const existing = await travelRepo.findByCode(input.code, organizationId);
      if (existing) {
        throw new ErrorResponse(
          `Field travel with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    if (new Date(input.startDate) > new Date(input.endDate)) {
      throw new ErrorResponse("End date cannot be earlier than start date", statusCode.Bad_Request);
    }

    const uploadedDocuments = await this.uploadDocuments(files, organizationId, "documents");
    return travelRepo.create(organizationId, input, uploadedDocuments, userId);
  }

  /**
   * Get all field travels
   */
  async getTravels(organizationId: string, filters: GetTravelsQueryInput) {
    return travelRepo.findAll(organizationId, filters);
  }

  /**
   * Get trips assigned to authenticated employee
   */
  async getMyTravels(organizationId: string, userId: string, page: number = 1, limit: number = 20) {
    const employee = await this.resolveEmployeeForUser(userId, organizationId);
    return travelRepo.findByEmployee(employee.id, organizationId, page, limit);
  }

  /**
   * Get single travel by ID
   */
  async getTravelById(id: string, organizationId: string) {
    const travel = await travelRepo.findById(id, organizationId);
    if (!travel) {
      throw new ErrorResponse("Field travel trip not found", statusCode.Not_Found);
    }
    return travel;
  }

  /**
   * Update travel details
   */
  async updateTravel(id: string, organizationId: string, input: UpdateTravelInput, userId?: string) {
    const existing = await this.getTravelById(id, organizationId);

    const start = input.startDate ? new Date(input.startDate) : new Date(existing.startDate);
    const end = input.endDate ? new Date(input.endDate) : new Date(existing.endDate);

    if (start > end) {
      throw new ErrorResponse("End date cannot be earlier than start date", statusCode.Bad_Request);
    }

    if (input.code) {
      const duplicateCode = await travelRepo.findByCode(input.code, organizationId);
      if (duplicateCode && duplicateCode.id !== id) {
        throw new ErrorResponse(
          `Field travel with code '${input.code}' already exists in your organization`,
          statusCode.Conflict
        );
      }
    }

    return travelRepo.update(id, organizationId, input, userId);
  }

  /**
   * Soft delete travel
   */
  async deleteTravel(id: string, organizationId: string, userId?: string) {
    await this.getTravelById(id, organizationId);
    return travelRepo.softDelete(id, organizationId, userId);
  }

  /**
   * Bulk assign/unassign employees
   */
  async assignEmployees(id: string, organizationId: string, input: AssignEmployeesToTravelInput) {
    await this.getTravelById(id, organizationId);
    return travelRepo.assignEmployees(id, input.employeeIds, input.action);
  }

  /**
   * Record actual expenses & receipts
   */
  async updateExpenses(
    id: string,
    organizationId: string,
    input: UpdateTravelExpensesInput,
    files?: Express.Multer.File[],
    userId?: string
  ) {
    await this.getTravelById(id, organizationId);
    const uploadedReceipts = await this.uploadDocuments(files, organizationId, "expenses");
    return travelRepo.updateExpenses(id, organizationId, input, uploadedReceipts, userId);
  }

  /**
   * Update status
   */
  async updateStatus(
    id: string,
    organizationId: string,
    status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
    remarks?: string | null,
    userId?: string
  ) {
    await this.getTravelById(id, organizationId);
    return travelRepo.updateStatus(id, organizationId, status, remarks, userId);
  }
}

export const travelService = new TravelService();

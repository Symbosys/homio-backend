import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { complaintSnagCategoryRepo } from "../repos/complaint-snag-category.repo.js";
import type {
  CreateComplaintSnagCategoryInput,
  UpdateComplaintSnagCategoryInput,
  GetComplaintSnagCategoriesQuery,
} from "../validators/complaint-snag-category.validator.js";

export class ComplaintSnagCategoryService {
  /**
   * Create a new ComplaintSnagCategory with duplicate checks
   */
  async createCategory(organizationId: string, data: CreateComplaintSnagCategoryInput) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const [existingName, existingSlug] = await Promise.all([
      complaintSnagCategoryRepo.findByName(data.name, organizationId),
      complaintSnagCategoryRepo.findBySlug(slug, organizationId),
    ]);

    if (existingName) {
      throw new ErrorResponse("A complaint/snag category with this name already exists", statusCode.Conflict);
    }
    if (existingSlug) {
      throw new ErrorResponse("A complaint/snag category with this slug already exists", statusCode.Conflict);
    }

    return complaintSnagCategoryRepo.create(organizationId, { ...data, slug });
  }

  /**
   * Get paginated complaint and snag categories
   */
  async getCategories(organizationId: string, query: GetComplaintSnagCategoriesQuery) {
    return complaintSnagCategoryRepo.findAll(organizationId, query);
  }

  /**
   * Get category by ID with usage counts
   */
  async getCategoryById(id: string, organizationId: string) {
    const category = await complaintSnagCategoryRepo.findById(id, organizationId);
    if (!category) {
      throw new ErrorResponse("Complaint/snag category not found", statusCode.Not_Found);
    }
    const usage = await complaintSnagCategoryRepo.countUsage(id, organizationId);
    return { ...category, _count: usage };
  }

  /**
   * Update category
   */
  async updateCategory(id: string, organizationId: string, data: UpdateComplaintSnagCategoryInput) {
    const existing = await complaintSnagCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Complaint/snag category not found", statusCode.Not_Found);
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await complaintSnagCategoryRepo.findByName(data.name, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A complaint/snag category with this name already exists", statusCode.Conflict);
      }
    }

    if (data.slug && data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const duplicate = await complaintSnagCategoryRepo.findBySlug(data.slug, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A complaint/snag category with this slug already exists", statusCode.Conflict);
      }
    }

    return complaintSnagCategoryRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete category
   */
  async deleteCategory(id: string, organizationId: string) {
    const existing = await complaintSnagCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Complaint/snag category not found", statusCode.Not_Found);
    }

    if (existing.isSystem) {
      throw new ErrorResponse("Core system categories cannot be deleted. Deactivate instead.", statusCode.Forbidden);
    }

    const usage = await complaintSnagCategoryRepo.countUsage(id, organizationId);
    if (usage.total > 0) {
      throw new ErrorResponse(
        `Cannot delete this category because it is linked to ${usage.complaintCount} complaint(s) and ${usage.snagCount} snag(s). Deactivate it instead.`,
        statusCode.Conflict
      );
    }

    return complaintSnagCategoryRepo.softDelete(id, organizationId);
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string) {
    const updated = await complaintSnagCategoryRepo.toggleActive(id, organizationId);
    if (!updated) {
      throw new ErrorResponse("Complaint/snag category not found", statusCode.Not_Found);
    }
    return updated;
  }
}

export const complaintSnagCategoryService = new ComplaintSnagCategoryService();

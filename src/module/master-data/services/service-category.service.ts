import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { serviceCategoryRepo } from "../repos/service-category.repo.js";
import type {
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
  GetServiceCategoriesQuery,
} from "../validators/service-category.validator.js";

export class ServiceCategoryService {
  /**
   * Create a new ServiceCategory with duplicate checks
   */
  async createCategory(organizationId: string, data: CreateServiceCategoryInput) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const [existingName, existingSlug] = await Promise.all([
      serviceCategoryRepo.findByName(data.name, organizationId),
      serviceCategoryRepo.findBySlug(slug, organizationId),
    ]);

    if (existingName) {
      throw new ErrorResponse("A service category with this name already exists", statusCode.Conflict);
    }
    if (existingSlug) {
      throw new ErrorResponse("A service category with this slug already exists", statusCode.Conflict);
    }

    return serviceCategoryRepo.create(organizationId, { ...data, slug });
  }

  /**
   * Get paginated service categories
   */
  async getCategories(organizationId: string, query: GetServiceCategoriesQuery) {
    return serviceCategoryRepo.findAll(organizationId, query);
  }

  /**
   * Get category by ID with usage counts
   */
  async getCategoryById(id: string, organizationId: string) {
    const category = await serviceCategoryRepo.findById(id, organizationId);
    if (!category) {
      throw new ErrorResponse("Service category not found", statusCode.Not_Found);
    }
    const usage = await serviceCategoryRepo.countUsage(id, organizationId);
    return { ...category, _count: usage };
  }

  /**
   * Update service category
   */
  async updateCategory(id: string, organizationId: string, data: UpdateServiceCategoryInput) {
    const existing = await serviceCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Service category not found", statusCode.Not_Found);
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await serviceCategoryRepo.findByName(data.name, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A service category with this name already exists", statusCode.Conflict);
      }
    }

    if (data.slug && data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const duplicate = await serviceCategoryRepo.findBySlug(data.slug, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A service category with this slug already exists", statusCode.Conflict);
      }
    }

    return serviceCategoryRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete service category
   */
  async deleteCategory(id: string, organizationId: string) {
    const existing = await serviceCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Service category not found", statusCode.Not_Found);
    }

    if (existing.isSystem) {
      throw new ErrorResponse("Core system service categories cannot be deleted. Deactivate instead.", statusCode.Forbidden);
    }

    const usage = await serviceCategoryRepo.countUsage(id, organizationId);
    if (usage.total > 0) {
      throw new ErrorResponse(
        `Cannot delete this category because it is used by ${usage.leadCount} lead(s), ${usage.projectCount} project(s), and ${usage.requestCount} after-sales request(s). Deactivate it instead.`,
        statusCode.Conflict
      );
    }

    return serviceCategoryRepo.softDelete(id, organizationId);
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string) {
    const updated = await serviceCategoryRepo.toggleActive(id, organizationId);
    if (!updated) {
      throw new ErrorResponse("Service category not found", statusCode.Not_Found);
    }
    return updated;
  }
}

export const serviceCategoryService = new ServiceCategoryService();

import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import {
  categoryRepository,
  type CategoryRepository,
} from "../repos/category.repo.js";
import type {
  CreateServiceCategoryInput,
  UpdateServiceCategoryInput,
  GetServiceCategoriesQueryInput,
} from "../validators/category.validator.js";

export class CategoryService {
  constructor(private readonly repo: CategoryRepository = categoryRepository) {}

  /**
   * Create a new service category
   */
  async createCategory(organizationId: string, input: CreateServiceCategoryInput) {
    const existingByName = await this.repo.findByName(organizationId, input.name);
    if (existingByName) {
      throw new ErrorResponse(
        `Service category with name "${input.name}" already exists`,
        statusCode.Conflict
      );
    }

    const slug =
      input.slug ||
      input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const existingBySlug = await this.repo.findBySlug(organizationId, slug);
    if (existingBySlug) {
      throw new ErrorResponse(
        `Service category with slug "${slug}" already exists`,
        statusCode.Conflict
      );
    }

    return this.repo.create(organizationId, { ...input, slug });
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(organizationId: string, id: string) {
    const category = await this.repo.findById(organizationId, id);
    if (!category) {
      throw new ErrorResponse("Service category not found", statusCode.Not_Found);
    }
    return category;
  }

  /**
   * List paginated service categories
   */
  async getCategories(organizationId: string, query: GetServiceCategoriesQueryInput) {
    return this.repo.list(organizationId, query);
  }

  /**
   * Update category
   */
  async updateCategory(
    organizationId: string,
    id: string,
    input: UpdateServiceCategoryInput
  ) {
    await this.getCategoryById(organizationId, id);

    if (input.name) {
      const existing = await this.repo.findByName(organizationId, input.name);
      if (existing && existing.id !== id) {
        throw new ErrorResponse(
          `Service category with name "${input.name}" already exists`,
          statusCode.Conflict
        );
      }
    }

    if (input.slug) {
      const existing = await this.repo.findBySlug(organizationId, input.slug);
      if (existing && existing.id !== id) {
        throw new ErrorResponse(
          `Service category with slug "${input.slug}" already exists`,
          statusCode.Conflict
        );
      }
    }

    return this.repo.update(organizationId, id, input);
  }

  /**
   * Toggle category active status
   */
  async toggleCategoryStatus(organizationId: string, id: string) {
    const category = await this.getCategoryById(organizationId, id);
    return this.repo.update(organizationId, id, { isActive: !category.isActive });
  }

  /**
   * Soft delete category
   */
  async deleteCategory(organizationId: string, id: string) {
    await this.getCategoryById(organizationId, id);
    return this.repo.softDelete(organizationId, id);
  }

  /**
   * Seed standard default categories
   */
  async seedDefaultCategories(organizationId: string) {
    return this.repo.seedDefaults(organizationId);
  }
}

export const categoryService = new CategoryService();

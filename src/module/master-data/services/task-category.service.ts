import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { taskCategoryRepo } from "../repos/task-category.repo.js";
import type {
  CreateTaskCategoryInput,
  UpdateTaskCategoryInput,
  GetTaskCategoriesQuery,
} from "../validators/task-category.validator.js";

export class TaskCategoryService {
  /**
   * Create a new TaskCategory with duplicate checks
   */
  async createCategory(organizationId: string, data: CreateTaskCategoryInput) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const [existingName, existingSlug] = await Promise.all([
      taskCategoryRepo.findByName(data.name, organizationId),
      taskCategoryRepo.findBySlug(slug, organizationId),
    ]);

    if (existingName) {
      throw new ErrorResponse("A task category with this name already exists", statusCode.Conflict);
    }
    if (existingSlug) {
      throw new ErrorResponse("A task category with this slug already exists", statusCode.Conflict);
    }

    return taskCategoryRepo.create(organizationId, { ...data, slug });
  }

  /**
   * Get paginated task categories
   */
  async getCategories(organizationId: string, query: GetTaskCategoriesQuery) {
    return taskCategoryRepo.findAll(organizationId, query);
  }

  /**
   * Get category by ID with task count
   */
  async getCategoryById(id: string, organizationId: string) {
    const category = await taskCategoryRepo.findById(id, organizationId);
    if (!category) {
      throw new ErrorResponse("Task category not found", statusCode.Not_Found);
    }
    const taskCount = await taskCategoryRepo.countUsage(id, organizationId);
    return { ...category, _count: { tasks: taskCount } };
  }

  /**
   * Update category
   */
  async updateCategory(id: string, organizationId: string, data: UpdateTaskCategoryInput) {
    const existing = await taskCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Task category not found", statusCode.Not_Found);
    }

    if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await taskCategoryRepo.findByName(data.name, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A task category with this name already exists", statusCode.Conflict);
      }
    }

    if (data.slug && data.slug.toLowerCase() !== existing.slug.toLowerCase()) {
      const duplicate = await taskCategoryRepo.findBySlug(data.slug, organizationId);
      if (duplicate && duplicate.id !== id) {
        throw new ErrorResponse("A task category with this slug already exists", statusCode.Conflict);
      }
    }

    return taskCategoryRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete category
   */
  async deleteCategory(id: string, organizationId: string) {
    const existing = await taskCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Task category not found", statusCode.Not_Found);
    }

    if (existing.isSystem) {
      throw new ErrorResponse("Core system task categories cannot be deleted. Deactivate instead.", statusCode.Forbidden);
    }

    const taskCount = await taskCategoryRepo.countUsage(id, organizationId);
    if (taskCount > 0) {
      throw new ErrorResponse(
        `Cannot delete this category because it is linked to ${taskCount} task(s). Deactivate it instead.`,
        statusCode.Conflict
      );
    }

    return taskCategoryRepo.softDelete(id, organizationId);
  }

  /**
   * Toggle active state
   */
  async toggleActive(id: string, organizationId: string) {
    const updated = await taskCategoryRepo.toggleActive(id, organizationId);
    if (!updated) {
      throw new ErrorResponse("Task category not found", statusCode.Not_Found);
    }
    return updated;
  }
}

export const taskCategoryService = new TaskCategoryService();

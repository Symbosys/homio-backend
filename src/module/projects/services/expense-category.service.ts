import { prisma } from "../../../lib/prisma.js";
import { ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { expenseCategoryRepo } from "../repos/expense-category.repo.js";
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
  GetExpenseCategoriesQuery,
} from "../validators/expense-category.validator.js";

export class ExpenseCategoryService {
  /**
   * Create a new ExpenseCategory with duplicate checks
   */
  async createCategory(organizationId: string, data: CreateExpenseCategoryInput) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");

    const [existingName, existingSlug] = await Promise.all([
      expenseCategoryRepo.findByName(data.name, organizationId),
      expenseCategoryRepo.findBySlug(slug, organizationId),
    ]);

    if (existingName) {
      throw new ErrorResponse("An expense category with this name already exists", statusCode.Conflict);
    }
    if (existingSlug) {
      throw new ErrorResponse("An expense category with this slug already exists", statusCode.Conflict);
    }

    return expenseCategoryRepo.create(organizationId, { ...data, slug });
  }

  /**
   * Get paginated expense categories
   */
  async getCategories(organizationId: string, query: GetExpenseCategoriesQuery) {
    return expenseCategoryRepo.findAll(organizationId, query);
  }

  /**
   * Get single category by ID
   */
  async getCategoryById(id: string, organizationId: string) {
    const category = await expenseCategoryRepo.findById(id, organizationId);
    if (!category) {
      throw new ErrorResponse("Expense category not found", statusCode.Not_Found);
    }
    return category;
  }

  /**
   * Update expense category
   */
  async updateCategory(id: string, organizationId: string, data: UpdateExpenseCategoryInput) {
    const existing = await expenseCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Expense category not found", statusCode.Not_Found);
    }

    if (data.name && data.name !== existing.name) {
      const duplicateName = await expenseCategoryRepo.findByName(data.name, organizationId);
      if (duplicateName && duplicateName.id !== id) {
        throw new ErrorResponse("An expense category with this name already exists", statusCode.Conflict);
      }
    }

    if (data.slug && data.slug !== existing.slug) {
      const duplicateSlug = await expenseCategoryRepo.findBySlug(data.slug, organizationId);
      if (duplicateSlug && duplicateSlug.id !== id) {
        throw new ErrorResponse("An expense category with this slug already exists", statusCode.Conflict);
      }
    }

    return expenseCategoryRepo.update(id, organizationId, data);
  }

  /**
   * Soft delete expense category with safety check
   */
  async deleteCategory(id: string, organizationId: string) {
    const existing = await expenseCategoryRepo.findById(id, organizationId);
    if (!existing) {
      throw new ErrorResponse("Expense category not found", statusCode.Not_Found);
    }

    // Check if category is actively referenced by expenses
    const count = await prisma.expense.count({
      where: { categoryId: id, isDeleted: false },
    });
    if (count > 0) {
      throw new ErrorResponse(
        `Cannot delete this category because it is referenced by ${count} active expense(s). Archive or reassign them first.`,
        statusCode.Bad_Request
      );
    }

    return expenseCategoryRepo.delete(id);
  }

  /**
   * Seed default system categories for organization
   */
  async seedDefaults(organizationId: string) {
    return expenseCategoryRepo.seedDefaults(organizationId);
  }
}

export const expenseCategoryService = new ExpenseCategoryService();

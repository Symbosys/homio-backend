import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { taskCategoryService } from "../services/task-category.service.js";
import {
  createTaskCategorySchema,
  updateTaskCategorySchema,
  getTaskCategoriesQuerySchema,
  taskCategoryIdParamSchema,
} from "../validators/task-category.validator.js";

/**
 * @route   POST /api/v1/master-data/task-categories
 * @desc    Create a new task category for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const createTaskCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createTaskCategorySchema.parse({ body: req.body });
  const result = await taskCategoryService.createCategory(organizationId, parsed.body);
  return SuccessResponse(res, "Task category created successfully", result, statusCode.Created);
});

/**
 * @route   GET /api/v1/master-data/task-categories
 * @desc    Fetch paginated list of task categories for the organization
 * @access  Private (Authenticated Tenant User)
 */
export const getTaskCategories = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedQuery = getTaskCategoriesQuerySchema.parse({ query: req.query });
  const result = await taskCategoryService.getCategories(organizationId, parsedQuery.query);
  return SuccessResponse(res, "Task categories retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/master-data/task-categories/:id
 * @desc    Fetch details of a single task category with usage count
 * @access  Private (Authenticated Tenant User)
 */
export const getTaskCategoryById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = taskCategoryIdParamSchema.parse({ params: req.params });
  const result = await taskCategoryService.getCategoryById(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Task category retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/task-categories/:id
 * @desc    Update task category details
 * @access  Private (Authenticated Tenant User)
 */
export const updateTaskCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateTaskCategorySchema.parse({ params: req.params, body: req.body });
  const result = await taskCategoryService.updateCategory(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Task category updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/master-data/task-categories/:id
 * @desc    Soft delete a task category
 * @access  Private (Authenticated Tenant User)
 */
export const deleteTaskCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = taskCategoryIdParamSchema.parse({ params: req.params });
  await taskCategoryService.deleteCategory(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Task category deleted successfully", null, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/master-data/task-categories/:id/toggle-active
 * @desc    Toggle active state of a task category
 * @access  Private (Authenticated Tenant User)
 */
export const toggleActiveTaskCategory = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsedParams = taskCategoryIdParamSchema.parse({ params: req.params });
  const result = await taskCategoryService.toggleActive(parsedParams.params.id, organizationId);
  return SuccessResponse(res, "Task category status updated successfully", result, statusCode.OK);
});

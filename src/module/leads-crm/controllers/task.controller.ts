import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { taskService } from "../services/task.service.js";
import {
  createCustomTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  updateTaskPrioritySchema,
  addAssigneesSchema,
  addChecklistItemSchema,
  updateChecklistItemSchema,
  addTaskActivitySchema,
  uploadTaskDocumentSchema,
  bulkActionTasksSchema,
  taskIdParamSchema,
  taskAssigneeParamSchema,
  taskChecklistItemParamSchema,
  taskActivityIdParamSchema,
  getTasksQuerySchema,
  getTaskKanbanQuerySchema,
  submitTaskForReviewSchema,
  approveTaskSchema,
  rejectTaskForReworkSchema,
  holdTaskSchema,
} from "../validators/task.validator.js";
import { documentIdParamSchema } from "../validators/lead-document.validator.js";

/**
 * Controller: Create Task with multi-employee assignees & checklist
 */
export const createTask = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = createCustomTaskSchema.parse({ body: req.body });
  const result = await taskService.createTask(organizationId, parsed.body, req.user?.id);
  return SuccessResponse(res, "Task created successfully", result, statusCode.Created);
});

/**
 * Controller: Get paginated tasks with filters
 */
export const getTasks = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getTasksQuerySchema.parse({ query: req.query });
  const result = await taskService.getTasks(organizationId, parsed.query);
  return SuccessResponse(res, "Tasks retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get Kanban board view of tasks
 */
export const getTaskKanban = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = getTaskKanbanQuerySchema.parse({ query: req.query });
  const result = await taskService.getKanban(organizationId, parsed.query);
  return SuccessResponse(res, "Kanban board retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single task by ID
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = taskIdParamSchema.parse({ params: req.params });
  const result = await taskService.getTaskById(parsed.params.id, organizationId);
  return SuccessResponse(res, "Task details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update task details
 */
export const updateTask = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateTaskSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.updateTask(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Task updated successfully", result, statusCode.OK);
});

/**
 * Controller: Update task status (e.g. dragging card on Kanban board)
 */
export const updateTaskStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateTaskStatusSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.updateTaskStatus(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Task status updated successfully", result, statusCode.OK);
});

/**
 * Controller: Update task priority
 */
export const updateTaskPriority = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateTaskPrioritySchema.parse({ params: req.params, body: req.body });
  const result = await taskService.updateTaskPriority(parsed.params.id, organizationId, parsed.body);
  return SuccessResponse(res, "Task priority updated successfully", result, statusCode.OK);
});

/**
 * Controller: Submit task for review and verification
 */
export const submitTaskForReview = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = submitTaskForReviewSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.submitForReview(
    organizationId,
    parsed.params.id,
    parsed.body?.notes,
    req.user?.id
  );
  return SuccessResponse(res, "Task submitted for review successfully", result, statusCode.OK);
});

/**
 * Controller: Approve and verify task completion
 */
export const approveTask = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = approveTaskSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.approveTask(
    organizationId,
    parsed.params.id,
    parsed.body?.approvedById,
    parsed.body?.approvalRemarks,
    req.user?.id
  );
  return SuccessResponse(res, "Task approved and verified successfully", result, statusCode.OK);
});

/**
 * Controller: Reject task and request rework
 */
export const rejectTaskForRework = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = rejectTaskForReworkSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.rejectTaskForRework(
    organizationId,
    parsed.params.id,
    parsed.body.reworkNotes,
    req.user?.id
  );
  return SuccessResponse(res, "Task sent back for rework", result, statusCode.OK);
});

/**
 * Controller: Put task on hold
 */
export const holdTask = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = holdTaskSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.holdTask(
    organizationId,
    parsed.params.id,
    parsed.body.reason,
    req.user?.id
  );
  return SuccessResponse(res, "Task placed on hold successfully", result, statusCode.OK);
});

/**
 * Controller: Add assignees to task
 */
export const addTaskAssignees = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = addAssigneesSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.addAssignees(
    organizationId,
    parsed.params.id,
    parsed.body,
    req.user?.id
  );
  return SuccessResponse(res, "Assignees added successfully", result, statusCode.OK);
});

/**
 * Controller: Remove assignee from task
 */
export const removeTaskAssignee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = taskAssigneeParamSchema.parse({ params: req.params });
  const result = await taskService.removeAssignee(
    organizationId,
    parsed.params.id,
    parsed.params.employeeId
  );
  return SuccessResponse(res, "Assignee removed successfully", result, statusCode.OK);
});

/**
 * Controller: Set primary assignee on task
 */
export const setPrimaryTaskAssignee = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = taskAssigneeParamSchema.parse({ params: req.params });
  const result = await taskService.setPrimaryAssignee(
    organizationId,
    parsed.params.id,
    parsed.params.employeeId
  );
  return SuccessResponse(res, "Primary assignee set successfully", result, statusCode.OK);
});

/**
 * Controller: Add checklist item / subtask
 */
export const addTaskChecklistItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = addChecklistItemSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.addChecklistItem(organizationId, parsed.params.id, parsed.body);
  return SuccessResponse(res, "Checklist item added successfully", result, statusCode.Created);
});

/**
 * Controller: Update checklist item (toggle complete, edit title)
 */
export const updateTaskChecklistItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = updateChecklistItemSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.updateChecklistItem(
    organizationId,
    parsed.params.id,
    parsed.params.itemId,
    parsed.body
  );
  return SuccessResponse(res, "Checklist item updated successfully", result, statusCode.OK);
});

/**
 * Controller: Delete checklist item
 */
export const deleteTaskChecklistItem = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = taskChecklistItemParamSchema.parse({ params: req.params });
  const result = await taskService.deleteChecklistItem(
    organizationId,
    parsed.params.id,
    parsed.params.itemId
  );
  return SuccessResponse(res, "Checklist item deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Add task comment / activity
 */
export const addTaskActivity = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = addTaskActivitySchema.parse({ params: req.params, body: req.body });
  const result = await taskService.addActivity(organizationId, parsed.params.id, parsed.body);
  return SuccessResponse(res, "Comment added successfully", result, statusCode.Created);
});

/**
 * Controller: Delete task comment
 */
export const deleteTaskActivity = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = taskActivityIdParamSchema.parse({ params: req.params });
  const result = await taskService.deleteActivity(organizationId, "", parsed.params.id);
  return SuccessResponse(res, "Comment deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Upload task document
 */
export const uploadTaskDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  if (!req.file) {
    throw new ErrorResponse("Please attach a document file to upload", statusCode.Bad_Request);
  }

  const parsed = uploadTaskDocumentSchema.parse({ params: req.params, body: req.body });
  const result = await taskService.uploadDocument(
    organizationId,
    parsed.params.id,
    parsed.body,
    req.file,
    req.user?.id
  );
  return SuccessResponse(res, "Task document uploaded successfully", result, statusCode.Created);
});

/**
 * Controller: Delete task document
 */
export const deleteTaskDocument = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = documentIdParamSchema.parse({ params: req.params });
  const result = await taskService.deleteDocument(parsed.params.id, organizationId);
  return SuccessResponse(res, "Task document deleted successfully", result, statusCode.OK);
});

/**
 * Controller: Bulk actions on tasks
 */
export const bulkActionTasks = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = bulkActionTasksSchema.parse({ body: req.body });
  const result = await taskService.bulkActions(organizationId, parsed.body);
  return SuccessResponse(res, "Bulk action executed successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete task
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Bad_Request);
  }

  const parsed = taskIdParamSchema.parse({ params: req.params });
  const result = await taskService.deleteTask(parsed.params.id, organizationId);
  return SuccessResponse(res, "Task deleted successfully", result, statusCode.OK);
});

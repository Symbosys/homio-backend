import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import {
  createTask,
  getTasks,
  getTaskKanban,
  getTaskById,
  updateTask,
  updateTaskStatus,
  updateTaskPriority,
  addTaskAssignees,
  removeTaskAssignee,
  setPrimaryTaskAssignee,
  addTaskChecklistItem,
  updateTaskChecklistItem,
  deleteTaskChecklistItem,
  addTaskActivity,
  deleteTaskActivity,
  uploadTaskDocument,
  deleteTaskDocument,
  bulkActionTasks,
  deleteTask,
} from "../controllers/task.controller.js";

const taskRoutes = Router();

// Protect all task routes
taskRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

/**
 * @route   GET /api/v1/crm/tasks/kanban
 * @desc    Fetch tasks grouped by Kanban status columns (BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, COMPLETED)
 */
taskRoutes.get("/kanban", getTaskKanban);

/**
 * @route   POST /api/v1/crm/tasks/bulk
 * @desc    Execute batch actions on multiple tasks (bulk status transition, priority change, mass delete)
 */
taskRoutes.post("/bulk", bulkActionTasks);

/**
 * @route   POST /api/v1/crm/tasks
 * @desc    Create a new task with multiple employee assignees and checklist subtasks
 */
taskRoutes.post("/", createTask);

/**
 * @route   GET /api/v1/crm/tasks
 * @desc    Fetch paginated list of tasks with priority, status, assignee, and polymorphic filters
 */
taskRoutes.get("/", getTasks);

/**
 * @route   GET /api/v1/crm/tasks/:id
 * @desc    Get complete task details including multi-employee assignees, checklist, and audit feed
 */
taskRoutes.get("/:id", getTaskById);

/**
 * @route   PATCH /api/v1/crm/tasks/:id
 * @desc    Partial update of task attributes (title, due dates, estimates, notes)
 */
taskRoutes.patch("/:id", updateTask);

/**
 * @route   DELETE /api/v1/crm/tasks/:id
 * @desc    Soft-delete task record
 */
taskRoutes.delete("/:id", deleteTask);

/**
 * @route   PATCH /api/v1/crm/tasks/:id/status
 * @desc    Transition task status (e.g., when dragging cards on Kanban board)
 */
taskRoutes.patch("/:id/status", updateTaskStatus);

/**
 * @route   PATCH /api/v1/crm/tasks/:id/priority
 * @desc    Update task priority level (LOW, MEDIUM, HIGH, URGENT)
 */
taskRoutes.patch("/:id/priority", updateTaskPriority);

/**
 * @route   POST /api/v1/crm/tasks/:id/assignees
 * @desc    Assign multiple employees to task via TaskAssignee mapping table
 */
taskRoutes.post("/:id/assignees", addTaskAssignees);

/**
 * @route   DELETE /api/v1/crm/tasks/:id/assignees/:employeeId
 * @desc    Unassign an employee from task
 */
taskRoutes.delete("/:id/assignees/:employeeId", removeTaskAssignee);

/**
 * @route   PATCH /api/v1/crm/tasks/:id/assignees/:employeeId/primary
 * @desc    Set designated primary owner among assigned employees
 */
taskRoutes.patch("/:id/assignees/:employeeId/primary", setPrimaryTaskAssignee);

/**
 * @route   POST /api/v1/crm/tasks/:id/checklist
 * @desc    Add subtask checklist item to task
 */
taskRoutes.post("/:id/checklist", addTaskChecklistItem);

/**
 * @route   PATCH /api/v1/crm/tasks/:id/checklist/:itemId
 * @desc    Toggle checklist item completion or update title / sortOrder
 */
taskRoutes.patch("/:id/checklist/:itemId", updateTaskChecklistItem);

/**
 * @route   DELETE /api/v1/crm/tasks/:id/checklist/:itemId
 * @desc    Remove checklist subtask item
 */
taskRoutes.delete("/:id/checklist/:itemId", deleteTaskChecklistItem);

/**
 * @route   POST /api/v1/crm/tasks/:id/activities
 * @desc    Post comment / collaboration note to task feed
 */
taskRoutes.post("/:id/activities", addTaskActivity);

/**
 * @route   DELETE /api/v1/crm/tasks/activities/:id
 * @desc    Delete comment / activity entry from task feed
 */
taskRoutes.delete("/activities/:id", deleteTaskActivity);

/**
 * @route   POST /api/v1/crm/tasks/:id/documents
 * @desc    Upload file attachment for task via multi-cloud storage
 */
taskRoutes.post(
  "/:id/documents",
  upload.single("file", { category: "all", maxFileSize: 25 * 1024 * 1024 }),
  uploadTaskDocument
);

/**
 * @route   DELETE /api/v1/crm/tasks/documents/:id
 * @desc    Delete task file attachment
 */
taskRoutes.delete("/documents/:id", deleteTaskDocument);

export default taskRoutes;

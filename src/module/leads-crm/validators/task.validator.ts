import { z } from "zod";

export const TaskPriorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const TaskStatusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
]);
export const TaskTypeEnum = z.enum([
  "FOLLOW_UP",
  "SITE_MEASUREMENT",
  "DESIGN_DRAFT",
  "QUOTATION_PREP",
  "MATERIAL_SELECTION",
  "CLIENT_REVIEW",
  "PROJECT_MILESTONE",
  "SITE_INSPECTION",
  "DOCUMENT_VERIFICATION",
  "PAYMENT_FOLLOWUP",
  "GENERAL",
  "OTHER",
]);

export const taskIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
});

export const taskAssigneeParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
    employeeId: z.string().uuid("Invalid employee ID format"),
  }),
});

export const taskChecklistItemParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
    itemId: z.string().uuid("Invalid checklist item ID format"),
  }),
});

export const taskActivityIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task activity ID format"),
  }),
});

export const taskAssigneeInputSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID"),
  isPrimary: z.boolean().default(false).optional(),
});

export const createChecklistItemInputSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  sortOrder: z.coerce.number().int().default(0).optional(),
});

export const createCustomTaskSchema = z.object({
  body: z.object({
    // Polymorphic Linkage
    leadId: z.string().uuid("Invalid lead ID").optional().nullable(),
    customerId: z.string().uuid("Invalid customer ID").optional().nullable(),
    projectId: z.string().uuid("Invalid project ID").optional().nullable(),

    title: z.string().min(1, "Task title is required").max(200),
    description: z.string().max(3000).optional().nullable(),
    type: TaskTypeEnum.default("GENERAL").optional(),
    priority: TaskPriorityEnum.default("MEDIUM").optional(),
    status: TaskStatusEnum.default("TODO").optional(),

    // Dates
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),

    // Estimates
    estimatedHours: z.coerce.number().nonnegative().optional().nullable(),
    actualHours: z.coerce.number().nonnegative().optional().nullable(),

    // Primary owner / direct assignee
    assignedToId: z.string().uuid("Invalid employee ID").optional().nullable(),

    // Multi-Employee Assignees
    assignees: z.array(taskAssigneeInputSchema).default([]).optional(),

    // Subtasks / Checklist
    checklistItems: z.array(createChecklistItemInputSchema).default([]).optional(),

    remindAt: z.string().datetime().optional().nullable(),
    tags: z.array(z.string()).default([]).optional(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    leadId: z.string().uuid("Invalid lead ID").optional().nullable(),
    customerId: z.string().uuid("Invalid customer ID").optional().nullable(),
    projectId: z.string().uuid("Invalid project ID").optional().nullable(),

    title: z.string().min(1).max(200).optional(),
    description: z.string().max(3000).optional().nullable(),
    type: TaskTypeEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    status: TaskStatusEnum.optional(),

    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
    completedAt: z.string().datetime().optional().nullable(),

    estimatedHours: z.coerce.number().nonnegative().optional().nullable(),
    actualHours: z.coerce.number().nonnegative().optional().nullable(),

    assignedToId: z.string().uuid().optional().nullable(),
    assignees: z.array(taskAssigneeInputSchema).optional(),

    remindAt: z.string().datetime().optional().nullable(),
    tags: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateTaskStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    status: TaskStatusEnum,
  }),
});

export const updateTaskPrioritySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    priority: TaskPriorityEnum,
  }),
});

export const addAssigneesSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    assignees: z.array(taskAssigneeInputSchema).min(1, "At least one assignee is required"),
  }),
});

export const addChecklistItemSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    title: z.string().min(1, "Checklist item title is required").max(300),
    sortOrder: z.coerce.number().int().default(0).optional(),
  }),
});

export const updateChecklistItemSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
    itemId: z.string().uuid("Invalid checklist item ID format"),
  }),
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    isCompleted: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  }),
});

export const addTaskActivitySchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    type: z.string().default("COMMENT").optional(), // COMMENT, NOTE, STATUS_CHANGE
    content: z.string().min(1, "Comment content is required").max(2000),
    performedById: z.string().uuid("Invalid employee ID").optional().nullable(),
    metadata: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const uploadTaskDocumentSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    name: z.string().min(1, "Document name is required").max(150),
  }),
});

export const bulkActionTasksSchema = z.object({
  body: z.object({
    taskIds: z.array(z.string().uuid("Invalid task ID format")).min(1, "At least one task ID required"),
    action: z.enum(["UPDATE_STATUS", "UPDATE_PRIORITY", "ASSIGN", "DELETE"]),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    assignedToId: z.string().uuid().optional().nullable(),
  }).refine((data) => {
    if (data.action === "UPDATE_STATUS" && !data.status) return false;
    if (data.action === "UPDATE_PRIORITY" && !data.priority) return false;
    if (data.action === "ASSIGN" && data.assignedToId === undefined) return false;
    return true;
  }, {
    message: "Missing required fields for bulk action",
    path: ["action"],
  }),
});

export const getTasksQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
    search: z.string().optional(),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    type: TaskTypeEnum.optional(),
    leadId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(),
    fromDueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    fromDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    toDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    sortBy: z.enum(["dueDate", "createdAt", "priority", "taskCode"]).default("dueDate"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  }),
});

export const getTaskKanbanQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    priority: TaskPriorityEnum.optional(),
    type: TaskTypeEnum.optional(),
    leadId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    employeeId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(),
  }),
});

export type TaskAssigneeInput = z.infer<typeof taskAssigneeInputSchema>;
export type CreateTaskInput = z.infer<typeof createCustomTaskSchema>["body"];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>["body"];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>["body"];
export type UpdateTaskPriorityInput = z.infer<typeof updateTaskPrioritySchema>["body"];
export type AddAssigneesInput = z.infer<typeof addAssigneesSchema>["body"];
export type AddChecklistItemInput = z.infer<typeof addChecklistItemSchema>["body"];
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>["body"];
export type AddTaskActivityInput = z.infer<typeof addTaskActivitySchema>["body"];
export type UploadTaskDocumentInput = z.infer<typeof uploadTaskDocumentSchema>["body"];
export type BulkActionTasksInput = z.infer<typeof bulkActionTasksSchema>["body"];
export type GetTasksQueryInput = z.infer<typeof getTasksQuerySchema>["query"];
export type GetTaskKanbanQueryInput = z.infer<typeof getTaskKanbanQuerySchema>["query"];

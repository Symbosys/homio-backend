import { z } from "zod";
import {
  TaskPriority,
  TaskStatus,
  TaskType,
  ProjectStage,
} from "../../../types/types.js";

// ==========================================
// ENUMS VALIDATORS (DIRECTLY FROM PRISMA CLIENT)
// ==========================================

export const TaskPriorityEnum = z.nativeEnum(TaskPriority);
export const TaskStatusEnum = z.nativeEnum(TaskStatus);
export const TaskTypeEnum = z.nativeEnum(TaskType);
export const ProjectStageEnum = z.nativeEnum(ProjectStage);

// ==========================================
// CHECKLIST ITEM SCHEMA
// ==========================================

export const taskChecklistItemSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Checklist title is required").max(200),
  isCompleted: z.boolean().default(false),
});

// ==========================================
// PARAMS SCHEMAS
// ==========================================

export const taskIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
});

export const taskProjectIdParamSchema = z.object({
  params: z.object({
    projectId: z.string().uuid("Invalid project ID format"),
  }),
});

// ==========================================
// CREATE & UPDATE TASK SCHEMAS
// ==========================================

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, "Task title is required").max(200),
    description: z.string().max(5000).optional().nullable(),

    // Polymorphic Scoping
    projectId: z.string().uuid("Invalid project ID").optional().nullable(),
    leadId: z.string().uuid("Invalid lead ID").optional().nullable(),
    stage: ProjectStageEnum.optional().nullable(),

    // Task Classification & Priority
    type: TaskTypeEnum.default(TaskType.GENERAL).optional(),
    priority: TaskPriorityEnum.default(TaskPriority.MEDIUM).optional(),
    status: TaskStatusEnum.default(TaskStatus.TODO).optional(),

    // Personnel Ownership & Reviewer
    assignedToId: z.string().uuid("Invalid assignee ID").optional().nullable(),
    reviewerId: z.string().uuid("Invalid reviewer ID").optional().nullable(),
    assigneeIds: z.array(z.string().uuid("Invalid assignee ID")).default([]).optional(),

    // Timeline & Hours
    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    estimatedHours: z.number().nonnegative().optional().nullable(),
    actualHours: z.number().nonnegative().optional().nullable(),

    // Dynamic Category
    categoryId: z.string().uuid("Invalid category ID").optional().nullable(),

    // Checklist Items
    checklist: z.array(taskChecklistItemSchema).default([]).optional(),

    // Tags & Additional Custom Metadata
    tags: z.array(z.string()).default([]).optional(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateTaskSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),

    // Project & Stage Reassignment
    projectId: z.string().uuid().optional().nullable(),
    leadId: z.string().uuid().optional().nullable(),
    stage: ProjectStageEnum.optional().nullable(),

    type: TaskTypeEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    status: TaskStatusEnum.optional(),

    assignedToId: z.string().uuid().optional().nullable(),
    reviewerId: z.string().uuid().optional().nullable(),
    assigneeIds: z.array(z.string().uuid()).optional(),

    startDate: z.string().optional().nullable(),
    dueDate: z.string().optional().nullable(),
    estimatedHours: z.number().nonnegative().optional().nullable(),
    actualHours: z.number().nonnegative().optional().nullable(),

    categoryId: z.string().uuid().optional().nullable(),
    checklist: z.array(taskChecklistItemSchema).optional(),

    tags: z.array(z.string()).optional(),
    notes: z.string().max(2000).optional().nullable(),
    customFields: z.record(z.string(), z.any()).optional().nullable(),
    additionalInformation: z.record(z.string(), z.any()).optional().nullable(),
  }),
});

export const updateTaskStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    status: TaskStatusEnum,
    remarks: z.string().max(1000).optional().nullable(),
  }),
});

export const submitTaskReviewSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    remarks: z.string().max(1000).optional().nullable(),
  }).optional(),
});

export const reviewTaskDecisionSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid task ID format"),
  }),
  body: z.object({
    decision: z.enum(["APPROVE", "REWORK"]),
    remarks: z.string().max(1000).optional().nullable(),
  }),
});

// ==========================================
// QUERY SCHEMAS
// ==========================================

export const getTasksQuerySchema = z.object({
  query: z.object({
    projectId: z.string().uuid().optional(),
    leadId: z.string().uuid().optional(),
    stage: ProjectStageEnum.optional(),
    status: TaskStatusEnum.optional(),
    priority: TaskPriorityEnum.optional(),
    type: TaskTypeEnum.optional(),
    assignedToId: z.string().uuid().optional(),
    reviewerId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1).optional(),
    limit: z.coerce.number().int().positive().max(100).default(20).optional(),
    sortBy: z.enum(["createdAt", "dueDate", "startDate", "priority", "status", "title"]).default("createdAt").optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc").optional(),
  }),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateTaskInput = z.infer<typeof createTaskSchema>["body"];
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>["body"];
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>["body"];
export type ReviewTaskDecisionInput = z.infer<typeof reviewTaskDecisionSchema>["body"];
export type GetTasksQueryInput = z.infer<typeof getTasksQuerySchema>["query"];

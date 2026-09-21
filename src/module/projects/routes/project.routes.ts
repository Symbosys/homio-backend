import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import {
  createProject,
  getProjects,
  getProjectById,
  updateProject,
  deleteProject,
} from "../controllers/project.controller.js";
import milestoneRoutes from "./milestone.routes.js";
import progressRoutes from "./progress.routes.js";
import approvalRoutes from "./approval.routes.js";
import complaintRoutes from "./complaint.routes.js";
import siteVisitRoutes from "./site-visit.routes.js";
import expenseRoutes from "./expense.routes.js";
import expenseCategoryRoutes from "./expense-category.routes.js";

const projectRoutes = Router();

// Protect all project routes with authentication
projectRoutes.use(authenticate, authorize("PLATFORM_ADMIN", "ADMIN", "USER"));

// Global standalone / cross-project routes (mount before :id / :projectId patterns if needed)
projectRoutes.use("/expense-categories", expenseCategoryRoutes);
projectRoutes.use("/expenses", expenseRoutes);
projectRoutes.use("/site-visits", siteVisitRoutes);

// Sub-routes for Milestones, Progress, Approvals, Complaints, Site Visits & Expenses per Project
projectRoutes.use("/:projectId/milestones", milestoneRoutes);
projectRoutes.use("/:projectId/progress", progressRoutes);
projectRoutes.use("/:projectId/approvals", approvalRoutes);
projectRoutes.use("/:projectId/complaints", complaintRoutes);
projectRoutes.use("/:projectId/site-visits", siteVisitRoutes);
projectRoutes.use("/:projectId/expenses", expenseRoutes);

/**
 * @route   POST /api/v1/projects
 * @desc    Create a new Project with complete nested sub-components
 */
projectRoutes.post("/", createProject);

/**
 * @route   GET /api/v1/projects
 * @desc    Fetch paginated list of projects with search and filters
 */
projectRoutes.get("/", getProjects);

/**
 * @route   GET /api/v1/projects/:id
 * @desc    Fetch comprehensive details of a single project by ID
 */
projectRoutes.get("/:id", getProjectById);

/**
 * @route   PATCH /api/v1/projects/:id
 * @desc    Update project profile and any/all segregated sub-components
 */
projectRoutes.patch("/:id", updateProject);

/**
 * @route   DELETE /api/v1/projects/:id
 * @desc    Soft delete a project
 */
projectRoutes.delete("/:id", deleteProject);

export default projectRoutes;

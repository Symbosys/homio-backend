import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as departmentController from "../controllers/department.controller.js";
import * as teamController from "../controllers/team.controller.js";

const router = Router();

// Protect all department endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/departments
 * @desc    Create a new organizational department (e.g. Design, Sales, Execution)
 */
router.post("/", departmentController.createDepartment);

/**
 * @route   GET /api/v1/hrms/departments
 * @desc    Fetch paginated list of departments with search, status, and member count stats
 */
router.get("/", departmentController.getDepartments);

/**
 * @route   GET /api/v1/hrms/departments/:id
 * @desc    Get detailed department profile by ID including head of department
 */
router.get("/:id", departmentController.getDepartmentById);

/**
 * @route   PATCH /api/v1/hrms/departments/:id
 * @desc    Update department metadata (name, head of department, active status)
 */
router.patch("/:id", departmentController.updateDepartment);

/**
 * @route   DELETE /api/v1/hrms/departments/:id
 * @desc    Soft-delete department from organization
 */
router.delete("/:id", departmentController.deleteDepartment);

/**
 * @route   GET /api/v1/hrms/departments/:id/members
 * @desc    Fetch paginated list of employees belonging to specific department
 */
router.get("/:id/members", departmentController.getDepartmentMembers);

/**
 * @route   POST /api/v1/hrms/departments/:departmentId/teams
 * @desc    Create a new functional team nested under specific department
 */
router.post("/:departmentId/teams", teamController.createTeam);

/**
 * @route   GET /api/v1/hrms/departments/:departmentId/teams
 * @desc    Fetch all teams belonging to department
 */
router.get("/:departmentId/teams", teamController.getDepartmentTeams);

export default router;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as teamController from "../controllers/team.controller.js";

const router = Router();

// Protect all team endpoints with authentication
router.use(authenticate);

/**
 * @route   POST /api/v1/hrms/teams
 * @desc    Create a new team under a department
 */
router.post("/", teamController.createTeam);

/**
 * @route   GET /api/v1/hrms/teams
 * @desc    Fetch paginated list of teams with department and team lead filters
 */
router.get("/", teamController.getTeams);

/**
 * @route   GET /api/v1/hrms/teams/:id
 * @desc    Get detailed team profile by ID
 */
router.get("/:id", teamController.getTeamById);

/**
 * @route   PATCH /api/v1/hrms/teams/:id
 * @desc    Update team attributes (name, team lead, departmentId)
 */
router.patch("/:id", teamController.updateTeam);

/**
 * @route   DELETE /api/v1/hrms/teams/:id
 * @desc    Soft-delete team record
 */
router.delete("/:id", teamController.deleteTeam);

/**
 * @route   GET /api/v1/hrms/teams/:id/members
 * @desc    Fetch paginated list of team member employees
 */
router.get("/:id/members", teamController.getTeamMembers);

export default router;

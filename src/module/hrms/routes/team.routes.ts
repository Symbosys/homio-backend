import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as teamController from "../controllers/team.controller.js";

const router = Router();

// Protect all team endpoints with authentication
router.use(authenticate);

// Team CRUD & queries
router.post("/", teamController.createTeam);
router.get("/", teamController.getTeams);
router.get("/:id", teamController.getTeamById);
router.patch("/:id", teamController.updateTeam);
router.delete("/:id", teamController.deleteTeam);
router.get("/:id/members", teamController.getTeamMembers);

export default router;

import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import * as departmentController from "../controllers/department.controller.js";
import * as teamController from "../controllers/team.controller.js";

const router = Router();

// Protect all department endpoints with authentication
router.use(authenticate);

// Department CRUD & queries
router.post("/", departmentController.createDepartment);
router.get("/", departmentController.getDepartments);
router.get("/:id", departmentController.getDepartmentById);
router.patch("/:id", departmentController.updateDepartment);
router.delete("/:id", departmentController.deleteDepartment);
router.get("/:id/members", departmentController.getDepartmentMembers);

// Nested Team routes under Department
router.post("/:departmentId/teams", teamController.createTeam);
router.get("/:departmentId/teams", teamController.getDepartmentTeams);

export default router;

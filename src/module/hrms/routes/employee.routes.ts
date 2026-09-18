import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as employeeController from "../controllers/employee.controller.js";

const router = Router();

// Protect all employee endpoints with authentication
router.use(authenticate);

// Hierarchical Org Chart
router.get("/hierarchy", employeeController.getEmployeeHierarchy);

// Employee CRUD
router.post(
  "/",
  upload.single("avatar", { category: "image" }),
  employeeController.createEmployee
);

router.get("/", employeeController.getAllEmployees);
router.get("/:id", employeeController.getEmployeeById);

router.patch(
  "/:id",
  upload.single("avatar", { category: "image" }),
  employeeController.updateEmployee
);

router.delete("/:id", employeeController.deleteEmployee);

export default router;

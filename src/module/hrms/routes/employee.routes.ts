import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as employeeController from "../controllers/employee.controller.js";

const router = Router();

// Protect all employee endpoints with authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/hrms/employees/hierarchy
 * @desc    Fetch organizational reporting hierarchy tree / org chart
 */
router.get("/hierarchy", employeeController.getEmployeeHierarchy);

/**
 * @route   POST /api/v1/hrms/employees
 * @desc    Onboard and create new employee with avatar upload, department, and role linking
 */
router.post(
  "/",
  upload.single("avatar", { category: "image" }),
  employeeController.createEmployee
);

/**
 * @route   GET /api/v1/hrms/employees
 * @desc    Fetch paginated list of employees with search, department, team, and status filters
 */
router.get("/", employeeController.getAllEmployees);

/**
 * @route   GET /api/v1/hrms/employees/:id
 * @desc    Get detailed employee profile by ID (contact, salary, shift, manager info)
 */
router.get("/:id", employeeController.getEmployeeById);

/**
 * @route   PATCH /api/v1/hrms/employees/:id
 * @desc    Update employee information (dirty payload) with optional avatar upload
 */
router.patch(
  "/:id",
  upload.single("avatar", { category: "image" }),
  employeeController.updateEmployee
);

/**
 * @route   DELETE /api/v1/hrms/employees/:id
 * @desc    Soft-delete / terminate employee record
 */
router.delete("/:id", employeeController.deleteEmployee);

export default router;

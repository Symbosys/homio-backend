import { Router } from "express";
import employeeRoutes from "./employee.routes.js";
import salaryRoutes from "./salary.routes.js";
import departmentRoutes from "./department.routes.js";
import teamRoutes from "./team.routes.js";

const hrmsRouter = Router();

hrmsRouter.use("/employees", employeeRoutes);
hrmsRouter.use("/salaries", salaryRoutes);
hrmsRouter.use("/departments", departmentRoutes);
hrmsRouter.use("/teams", teamRoutes);

export default hrmsRouter;

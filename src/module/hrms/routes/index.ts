import { Router } from "express";
import employeeRoutes from "./employee.routes.js";
import salaryRoutes from "./salary.routes.js";
import departmentRoutes from "./department.routes.js";
import teamRoutes from "./team.routes.js";
import geofenceRoutes from "./geofence.routes.js";
import shiftRoutes from "./shift.routes.js";
import attendanceRoutes from "./attendance.routes.js";
import travelRoutes from "./travel.routes.js";
import leaveTypeRoutes from "./leave-type.routes.js";
import leaveRequestRoutes from "./leave-request.routes.js";
import performanceReviewRoutes from "./performance-review.routes.js";
import payrollRoutes from "./payroll.routes.js";
import incentiveRoutes from "./incentive.routes.js";
import noticePeriodRoutes from "./notice-period.routes.js";

const hrmsRouter = Router();

hrmsRouter.use("/employees", employeeRoutes);
hrmsRouter.use("/salaries", salaryRoutes);
hrmsRouter.use("/departments", departmentRoutes);
hrmsRouter.use("/teams", teamRoutes);
hrmsRouter.use("/geofences", geofenceRoutes);
hrmsRouter.use("/shifts", shiftRoutes);
hrmsRouter.use("/attendances", attendanceRoutes);
hrmsRouter.use("/travels", travelRoutes);
hrmsRouter.use("/leave-types", leaveTypeRoutes);
hrmsRouter.use("/leaves", leaveRequestRoutes);
hrmsRouter.use("/performance-reviews", performanceReviewRoutes);
hrmsRouter.use("/payroll", payrollRoutes);
hrmsRouter.use("/incentives", incentiveRoutes);
hrmsRouter.use("/notice-periods", noticePeriodRoutes);

export default hrmsRouter;

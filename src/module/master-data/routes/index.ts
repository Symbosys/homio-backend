import { Router } from "express";
import measurementUnitRoutes from "./measurement-unit.routes.js";
import leadLostReasonRoutes from "./lead-lost-reason.routes.js";
import serviceCategoryRoutes from "./service-category.routes.js";
import complaintSnagCategoryRoutes from "./complaint-snag-category.routes.js";
import taskCategoryRoutes from "./task-category.routes.js";

const masterDataRouter = Router();

masterDataRouter.use("/measurement-units", measurementUnitRoutes);
masterDataRouter.use("/lead-lost-reasons", leadLostReasonRoutes);
masterDataRouter.use("/service-categories", serviceCategoryRoutes);
masterDataRouter.use("/complaint-snag-categories", complaintSnagCategoryRoutes);
masterDataRouter.use("/task-categories", taskCategoryRoutes);

export default masterDataRouter;

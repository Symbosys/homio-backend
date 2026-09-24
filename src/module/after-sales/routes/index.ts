import { Router } from "express";
import categoryRoutes from "./category.routes.js";
import warrantyRoutes from "./warranty.routes.js";
import claimRoutes from "./claim.routes.js";
import serviceRequestRoutes from "./service-request.routes.js";
import serviceVisitRoutes from "./service-visit.routes.js";
import feedbackRoutes from "./feedback.routes.js";
import retentionRoutes from "./retention.routes.js";
import analyticsRoutes from "./analytics.routes.js";

const afterSalesRouter = Router({ mergeParams: true });

// Sub-domain routes mounting
afterSalesRouter.use("/categories", categoryRoutes);
afterSalesRouter.use("/warranties", warrantyRoutes);
afterSalesRouter.use("/claims", claimRoutes);
afterSalesRouter.use("/requests", serviceRequestRoutes);
afterSalesRouter.use("/visits", serviceVisitRoutes);
afterSalesRouter.use("/feedbacks", feedbackRoutes);
afterSalesRouter.use("/feedback", feedbackRoutes);
afterSalesRouter.use("/retentions", retentionRoutes);
afterSalesRouter.use("/retention", retentionRoutes);
afterSalesRouter.use("/analytics", analyticsRoutes);

export default afterSalesRouter;

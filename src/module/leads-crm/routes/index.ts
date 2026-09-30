import { Router } from "express";
import customerRoutes from "./customer.routes.js";
import leadRoutes from "./lead.routes.js";
import leadFollowUpRoutes from "./lead-followup.routes.js";
import leadAnalyticsRoutes from "./lead-analytics.routes.js";
import meetingRoutes from "./meeting.routes.js";
import taskRoutes from "./task.routes.js";
import leadFunnelRoutes from "./lead-funnel.routes.js";

const crmRouter = Router();

crmRouter.use("/customers", customerRoutes);
crmRouter.use("/leads", leadRoutes);
crmRouter.use("/funnels", leadFunnelRoutes);
crmRouter.use("/follow-ups", leadFollowUpRoutes);
crmRouter.use("/analytics", leadAnalyticsRoutes);
crmRouter.use("/meetings", meetingRoutes);
crmRouter.use("/tasks", taskRoutes);

export default crmRouter;

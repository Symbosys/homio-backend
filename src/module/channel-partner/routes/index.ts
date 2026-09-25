import { Router } from "express";
import channelPartnerRoutes from "./channel-partner.routes.js";
import payoutRoutes from "./channel-partner-payout.routes.js";

const channelPartnerRouter = Router();

// Mount payouts first to avoid collision with /:id parameter routes
channelPartnerRouter.use("/payouts", payoutRoutes);
channelPartnerRouter.use("/", channelPartnerRoutes);

export default channelPartnerRouter;

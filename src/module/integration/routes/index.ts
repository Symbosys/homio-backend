import { Router } from "express";
import whatsAppIntegrationRoutes from "./whatsapp-integration.routes.js";

const integrationRouter = Router();

/**
 * WhatsApp Cloud API Integration routes
 */
integrationRouter.use("/whatsapp", whatsAppIntegrationRoutes);

export default integrationRouter;

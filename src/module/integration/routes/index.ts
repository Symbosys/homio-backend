import { Router } from "express";
import whatsAppIntegrationRoutes from "./whatsapp-integration.routes.js";
import llmIntegrationRoutes from "./llm-integration.routes.js";

const integrationRouter = Router();

/**
 * WhatsApp Cloud API Integration routes
 */
integrationRouter.use("/whatsapp", whatsAppIntegrationRoutes);

/**
 * Bring-your-own-key LLM provider routes
 */
integrationRouter.use("/llm", llmIntegrationRoutes);

export default integrationRouter;

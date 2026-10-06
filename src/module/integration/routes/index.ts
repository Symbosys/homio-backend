import { Router } from "express";
import whatsAppIntegrationRoutes from "./whatsapp-integration.routes.js";
import llmIntegrationRoutes from "./llm-integration.routes.js";
import googleCalendarRoutes from "./google-calendar.routes.js";

const integrationRouter = Router();

/**
 * WhatsApp Cloud API Integration routes
 */
integrationRouter.use("/whatsapp", whatsAppIntegrationRoutes);

/**
 * Bring-your-own-key LLM provider routes
 */
integrationRouter.use("/llm", llmIntegrationRoutes);

/**
 * Google Calendar OAuth 2.0 Integration routes
 */
integrationRouter.use("/google-calendar", googleCalendarRoutes);

export default integrationRouter;

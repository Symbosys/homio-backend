// Global BigInt JSON serialization support for Express JSON transport
(BigInt.prototype as any).toJSON = function () {
  const intVal = Number(this);
  return Number.isSafeInteger(intVal) ? intVal : this.toString();
};

import express from "express";
import cors from "cors";
import morgan from "morgan";
import { ENV } from "./config/env.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import authRoutes from "./module/user/routes/auth.routes.js";
import userRoutes from "./module/user/routes/user.routes.js";
import roleRoutes from "./module/user/routes/role.routes.js";
import permissionRoutes from "./module/user/routes/permission.routes.js";
import platformSubscriptionRoutes from "./module/subscription/routes/subscription.routes.js";
import platformOrganizationRoutes from "./module/organization/routes/organization.routes.js";
import platformAiStudioRoutes from "./module/ai-studio/routes/ai-studio-platform.routes.js";
import { aiStudioTenantRouter } from "./module/ai-studio/routes/ai-studio-tenant.routes.js";
import { doubtSolverRouter } from "./module/ai-studio/routes/doubt-solver.routes.js";
import { roomDesignerRouter } from "./module/ai-studio/routes/room-designer.routes.js";
import { vastuAuditRouter } from "./module/ai-studio/routes/vastu-audit.routes.js";
import marketplaceRouter from "./module/marketplace/routes/index.js";
import hrmsRouter from "./module/hrms/routes/index.js";
import crmRouter from "./module/leads-crm/routes/index.js";
import projectsRouter from "./module/projects/routes/index.js";
import procurementRouter from "./module/procurement/routes/index.js";
import afterSalesRouter from "./module/after-sales/routes/index.js";
import masterDataRouter from "./module/master-data/routes/index.js";
import labourRouter from "./module/labour/routes/index.js";
import channelPartnerRouter from "./module/channel-partner/routes/index.js";
import taskRouter from "./module/tasks/routes/index.js";
import mapsRouter from "./module/maps/maps.routes.js";
import quotationMasterRouter from "./module/quotation-master/routes/index.js";
import quotationRouter from "./module/quotation/routes/index.js";
import integrationRouter from "./module/integration/routes/index.js";
import communicationRouter from "./module/communication/routes/index.js";

const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Payload size logger middleware for monitoring frontend request sizes
app.use((req, res, next) => {
  const contentLength = req.headers["content-length"];
  if (contentLength && Number(contentLength) > 0) {
    const bytes = Number(contentLength);
    const formattedSize =
      bytes > 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(2)} MB`
        : bytes > 1024
          ? `${(bytes / 1024).toFixed(2)} KB`
          : `${bytes} B`;
    console.log(
      `[HTTP Payload Size] ${req.method} ${req.originalUrl || req.url} - Size: ${formattedSize} (${bytes.toLocaleString()} bytes)`,
    );
  }
  next();
});

app.get("/", async (req, res) => {
  return res.json({
    message: "Homio Backend is running...",
    timestamp: new Date().toISOString(),
    mode: ENV.MODE,
    api_version: "v1",
  });
});

app.get("/health", async (req, res) => {
  return res.json({
    message: "OK",
  });
});

// API Routes
/**
 * User & RBAC Module Routes
 */
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/permissions", permissionRoutes);

/**
 * Platform Owner (SaaS Admin) Routes
 */
app.use("/api/v1/platform/subscriptions", platformSubscriptionRoutes);
app.use("/api/v1/platform/organizations", platformOrganizationRoutes);
app.use("/api/v1/platform/ai-studio", platformAiStudioRoutes);

/**
 * Marketplace Multi-Vertical Module Routes
 */
app.use("/api/v1/marketplace", marketplaceRouter);

/**
 * HRMS Module Routes (Employees & Salary Period Tracking)
 */
app.use("/api/v1/hrms", hrmsRouter);

/**
 * CRM & Lead Management Module Routes
 */
app.use("/api/v1/crm", crmRouter);

/**
 * Channel Partner & Commission Finance Routes
 */
app.use("/api/v1/channel-partners", channelPartnerRouter);

/**
 * Projects Module Routes (Full Lifecycle, Sites, Schedules, Metrics, Financials, Dynamic Teams)
 */
app.use("/api/v1/projects", projectsRouter);

/**
 * Procurement & Operations Module Routes (Material Requests, Vendor RFQs, Quotations, Dispatches)
 */
app.use("/api/v1/procurement", procurementRouter);

/**
 * After-Sales Services, Warranties, Claims, Field Visits, CSAT & Retention Routes
 */
app.use("/api/v1/after-sales", afterSalesRouter);

/**
 * Master Data Module Routes (Units, Lost Reasons, Service Categories, Snags, Tasks)
 */
app.use("/api/v1/master-data", masterDataRouter);

/**
 * Service & Labour Management Module Routes
 */
app.use("/api/v1/labour", labourRouter);

/**
 * Dedicated Task Management Module Routes (Project Stage Tasks, Reviewers, Auto Progress Engine)
 */
app.use("/api/v1/tasks", taskRouter);

/**
 * Maps & Location Search Proxy Routes (Ola Maps Backend Proxy)
 */
app.use("/api/v1/maps", mapsRouter);

/**
 * Quotation Master Configuration Routes (Items, Rate Cards, Terms Templates, PDF Front/Back Assets)
 */
app.use("/api/v1/quotation-master", quotationMasterRouter);

/**
 * Core Quotation Proposal Routes (Create Quotation, Get Filtered Quotations)
 */
app.use("/api/v1/quotations", quotationRouter);

/**
 * Social & Communication Channel Integration Routes (WhatsApp Cloud API)
 */
app.use("/api/v1/integrations", integrationRouter);

/**
 * Communication & WhatsApp Message Template Routes
 */
app.use("/api/v1/communication", communicationRouter);

/**
 * AI Studio & Generative Tools Module Routes (Organization Tenant Scoped)
 */
app.use("/api/v1/ai-studio", aiStudioTenantRouter);
app.use("/api/v1/ai-studio/doubt-solver", doubtSolverRouter);
app.use("/api/v1/ai-studio/room-designer", roomDesignerRouter);
app.use("/api/v1/ai-studio/vastu", vastuAuditRouter);

app.use(errorMiddleware);

export default app;

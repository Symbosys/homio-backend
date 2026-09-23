import express from "express";
import cors from "cors";
import { ENV } from "./config/env.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import authRoutes from "./module/user/routes/auth.routes.js";
import userRoutes from "./module/user/routes/user.routes.js";
import roleRoutes from "./module/user/routes/role.routes.js";
import permissionRoutes from "./module/user/routes/permission.routes.js";
import platformSubscriptionRoutes from "./module/subscription/routes/subscription.routes.js";
import platformOrganizationRoutes from "./module/organization/routes/organization.routes.js";
import marketplaceRouter from "./module/marketplace/routes/index.js";
import hrmsRouter from "./module/hrms/routes/index.js";
import crmRouter from "./module/leads-crm/routes/index.js";
import projectsRouter from "./module/projects/routes/index.js";
import procurementRouter from "./module/procurement/routes/index.js";
import afterSalesRouter from "./module/after-sales/routes/index.js";
import masterDataRouter from "./module/master-data/routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
    return res.json({
        message: "Homio Backend is running...",
        timestamp: new Date().toISOString(),
        mode: ENV.MODE,
        api_version: "v1"
    });
});

app.get("/health", async (req, res) => {
    return res.json({
        message: "OK"
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

app.use(errorMiddleware);

export default app;
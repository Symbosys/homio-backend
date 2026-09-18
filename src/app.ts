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

app.use(errorMiddleware);

export default app;
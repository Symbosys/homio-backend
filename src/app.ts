import express from "express";
import { ENV } from "./config/env.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import authRoutes from "./module/user/routes/auth.routes.js";
import userRoutes from "./module/user/routes/user.routes.js";

const app = express();

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
 * User Module Routes
*/
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

app.use(errorMiddleware);

export default app;
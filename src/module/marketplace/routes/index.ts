import { Router } from "express";
import productRoutes from "./product.routes.js";
import vendorRoutes from "./vendor.routes.js";

const marketplaceRouter = Router();

// Core Unified Marketplace Routes
marketplaceRouter.use("/products", productRoutes);
marketplaceRouter.use("/vendors", vendorRoutes);

export default marketplaceRouter;

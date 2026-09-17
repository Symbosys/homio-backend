import { Router } from "express";
import categoryRoutes from "./category.routes.js";
import sellerCategoryRoutes from "./seller-category.routes.js";
import vendorRoutes from "./vendor.routes.js";
import digitalProductRoutes from "./digital-product.routes.js";
import homeDecorRoutes from "./home-decor.routes.js";
import propertyRoutes from "./property.routes.js";
import materialRoutes from "./material.routes.js";

const marketplaceRouter = Router();

marketplaceRouter.use("/categories", categoryRoutes);
marketplaceRouter.use("/seller-categories", sellerCategoryRoutes);
marketplaceRouter.use("/vendors", vendorRoutes);
marketplaceRouter.use("/digital-products", digitalProductRoutes);
marketplaceRouter.use("/home-decor", homeDecorRoutes);
marketplaceRouter.use("/properties", propertyRoutes);
marketplaceRouter.use("/materials", materialRoutes);

export default marketplaceRouter;

import { Router } from "express";
import quotationItemMasterRoutes from "./quotation-item-master.routes.js";
import quotationRateCardRoutes from "./quotation-rate-card.routes.js";
import quotationTermsTemplateRoutes from "./quotation-terms-template.routes.js";
import quotationPdfAssetRoutes from "./quotation-pdf-asset.routes.js";

const quotationMasterRouter = Router();

/**
 * 1. Quotation Item Master Routes (Paginated catalog with image uploads)
 */
quotationMasterRouter.use("/items", quotationItemMasterRoutes);

/**
 * 2. Quotation Rate Cards & Markup Pricing Tiers Routes (Non-paginated catalog)
 */
quotationMasterRouter.use("/rate-cards", quotationRateCardRoutes);

/**
 * 3. Quotation Terms, Warranty & Legal Sign-off Templates Routes (Non-paginated catalog)
 */
quotationMasterRouter.use("/terms-templates", quotationTermsTemplateRoutes);

/**
 * 4. Quotation PDF Page Assets Routes (Front & Back preview images with max 10 quota)
 */
quotationMasterRouter.use("/pdf-assets", quotationPdfAssetRoutes);

export default quotationMasterRouter;

import { Router } from "express";
import materialRequestRoutes from "./material-request.routes.js";
import vendorRfqRoutes from "./vendor-rfq.routes.js";
import vendorQuotationRoutes from "./vendor-quotation.routes.js";
import materialDispatchRoutes from "./material-dispatch.routes.js";

const router = Router();

/**
 * Mount all sub-modules for Procurement & Operations
 */
router.use("/material-requests", materialRequestRoutes);
router.use("/vendor-rfqs", vendorRfqRoutes);
router.use("/vendor-quotations", vendorQuotationRoutes);
router.use("/material-dispatches", materialDispatchRoutes);

export default router;

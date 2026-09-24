import { Router } from "express";
import labourRoutes from "./labour.routes.js";
import labourKycRoutes from "./labour-kyc.routes.js";
import labourBookingRoutes from "./labour-booking.routes.js";
import labourAttendanceRoutes from "./labour-attendance.routes.js";
import labourPaymentRoutes from "./labour-payment.routes.js";
import labourRatingRoutes from "./labour-rating.routes.js";
import labourDisputeRoutes from "./labour-dispute.routes.js";

const labourRouter = Router();

labourRouter.use("/", labourRoutes);
labourRouter.use("/", labourKycRoutes);
labourRouter.use("/", labourBookingRoutes);
labourRouter.use("/", labourAttendanceRoutes);
labourRouter.use("/", labourPaymentRoutes);
labourRouter.use("/", labourRatingRoutes);
labourRouter.use("/", labourDisputeRoutes);

export default labourRouter;



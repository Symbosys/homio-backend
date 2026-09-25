import { Router } from "express";
import labourRoutes from "./labour.routes.js";
import labourKycRoutes from "./labour-kyc.routes.js";
import labourBookingRoutes from "./labour-booking.routes.js";
import projectServiceRoutes from "./project-service.routes.js";
import labourAttendanceRoutes from "./labour-attendance.routes.js";
import labourPaymentRoutes from "./labour-payment.routes.js";
import labourRatingRoutes from "./labour-rating.routes.js";
import labourDisputeRoutes from "./labour-dispute.routes.js";

const labourRouter = Router();

// Mount specific sub-resource routes before labourRoutes (/:id) to avoid path collisions
labourRouter.use("/", projectServiceRoutes);
labourRouter.use("/", labourBookingRoutes);
labourRouter.use("/", labourAttendanceRoutes);
labourRouter.use("/", labourPaymentRoutes);
labourRouter.use("/", labourRatingRoutes);
labourRouter.use("/", labourDisputeRoutes);
labourRouter.use("/", labourKycRoutes);
labourRouter.use("/", labourRoutes);

export default labourRouter;

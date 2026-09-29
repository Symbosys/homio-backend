import { Router } from "express";
import quotationRouter from "./quotation.routes.js";

const router = Router();

router.use("/", quotationRouter);

export default router;

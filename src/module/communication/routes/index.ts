import { Router } from "express";
import templateRouter from "./whatsapp-template.routes.js";

const communicationRouter = Router();

communicationRouter.use("/templates", templateRouter);

export default communicationRouter;

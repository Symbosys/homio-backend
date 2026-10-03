import { Router } from "express";
import templateRouter from "./whatsapp-template.routes.js";
import messageRouter from "./whatsapp-message.routes.js";

const communicationRouter = Router();

communicationRouter.use("/templates", templateRouter);
communicationRouter.use("/messages", messageRouter);

export default communicationRouter;

import { Router } from "express";
import templateRouter from "./whatsapp-template.routes.js";
import messageRouter from "./whatsapp-message.routes.js";
import conversationRouter from "./conversation.routes.js";

const communicationRouter = Router();

communicationRouter.use("/conversations", conversationRouter);
communicationRouter.use("/templates", templateRouter);
communicationRouter.use("/messages", messageRouter);

export default communicationRouter;


import { Router } from "express";
import taskRoutes from "./task.routes.js";

const taskRouter = Router();

taskRouter.use("/", taskRoutes);

export default taskRouter;

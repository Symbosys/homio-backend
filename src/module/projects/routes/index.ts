import { Router } from "express";
import projectRoutes from "./project.routes.js";

const projectsRouter = Router();

projectsRouter.use("/", projectRoutes);

export default projectsRouter;

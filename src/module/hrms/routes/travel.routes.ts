import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import { upload } from "../../../middlewares/upload.middleware.js";
import * as travelController from "../controllers/travel.controller.js";

const router = Router();

// Protect all travel endpoints
router.use(authenticate);

// Personal assigned travels
router.get("/my-travels", travelController.getMyTravels);

// Travel CRUD
router.post(
  "/",
  upload.array("documents", 10, { category: "document" }),
  travelController.createTravel
);
router.get("/", travelController.getTravels);
router.get("/:id", travelController.getTravelById);
router.patch("/:id", travelController.updateTravel);
router.delete("/:id", travelController.deleteTravel);

// Bulk Employee Assignment
router.post("/:id/assign-employees", travelController.assignEmployees);

// Expenses & Status updates
router.patch(
  "/:id/expenses",
  upload.array("documents", 10, { category: "document" }),
  travelController.updateExpenses
);
router.patch("/:id/status", travelController.updateStatus);

export default router;

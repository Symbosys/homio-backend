import { Router } from "express";
import {
  createTimeline,
  getTimelines,
  getTimelineById,
  updateTimeline,
  deleteTimeline,
} from "../controllers/timeline.controller.js";

const timelineRoutes = Router({ mergeParams: true });

/**
 * @route   POST /api/v1/projects/:projectId/timelines
 * @desc    Create a new timeline event (custom or system) for a project
 */
timelineRoutes.post("/", createTimeline);

/**
 * @route   GET /api/v1/projects/:projectId/timelines
 * @desc    Fetch paginated timeline events for a project with filters
 */
timelineRoutes.get("/", getTimelines);

/**
 * @route   GET /api/v1/projects/:projectId/timelines/:id
 * @desc    Fetch a single timeline event by ID
 */
timelineRoutes.get("/:id", getTimelineById);

/**
 * @route   PATCH /api/v1/projects/:projectId/timelines/:id
 * @desc    Update a timeline event
 */
timelineRoutes.patch("/:id", updateTimeline);

/**
 * @route   DELETE /api/v1/projects/:projectId/timelines/:id
 * @desc    Delete a timeline event
 */
timelineRoutes.delete("/:id", deleteTimeline);

export default timelineRoutes;

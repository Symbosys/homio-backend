import { Router } from "express";
import { mapsController } from "./maps.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const mapsRouter = Router();

/**
 * @route   GET /api/v1/maps/places/autocomplete
 * @desc    Fetch location suggestions for address input
 * @access  Private
 */
mapsRouter.get(
  "/places/autocomplete",
  authenticate,
  mapsController.autocomplete.bind(mapsController)
);

/**
 * @route   GET /api/v1/maps/places/geocode
 * @desc    Convert physical street address to GPS lat/lng coordinates
 * @access  Private
 */
mapsRouter.get(
  "/places/geocode",
  authenticate,
  mapsController.geocode.bind(mapsController)
);

/**
 * @route   GET /api/v1/maps/places/reverse-geocode
 * @desc    Convert GPS coordinates to structured street address, city, state, pincode
 * @access  Private
 */
mapsRouter.get(
  "/places/reverse-geocode",
  authenticate,
  mapsController.reverseGeocode.bind(mapsController)
);

export default mapsRouter;

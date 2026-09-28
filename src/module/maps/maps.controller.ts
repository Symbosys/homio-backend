import type { Request, Response } from "express";
import { mapsService } from "./maps.service.js";
import { SuccessResponse } from "../../utils/response.util.js";
import { statusCode } from "../../types/types.js";

/**
 * Controller handling secured Maps API proxy endpoints for address search, geocoding, and reverse geocoding.
 */
class MapsController {
  /**
   * Autocomplete places and fetch coordinates.
   *
   * @route   GET /api/v1/maps/places/autocomplete
   * @desc    Query Ola Maps Autocomplete API for site/address suggestions
   * @access  Private (Authenticated)
   */
  async autocomplete(req: Request, res: Response): Promise<void> {
    const input = (req.query.input as string) || (req.query.q as string) || "";

    if (!input || input.trim().length < 2) {
      SuccessResponse(res, "Autocomplete predictions fetched successfully", [], statusCode.OK);
      return;
    }

    const predictions = await mapsService.autocompletePlaces(input);
    SuccessResponse(res, "Autocomplete predictions fetched successfully", predictions, statusCode.OK);
  }

  /**
   * Geocode a text address into GPS latitude and longitude.
   *
   * @route   GET /api/v1/maps/places/geocode
   * @desc    Geocode text address to GPS coordinates using Ola Maps
   * @access  Private (Authenticated)
   */
  async geocode(req: Request, res: Response): Promise<void> {
    const address = (req.query.address as string) || "";

    if (!address || address.trim().length < 2) {
      SuccessResponse(res, "Address geocoded successfully", null, statusCode.OK);
      return;
    }

    const result = await mapsService.geocodeAddress(address);
    SuccessResponse(res, "Address geocoded successfully", result, statusCode.OK);
  }

  /**
   * Reverse-geocode latitude and longitude into human-readable address components.
   *
   * @route   GET /api/v1/maps/places/reverse-geocode
   * @desc    Reverse geocode GPS coordinates to formatted street address, city, state, pincode
   * @access  Private (Authenticated)
   */
  async reverseGeocode(req: Request, res: Response): Promise<void> {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      SuccessResponse(res, "Coordinates reverse-geocoded successfully", null, statusCode.OK);
      return;
    }

    const result = await mapsService.reverseGeocode(lat, lng);
    SuccessResponse(res, "Coordinates reverse-geocoded successfully", result, statusCode.OK);
  }
}

export const mapsController = new MapsController();

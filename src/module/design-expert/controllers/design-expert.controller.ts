import type { Request, Response, NextFunction } from "express";
import { DesignExpertService } from "../services/design-expert.service.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import {
  CreateDesignExpertSchema,
  UpdateDesignExpertSchema,
  GetDesignExpertsQuerySchema,
  SetWeeklyAvailabilitySchema,
  AddDateOverrideSchema,
  GetSlotsQuerySchema,
} from "../validators/design-expert.validator.js";
import { SuccessResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";

const service = new DesignExpertService();

/**
 * @route   POST /api/v1/design-experts
 * @desc    Create new Design Expert profile
 * @access  PLATFORM_ADMIN
 */
export const createExpert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = CreateDesignExpertSchema.parse(req.body);
    if (req.file) {
      const uploadResult = await storageService.upload(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        { folder: "design-experts" }
      );
      validatedData.avatarUrl = {
        id: uploadResult.publicId,
        url: uploadResult.url,
        bytes: uploadResult.bytes || req.file.size,
        format: uploadResult.format || req.file.mimetype.split("/")[1] || "jpg",
        provider: uploadResult.provider || "local",
      };
    }
    const expert = await service.createExpert(validatedData);
    return SuccessResponse(res, "Design expert created successfully", expert, statusCode.Created);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/design-experts
 * @desc    Get paginated directory of design experts with search and filters
 * @access  Public / Authenticated
 */
export const getExperts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedQuery = GetDesignExpertsQuerySchema.parse(req.query);
    const result = await service.getExperts(validatedQuery);
    return SuccessResponse(res, "Design experts retrieved successfully", result);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/design-experts/:id
 * @desc    Get single design expert details
 * @access  Public / Authenticated
 */
export const getExpertById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const expert = await service.getExpertById(id);
    return SuccessResponse(res, "Design expert retrieved successfully", expert);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PATCH /api/v1/design-experts/:id
 * @desc    Partially update a design expert (Rule 5: Dirty payload)
 * @access  PLATFORM_ADMIN
 */
export const updateExpert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = UpdateDesignExpertSchema.parse(req.body);
    if (req.file) {
      const uploadResult = await storageService.upload(
        {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        },
        { folder: "design-experts" }
      );
      validatedData.avatarUrl = {
        id: uploadResult.publicId,
        url: uploadResult.url,
        bytes: uploadResult.bytes || req.file.size,
        format: uploadResult.format || req.file.mimetype.split("/")[1] || "jpg",
        provider: uploadResult.provider || "local",
      };
    }
    const updated = await service.updateExpert(id, validatedData);
    return SuccessResponse(res, "Design expert updated successfully", updated);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   DELETE /api/v1/design-experts/:id
 * @desc    Soft delete an expert profile
 * @access  PLATFORM_ADMIN
 */
export const deleteExpert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const deleted = await service.deleteExpert(id);
    return SuccessResponse(res, "Design expert deleted successfully", deleted);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/design-experts/:id/availability
 * @desc    Get availability schedule and date overrides
 * @access  Public / Authenticated
 */
export const getAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const availability = await service.getAvailability(id);
    return SuccessResponse(res, "Expert availability retrieved successfully", availability);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   PUT /api/v1/design-experts/:id/availability
 * @desc    Configure weekly recurring availability shifts
 * @access  PLATFORM_ADMIN
 */
export const setWeeklyAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = SetWeeklyAvailabilitySchema.parse(req.body);
    const shifts = await service.setWeeklyAvailability(id, validatedData);
    return SuccessResponse(res, "Weekly availability updated successfully", shifts);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   POST /api/v1/design-experts/:id/availability/override
 * @desc    Add date-specific leave or custom working hours
 * @access  PLATFORM_ADMIN
 */
export const addDateOverride = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const validatedData = AddDateOverrideSchema.parse(req.body);
    const override = await service.addDateOverride(id, validatedData);
    return SuccessResponse(res, "Date override added successfully", override, statusCode.Created);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   DELETE /api/v1/design-experts/:id/availability/override/:overrideId
 * @desc    Delete date-specific override
 * @access  PLATFORM_ADMIN
 */
export const deleteDateOverride = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const overrideId = req.params.overrideId as string;
    const result = await service.deleteDateOverride(id, overrideId);
    return SuccessResponse(res, result.message, result);
  } catch (err) {
    next(err);
  }
};

/**
 * @route   GET /api/v1/design-experts/:id/slots
 * @desc    Calculate real-time available time slots for a given date (?date=YYYY-MM-DD)
 * @access  Public / Authenticated
 */
export const getSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { date } = GetSlotsQuerySchema.parse(req.query);
    const slots = await service.calculateSlots(id, date);
    return SuccessResponse(res, "Available time slots computed successfully", slots);
  } catch (err) {
    next(err);
  }
};

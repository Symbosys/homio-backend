import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { travelService } from "../services/travel.service.js";
import {
  createTravelSchema,
  updateTravelSchema,
  travelIdParamSchema,
  getTravelsQuerySchema,
  assignEmployeesToTravelSchema,
  updateTravelExpensesSchema,
  updateTravelStatusSchema,
} from "../validators/travel.validator.js";

/**
 * Controller: Create field travel
 */
export const createTravel = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = createTravelSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await travelService.createTravel(organizationId, parsed.body, files, req.user?.id);

  return SuccessResponse(res, "Field travel created successfully", result, statusCode.Created);
});

/**
 * Controller: Get all field travels (Admin / Organization view)
 */
export const getTravels = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = getTravelsQuerySchema.parse({ query: req.query });
  const result = await travelService.getTravels(organizationId, parsed.query);

  return SuccessResponse(res, "Field travels retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get trips assigned to logged-in employee
 */
export const getMyTravels = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  const userId = req.user?.id;
  if (!organizationId || !userId) {
    throw new ErrorResponse("Authentication required", statusCode.Forbidden);
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await travelService.getMyTravels(organizationId, userId, page, limit);

  return SuccessResponse(res, "Your assigned travels retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Get single field travel by ID
 */
export const getTravelById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = travelIdParamSchema.parse({ params: req.params });
  const result = await travelService.getTravelById(params.id, organizationId);

  return SuccessResponse(res, "Field travel details retrieved successfully", result, statusCode.OK);
});

/**
 * Controller: Update field travel
 */
export const updateTravel = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateTravelSchema.parse({ params: req.params, body: req.body });
  const result = await travelService.updateTravel(
    parsed.params.id,
    organizationId,
    parsed.body,
    req.user?.id
  );

  return SuccessResponse(res, "Field travel updated successfully", result, statusCode.OK);
});

/**
 * Controller: Soft delete field travel
 */
export const deleteTravel = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const { params } = travelIdParamSchema.parse({ params: req.params });
  await travelService.deleteTravel(params.id, organizationId, req.user?.id);

  return SuccessResponse(res, "Field travel deleted successfully", null, statusCode.OK);
});

/**
 * Controller: Bulk assign/unassign employees
 */
export const assignEmployees = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = assignEmployeesToTravelSchema.parse({ params: req.params, body: req.body });
  const result = await travelService.assignEmployees(parsed.params.id, organizationId, parsed.body);

  return SuccessResponse(
    res,
    `Employees ${parsed.body.action === "ASSIGN" ? "assigned to" : "unassigned from"} travel successfully`,
    result,
    statusCode.OK
  );
});

/**
 * Controller: Record actual expenses & receipts
 */
export const updateExpenses = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateTravelExpensesSchema.parse({ params: req.params, body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await travelService.updateExpenses(
    parsed.params.id,
    organizationId,
    parsed.body,
    files,
    req.user?.id
  );

  return SuccessResponse(res, "Travel expenses updated successfully", result, statusCode.OK);
});

/**
 * Controller: Update travel status
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context missing", statusCode.Forbidden);
  }

  const parsed = updateTravelStatusSchema.parse({ params: req.params, body: req.body });
  const result = await travelService.updateStatus(
    parsed.params.id,
    organizationId,
    parsed.body.status,
    parsed.body.remarks,
    req.user?.id
  );

  return SuccessResponse(res, "Travel status updated successfully", result, statusCode.OK);
});

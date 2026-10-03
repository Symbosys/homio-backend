import { prisma } from "../../../lib/prisma.js";
import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { whatsAppTemplateService } from "../services/whatsapp-template.service.js";
import {
  createWhatsAppTemplateSchema,
  updateWhatsAppTemplateSchema,
  getWhatsAppTemplatesQuerySchema,
  renderTemplatePreviewSchema,
} from "../validators/whatsapp-template.validator.js";

/**
 * Controller: Create new WhatsApp template
 * @route   POST /api/v1/communication/templates
 * @desc    Creates a template with relational variable mappings, and optionally submits to Meta
 */
export const createTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const userId = req.user?.id;
  let employeeId: string | null = null;
  if (userId) {
    const employee = await prisma.employee.findFirst({
      where: { userId, organizationId, isDeleted: false },
      select: { id: true },
    });
    employeeId = employee?.id || null;
  }

  const parsed = createWhatsAppTemplateSchema.parse({ body: req.body });
  const result = await whatsAppTemplateService.createTemplate(organizationId, employeeId, parsed.body);

  return SuccessResponse(
    res,
    "WhatsApp message template created successfully",
    result,
    statusCode.Created
  );
});

/**
 * Controller: List all WhatsApp templates with filtering, pagination & KPI ribbon
 * @route   GET /api/v1/communication/templates
 * @desc    Returns paginated templates, single-line analytics KPI ribbon, and category/status filters
 */
export const listTemplates = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const parsed = getWhatsAppTemplatesQuerySchema.parse({ query: req.query });
  const result = await whatsAppTemplateService.listTemplates(organizationId, parsed.query);

  return SuccessResponse(
    res,
    "WhatsApp message templates fetched successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Get full WhatsApp template details by ID
 * @route   GET /api/v1/communication/templates/:id
 * @desc    Retrieves template configuration, dedicated variables, and Meta sync details
 */
export const getTemplateById = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const id = req.params.id as string;
  const result = await whatsAppTemplateService.getTemplateById(organizationId, id);

  return SuccessResponse(
    res,
    "WhatsApp message template details retrieved successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Update existing WhatsApp template and variable mappings
 * @route   PUT /api/v1/communication/templates/:id
 * @desc    Updates components, variable mappings, and optionally resubmits to Meta
 */
export const updateTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const id = req.params.id as string;
  const parsed = updateWhatsAppTemplateSchema.parse({ body: req.body });
  const result = await whatsAppTemplateService.updateTemplate(organizationId, id, parsed.body);

  return SuccessResponse(
    res,
    "WhatsApp message template updated successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Delete WhatsApp template
 * @route   DELETE /api/v1/communication/templates/:id
 * @desc    Soft-deletes template locally and dispatches deletion to Meta Graph API
 */
export const deleteTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const id = req.params.id as string;
  const result = await whatsAppTemplateService.deleteTemplate(organizationId, id);

  return SuccessResponse(res, result.message, null, statusCode.OK);
});

/**
 * Controller: Synchronize a single template directly from Meta Graph API
 * @route   POST /api/v1/communication/templates/:id/sync
 * @desc    Pulls latest approval status, components, and variables from Meta while preserving existing CRM mappings
 */
export const syncTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const id = req.params.id as string;
  const result = await whatsAppTemplateService.syncOneTemplate(organizationId, id);

  return SuccessResponse(
    res,
    "WhatsApp template synchronized with Meta successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Render live variable preview substitution (Read-Only)
 * @route   POST /api/v1/communication/templates/:id/render
 * @desc    Resolves dynamic variable mappings against a given Lead, Customer, Project, or Quotation record
 */
export const renderTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user?.organizationId;
  if (!organizationId) {
    throw new ErrorResponse("Organization context required", statusCode.Unauthorized);
  }

  const id = req.params.id as string;
  const parsed = renderTemplatePreviewSchema.parse({ body: req.body });
  const result = await whatsAppTemplateService.renderTemplate(
    organizationId,
    id,
    parsed.body
  );

  return SuccessResponse(
    res,
    "Template preview rendered successfully",
    result,
    statusCode.OK
  );
});

/**
 * Controller: Get CRM Variable Dictionary
 * @route   GET /api/v1/communication/templates/variable-dictionary
 * @desc    Returns all whitelisted CRM entities and fields to power frontend dropdown selectors
 */
export const getVariableDictionary = asyncHandler(async (_req, res) => {
  const result = whatsAppTemplateService.getVariableDictionary();

  return SuccessResponse(
    res,
    "CRM Variable Dictionary fetched successfully",
    result,
    statusCode.OK
  );
});

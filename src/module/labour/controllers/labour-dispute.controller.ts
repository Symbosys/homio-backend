import { asyncHandler } from "../../../middlewares/error.middleware.js";
import { SuccessResponse, ErrorResponse } from "../../../utils/response.util.js";
import { statusCode } from "../../../types/types.js";
import { labourDisputeService } from "../services/labour-dispute.service.js";
import {
  createLabourDisputeSchema,
  reportBypassAttemptSchema,
  reportClientPaymentDueSchema,
  reportLabourAbandonmentSchema,
  assignEmpanelledLawyerSchema,
  recordLegalNoticeSchema,
  recordLabourCourtActionSchema,
  updateLabourDisputeSchema,
  updateDisputeStatusSchema,
  getLabourDisputesQuerySchema,
  disputeIdParamSchema,
  takeDisputeActionSchema,
} from "../validators/labour-dispute.validator.js";

/**
 * @route   POST /api/v1/labour/disputes
 * @desc    File a new legal / site dispute with evidence attachments
 * @access  Private (Authenticated User)
 */
export const createLabourDispute = asyncHandler(async (req, res) => {
  const parsed = createLabourDisputeSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.createDispute(parsed.body, req.user?.organizationId, files);
  return SuccessResponse(res, "Labour dispute filed successfully", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/disputes/bypass-report
 * @desc    Report off-platform cash bypass attempt with automated penalty governance
 * @access  Private (Authenticated User - Worker, Client, or Contractor)
 */
export const reportBypassAttempt = asyncHandler(async (req, res) => {
  const parsed = reportBypassAttemptSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.reportBypassAttempt(parsed.body, req.user!.id, files);
  return SuccessResponse(res, "Bypass attempt reported and disciplinary review opened", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/disputes/client-payment-due
 * @desc    Worker reports client payment default with automatic dues counter and blacklisting
 * @access  Private (Assigned Worker / Admin)
 */
export const reportClientPaymentDue = asyncHandler(async (req, res) => {
  const parsed = reportClientPaymentDueSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.reportClientPaymentDue(parsed.body, req.user!.id, files);
  return SuccessResponse(res, "Unpaid wage default reported and client status updated", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/disputes/labour-abandonment
 * @desc    Client reports worker work abandonment with warning counter and blacklisting
 * @access  Private (Client / Contractor / Admin)
 */
export const reportLabourAbandonment = asyncHandler(async (req, res) => {
  const parsed = reportLabourAbandonmentSchema.parse({ body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.reportLabourAbandonment(parsed.body, req.user!.id, files);
  return SuccessResponse(res, "Work abandonment reported and worker disciplinary action logged", result, statusCode.Created);
});

/**
 * @route   POST /api/v1/labour/disputes/:id/assign-lawyer
 * @desc    Assign empanelled common legal counsel to represent worker dispute
 * @access  Private (Platform Admin / Legal Officer)
 */
export const assignEmpanelledLawyer = asyncHandler(async (req, res) => {
  const parsed = assignEmpanelledLawyerSchema.parse({ params: req.params, body: req.body });
  const result = await labourDisputeService.assignEmpanelledLawyer(parsed.params.id, parsed.body);
  return SuccessResponse(res, "Empanelled lawyer assigned to dispute case", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/disputes/:id/legal-notice
 * @desc    Record formal demand/legal notice dispatched
 * @access  Private (Platform Admin / Legal Officer)
 */
export const recordLegalNotice = asyncHandler(async (req, res) => {
  const parsed = recordLegalNoticeSchema.parse({ params: req.params, body: req.body });
  const result = await labourDisputeService.recordLegalNotice(parsed.params.id, parsed.body);
  return SuccessResponse(res, "Legal demand notice recorded successfully", result, statusCode.OK);
});

/**
 * @route   POST /api/v1/labour/disputes/:id/labour-court
 * @desc    Record formal claim petition filed in Labour Court
 * @access  Private (Platform Admin / Legal Officer)
 */
export const recordLabourCourtAction = asyncHandler(async (req, res) => {
  const parsed = recordLabourCourtActionSchema.parse({ params: req.params, body: req.body });
  const result = await labourDisputeService.recordLabourCourtAction(parsed.params.id, parsed.body);
  return SuccessResponse(res, "Labour Court recovery action recorded successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/disputes
 * @desc    Fetch paginated disputes with filters
 * @access  Private (Authenticated User)
 */
export const getAllLabourDisputes = asyncHandler(async (req, res) => {
  const parsed = getLabourDisputesQuerySchema.parse({ query: req.query });
  const result = await labourDisputeService.getDisputes(parsed.query, req.user?.organizationId);
  return SuccessResponse(res, "Labour disputes retrieved successfully", result, statusCode.OK);
});

/**
 * @route   GET /api/v1/labour/disputes/:id
 * @desc    Get dispute case file by ID
 * @access  Private (Authenticated User)
 */
export const getLabourDisputeById = asyncHandler(async (req, res) => {
  const parsed = disputeIdParamSchema.parse({ params: req.params });
  const result = await labourDisputeService.getDisputeById(parsed.params.id, req.user?.organizationId);
  return SuccessResponse(res, "Labour dispute retrieved successfully", result, statusCode.OK);
});

/**
 * @route   PUT /api/v1/labour/disputes/:id
 * @desc    Full symmetric update of dispute case (Rule 19)
 * @access  Private (Authenticated User)
 */
export const updateLabourDispute = asyncHandler(async (req, res) => {
  const parsed = updateLabourDisputeSchema.parse({ params: req.params, body: req.body });
  const files = req.files as Express.Multer.File[] | undefined;
  const result = await labourDisputeService.updateDispute(
    parsed.params.id,
    parsed.body,
    req.user?.organizationId,
    files
  );
  return SuccessResponse(res, "Labour dispute updated successfully", result, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/disputes/:id/status
 * @desc    Update dispute resolution status (SETTLED, CLOSED, UNDER_REVIEW, etc.)
 * @access  Private (Authenticated User)
 */
export const updateLabourDisputeStatus = asyncHandler(async (req, res) => {
  const parsed = updateDisputeStatusSchema.parse({ params: req.params, body: req.body });
  const result = await labourDisputeService.updateStatus(parsed.params.id, parsed.body, req.user?.organizationId);
  return SuccessResponse(res, "Dispute status updated successfully", result, statusCode.OK);
});

/**
 * @route   DELETE /api/v1/labour/disputes/:id
 * @desc    Delete dispute case and prune cloud evidence docs
 * @access  Private (Authenticated User)
 */
export const deleteLabourDispute = asyncHandler(async (req, res) => {
  const parsed = disputeIdParamSchema.parse({ params: req.params });
  await labourDisputeService.deleteDispute(parsed.params.id, req.user?.organizationId);
  return SuccessResponse(res, "Labour dispute deleted successfully", null, statusCode.OK);
});

/**
 * @route   PATCH /api/v1/labour/disputes/:id/take-action
 * @desc    Platform Admin takes action against dispute (rating reduction, warning, blacklisting, legal proceedings)
 * @access  Private (Platform Admin)
 */
export const takeLabourDisputeAction = asyncHandler(async (req, res) => {
  const parsed = takeDisputeActionSchema.parse({ params: req.params, body: req.body });
  const adminUserId = req.user?.id;
  const result = await labourDisputeService.takeDisputeAction(parsed.params.id, parsed.body, adminUserId);
  return SuccessResponse(res, `Dispute action ${parsed.body.action} executed successfully`, result, statusCode.OK);
});

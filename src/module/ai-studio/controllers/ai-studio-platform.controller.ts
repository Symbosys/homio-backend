import type { Request, Response, NextFunction } from "express";
import { AiStudioPlatformService } from "../services/ai-studio-platform.service.js";
import {
  CreateCreditPackSchema,
  UpdateCreditPackSchema,
  UpdateServiceRateSchema,
  RechargeOrgWalletSchema,
  GetOrgWalletsQuerySchema,
} from "../validators/ai-studio.validator.js";
import { statusCode, AiServiceType, AiTransactionType } from "../../../types/types.js";

const service = new AiStudioPlatformService();

/**
 * @controller  getAllCreditPacks
 * @desc        Fetch all available top-up credit packs for platform management or org purchase
 * @route       GET /api/v1/platform/ai-studio/credit-packs
 * @access      Platform Admin
 */
export async function getAllCreditPacks(req: Request, res: Response, next: NextFunction) {
  try {
    const onlyActive = req.query.onlyActive === "true";
    const packs = await service.getAllCreditPacks(onlyActive);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Credit packs retrieved successfully",
      data: packs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getCreditPackById
 * @desc        Retrieve a specific top-up credit pack by its ID
 * @route       GET /api/v1/platform/ai-studio/credit-packs/:id
 * @access      Platform Admin
 */
export async function getCreditPackById(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const pack = await service.getCreditPackById(id);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Credit pack details retrieved",
      data: pack,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  createCreditPack
 * @desc        Create a new credit top-up pack in the platform catalog
 * @route       POST /api/v1/platform/ai-studio/credit-packs
 * @access      Platform Admin
 */
export async function createCreditPack(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = CreateCreditPackSchema.parse(req.body);
    const newPack = await service.createCreditPack(validated);

    return res.status(statusCode.Created).json({
      success: true,
      message: "Top-up credit pack created successfully",
      data: newPack,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  updateCreditPack
 * @desc        Update properties, pricing or popularity of an existing credit pack
 * @route       PATCH /api/v1/platform/ai-studio/credit-packs/:id
 * @access      Platform Admin
 */
export async function updateCreditPack(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    const validated = UpdateCreditPackSchema.parse(req.body);
    const updated = await service.updateCreditPack(id, validated);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Top-up credit pack updated successfully",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  deleteCreditPack
 * @desc        Delete a credit pack from the catalog
 * @route       DELETE /api/v1/platform/ai-studio/credit-packs/:id
 * @access      Platform Admin
 */
export async function deleteCreditPack(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String(req.params.id);
    await service.deleteCreditPack(id);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Credit pack deleted successfully",
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getAllServiceRates
 * @desc        Fetch the AI service pricing matrix (credit cost per feature)
 * @route       GET /api/v1/platform/ai-studio/service-rates
 * @access      Platform Admin
 */
export async function getAllServiceRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rates = await service.getAllServiceRates();

    return res.status(statusCode.OK).json({
      success: true,
      message: "AI service pricing rates retrieved",
      data: rates,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  updateServiceRate
 * @desc        Update credit cost or description for an AI service (e.g. set Doubt Solver to 10 credits / query)
 * @route       PATCH /api/v1/platform/ai-studio/service-rates/:serviceType
 * @access      Platform Admin
 */
export async function updateServiceRate(req: Request, res: Response, next: NextFunction) {
  try {
    const serviceType = String(req.params.serviceType) as AiServiceType;
    const validated = UpdateServiceRateSchema.parse({
      ...req.body,
      serviceType,
    });

    const updated = await service.updateServiceRate(serviceType, validated);

    return res.status(statusCode.OK).json({
      success: true,
      message: `Service pricing for ${serviceType} updated successfully`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getOrgWallets
 * @desc        List all organization AI wallets with credit balances and usage stats
 * @route       GET /api/v1/platform/ai-studio/wallets
 * @access      Platform Admin
 */
export async function getOrgWallets(req: Request, res: Response, next: NextFunction) {
  try {
    const query = GetOrgWalletsQuerySchema.parse(req.query);
    const result = await service.getOrgWallets(query);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Organization wallets retrieved",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getOrgWalletDetails
 * @desc        Get specific organization AI wallet balance and stats
 * @route       GET /api/v1/platform/ai-studio/wallets/:organizationId
 * @access      Platform Admin
 */
export async function getOrgWalletDetails(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = String(req.params.organizationId);
    const wallet = await service.getOrgWalletDetails(organizationId);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Wallet details retrieved",
      data: wallet,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  rechargeOrganizationWallet
 * @desc        Recharge any tenant organization's AI wallet with a credit pack or custom credits
 * @route       POST /api/v1/platform/ai-studio/wallets/recharge
 * @access      Platform Admin
 */
export async function rechargeOrganizationWallet(req: Request, res: Response, next: NextFunction) {
  try {
    const validated = RechargeOrgWalletSchema.parse(req.body);
    const result = await service.rechargeOrganizationWallet(validated);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Organization wallet recharged successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getTransactions
 * @desc        Fetch filterable transaction ledger across tenant organizations
 * @route       GET /api/v1/platform/ai-studio/transactions
 * @access      Platform Admin
 */
export async function getTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = req.query.organizationId ? String(req.query.organizationId) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const transactionType = req.query.transactionType ? (String(req.query.transactionType) as AiTransactionType) : undefined;

    const result = await service.getTransactions({
      organizationId,
      page,
      limit,
      transactionType,
    });

    return res.status(statusCode.OK).json({
      success: true,
      message: "Transactions retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

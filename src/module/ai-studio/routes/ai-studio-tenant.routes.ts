import { Router } from "express";
import { authenticate } from "../../../middlewares/auth.middleware.js";
import {
  getOrgAiWallet,
  getOrgAiTransactions,
  getOrgAiCreditPacks,
  getOrgAiServiceRates,
} from "../controllers/ai-studio-tenant.controller.js";

export const aiStudioTenantRouter = Router();

// Apply authentication to all tenant AI studio endpoints
aiStudioTenantRouter.use(authenticate);

/**
 * @route   GET /api/v1/ai-studio/wallet
 * @desc    Fetch active organization AI wallet balance, lifetime metrics, and subscription plan
 */
aiStudioTenantRouter.get("/wallet", getOrgAiWallet);

/**
 * @route   GET /api/v1/ai-studio/transactions
 * @desc    Fetch paginated credit ledger transactions for the caller organization
 */
aiStudioTenantRouter.get("/transactions", getOrgAiTransactions);

/**
 * @route   GET /api/v1/ai-studio/credit-packs
 * @desc    Fetch active top-up credit packs catalog
 */
aiStudioTenantRouter.get("/credit-packs", getOrgAiCreditPacks);

/**
 * @route   GET /api/v1/ai-studio/service-rates
 * @desc    Fetch active AI feature credit consumption rates
 */
aiStudioTenantRouter.get("/service-rates", getOrgAiServiceRates);

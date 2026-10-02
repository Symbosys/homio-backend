import { Router } from "express";
import { authenticate, authorize } from "../../../middlewares/auth.middleware.js";
import * as controller from "../controllers/ai-studio-platform.controller.js";

const router = Router();

// Guard all platform AI studio management endpoints for PLATFORM_ADMIN
router.use(authenticate, authorize("PLATFORM_ADMIN"));

/**
 * @route   GET /api/v1/platform/ai-studio/credit-packs
 * @desc    List all top-up credit packs with pricing, bonus credits and status
 */
router.get("/credit-packs", controller.getAllCreditPacks);

/**
 * @route   GET /api/v1/platform/ai-studio/credit-packs/:id
 * @desc    Get detailed properties of a specific credit pack
 */
router.get("/credit-packs/:id", controller.getCreditPackById);

/**
 * @route   POST /api/v1/platform/ai-studio/credit-packs
 * @desc    Create a new top-up credit package in the catalog
 */
router.post("/credit-packs", controller.createCreditPack);

/**
 * @route   PATCH /api/v1/platform/ai-studio/credit-packs/:id
 * @desc    Update an existing credit pack
 */
router.patch("/credit-packs/:id", controller.updateCreditPack);

/**
 * @route   DELETE /api/v1/platform/ai-studio/credit-packs/:id
 * @desc    Delete a credit pack from the catalog
 */
router.delete("/credit-packs/:id", controller.deleteCreditPack);

/**
 * @route   GET /api/v1/platform/ai-studio/service-rates
 * @desc    Fetch AI feature pricing matrix (cost per render/audit/query)
 */
router.get("/service-rates", controller.getAllServiceRates);

/**
 * @route   PATCH /api/v1/platform/ai-studio/service-rates/:serviceType
 * @desc    Update pricing for a feature (e.g., set Doubt Solver to 10 credits / query)
 */
router.patch("/service-rates/:serviceType", controller.updateServiceRate);

/**
 * @route   GET /api/v1/platform/ai-studio/wallets
 * @desc    List all tenant organization AI wallets with balances and lifetime usage
 */
router.get("/wallets", controller.getOrgWallets);

/**
 * @route   GET /api/v1/platform/ai-studio/wallets/:organizationId
 * @desc    Get specific organization AI wallet details
 */
router.get("/wallets/:organizationId", controller.getOrgWalletDetails);

/**
 * @route   POST /api/v1/platform/ai-studio/wallets/recharge
 * @desc    Recharge an organization's AI wallet with a credit pack or custom credits
 */
router.post("/wallets/recharge", controller.rechargeOrganizationWallet);

/**
 * @route   GET /api/v1/platform/ai-studio/transactions
 * @desc    Fetch global transaction ledger of credits credited and debited across tenants
 */
router.get("/transactions", controller.getTransactions);

export default router;

import type { Request, Response, NextFunction } from "express";
import { AiStudioRepository } from "../repos/ai-studio.repository.js";
import { prisma } from "../../../lib/prisma.js";
import { statusCode, AiTransactionType } from "../../../types/types.js";
import { resolveAiTargetUser } from "../utils/ai-auth.util.js";

const repo = new AiStudioRepository();

/**
 * @controller  getOrgAiWallet
 * @desc        Retrieve or initialize the active user/organization AI credit wallet and subscription plan
 * @route       GET /api/v1/ai-studio/wallet
 * @access      Authenticated Users (Client Users, Org Admins, and Authorized Employees)
 */
export async function getOrgAiWallet(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      req.query.orgUserId as string | undefined
    );

    const organizationId = req.user.organizationId;

    const [wallet, activeSubscription] = await Promise.all([
      repo.findOrCreateWallet(targetUserId),
      organizationId
        ? prisma.subscription.findFirst({
            where: { organizationId, status: "ACTIVE" },
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  description: true,
                  priceMonthly: true,
                  priceYearly: true,
                  features: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        : null,
    ]);

    return res.status(statusCode.OK).json({
      success: true,
      message: "AI wallet retrieved successfully",
      data: {
        wallet,
        subscription: activeSubscription || null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getOrgAiTransactions
 * @desc        Fetch paginated AI credit transaction history scoped to target user
 * @route       GET /api/v1/ai-studio/transactions
 * @access      Authenticated Users
 */
export async function getOrgAiTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(statusCode.Unauthorized).json({
        success: false,
        message: "Authentication required",
      });
    }

    const { targetUserId } = await resolveAiTargetUser(
      req.user,
      req.query.orgUserId as string | undefined
    );

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const transactionType = req.query.transactionType as AiTransactionType | undefined;

    const result = await repo.findTransactionsPaginated({
      userId: targetUserId,
      page,
      limit,
      transactionType,
    });

    return res.status(statusCode.OK).json({
      success: true,
      message: "AI credit transactions retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getOrgAiCreditPacks
 * @desc        Fetch active top-up credit packages available for tenant purchase preview
 * @route       GET /api/v1/ai-studio/credit-packs
 * @access      Organization Authenticated Users
 */
export async function getOrgAiCreditPacks(_req: Request, res: Response, next: NextFunction) {
  try {
    const packs = await repo.findAllCreditPacks(true);

    return res.status(statusCode.OK).json({
      success: true,
      message: "Active top-up credit packs retrieved successfully",
      data: packs,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @controller  getOrgAiServiceRates
 * @desc        Fetch active AI feature credit consumption rates matrix
 * @route       GET /api/v1/ai-studio/service-rates
 * @access      Organization Authenticated Users
 */
export async function getOrgAiServiceRates(_req: Request, res: Response, next: NextFunction) {
  try {
    const rates = await repo.findAllServiceRates();
    const activeRates = rates.filter((r) => r.isActive);

    return res.status(statusCode.OK).json({
      success: true,
      message: "AI service rates retrieved successfully",
      data: activeRates,
    });
  } catch (error) {
    next(error);
  }
}

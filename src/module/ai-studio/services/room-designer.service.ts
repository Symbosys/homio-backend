import { RoomDesignerRepository } from "../repositories/room-designer.repository.js";
import {
  RoomDesignChain,
  OpenAiImageService,
} from "../../../lib/langchain/index.js";
import { storageService } from "../../../lib/storage/storage.service.js";
import type {
  GenerateRoomDesignInput,
  QueryRoomDesignSessionsInput,
  UpdateRoomDesignSessionInput,
} from "../validators/room-designer.validator.js";

export class RoomDesignerService {
  private repo: RoomDesignerRepository;

  constructor() {
    this.repo = new RoomDesignerRepository();
  }

  /**
   * Determine per-render credit deduction cost
   */
  public async getPerRenderCost(): Promise<number> {
    const rate = await this.repo.getRoomDesignerServiceRate();
    return rate?.defaultCreditCost ?? 10;
  }

  /**
   * Generate AI Room Design Renders using LangChain & OpenAI Image Generation with multi-image output and credit calculation
   */
  public async generateRoomDesign(
    organizationId: string,
    employeeId: string | null,
    input: GenerateRoomDesignInput
  ) {
    const startTime = Date.now();
    const perRenderCost = await this.getPerRenderCost();
    const imageCount = Math.max(1, Math.min(4, input.imageCount || 1));
    const totalCost = perRenderCost * imageCount;

    // 1. Verify organization credit balance for total requested image outputs
    const wallet = await this.repo.findOrCreateWallet(organizationId);
    if (wallet.currentBalance < totalCost) {
      const err: any = new Error(
        `Insufficient AI credits. You have ${wallet.currentBalance} credits, but generating ${imageCount} room render(s) requires ${totalCost} credits (${perRenderCost} credits × ${imageCount} images).`
      );
      err.statusCode = 402;
      err.code = "INSUFFICIENT_CREDITS";
      throw err;
    }

    // 2. Synthesize ultra-detailed architectural prompt via LangChain with structural preservation
    const hasBeforeImage = Boolean(
      input.beforeImage || (input.beforeImages && input.beforeImages.length > 0)
    );

    const synthesizedPrompt = await RoomDesignChain.synthesizePrompt({
      roomType: input.roomType,
      designStyle: input.designStyle,
      colorPalette: input.colorPalette,
      materialPreferences: input.materialPreferences,
      lightingMode: input.lightingMode,
      customInstructions: input.customInstructions,
      hasBeforeImage,
    });

    const imageModel = (process.env.OPENAI_IMAGE_MODEL as any) || "gpt-image-1";

    // 3. Generate photorealistic renders with OpenAI & store in Cloud Storage
    const imageResult = await OpenAiImageService.generateRoomImages({
      prompt: synthesizedPrompt,
      count: imageCount,
      model: imageModel,
      size: "1024x1024",
      quality: "standard",
    });

    const executionDurationMs = Date.now() - startTime;

    // Support both multiple before images and single before image
    const beforeImagesData =
      input.beforeImages && input.beforeImages.length > 0
        ? input.beforeImages
        : input.beforeImage
        ? [input.beforeImage]
        : null;

    // 4. Save session and design satellite records in DB
    const roomSession = await this.repo.createRoomDesignSession({
      organizationId,
      employeeId,
      roomType: input.roomType,
      designStyle: input.designStyle,
      colorPalette: input.colorPalette,
      materialPreferences: input.materialPreferences,
      lightingMode: input.lightingMode,
      beforeImageUrl: beforeImagesData,
      generatedImageUrl: imageResult.primaryImage,
      alternativeRenders: imageResult.allImages,
      generationMetadata: {
        synthesizedPrompt,
        revisedPrompts: imageResult.revisedPrompts,
        model: imageModel,
        aspectRatio: "1:1",
        imageCount,
      },
      additionalInformation: input.additionalInformation,
      executionDurationMs,
    });

    // 5. Atomic Credit Deduction & Ledger Entry for totalCost
    const { wallet: updatedWallet } = await this.repo.atomicDeductCredits({
      organizationId,
      employeeId,
      sessionId: roomSession.sessionId,
      cost: totalCost,
      description: `AI Room Designer render (${imageCount} image${imageCount > 1 ? "s" : ""}): ${input.designStyle} ${input.roomType}`,
    });

    return {
      session: roomSession,
      primaryImage: imageResult.primaryImage,
      allImages: imageResult.allImages,
      wallet: updatedWallet,
      creditsDeducted: totalCost,
      imageCount,
    };
  }

  /**
   * List paginated room design sessions
   */
  public async listSessions(
    organizationId: string,
    query: QueryRoomDesignSessionsInput
  ) {
    return this.repo.listSessions(organizationId, query);
  }

  /**
   * Get single room design session by ID
   */
  public async getSessionById(sessionId: string, organizationId: string) {
    const session = await this.repo.getSessionById(sessionId, organizationId);
    if (!session) {
      const err: any = new Error("Room design session not found");
      err.statusCode = 404;
      throw err;
    }
    return session;
  }

  /**
   * Update session metadata
   */
  public async updateSession(
    sessionId: string,
    organizationId: string,
    data: UpdateRoomDesignSessionInput
  ) {
    const result = await this.repo.updateSession(
      sessionId,
      organizationId,
      data
    );
    if (!result) {
      const err: any = new Error("Room design session not found");
      err.statusCode = 404;
      throw err;
    }
    return result;
  }

  /**
   * Delete room design session & auto-cleanup cloud storage media (Rule 4 Standard)
   */
  public async deleteSession(sessionId: string, organizationId: string) {
    const session = await this.repo.deleteSession(sessionId, organizationId);
    if (!session) {
      const err: any = new Error("Room design session not found");
      err.statusCode = 404;
      throw err;
    }

    // Auto-cleanup all cloud media assets (Rule 4)
    try {
      const allRenders = (session.alternativeRenders as any[]) || [session.generatedImageUrl];
      for (const img of allRenders) {
        if (img?.id) {
          await storageService.delete(img.id);
        }
      }

      const beforeImages = Array.isArray(session.beforeImageUrl)
        ? (session.beforeImageUrl as any[])
        : session.beforeImageUrl
        ? [session.beforeImageUrl]
        : [];

      for (const bImg of beforeImages) {
        if (bImg?.id) {
          await storageService.delete(bImg.id);
        }
      }
    } catch (cleanupErr) {
      console.warn("[RoomDesignerService] Media cleanup warning:", cleanupErr);
    }

    return session;
  }
}

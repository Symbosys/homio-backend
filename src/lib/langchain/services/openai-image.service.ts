import axios from "axios";
import { storageService } from "../../storage/storage.service.js";
import type { ImageType } from "../../../types/types.js";

export interface GenerateImageOptions {
  prompt: string;
  count?: number;
  model?: "dall-e-3" | "dall-e-2";
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  apiKey?: string;
}

export interface GenerateMultipleImagesResult {
  primaryImage: ImageType;
  allImages: ImageType[];
  revisedPrompts: string[];
  originalPrompt: string;
}

/**
 * OpenAI Image Generation Service (DALL-E 3 / DALL-E 2 REST Client)
 * Connects directly via standard HTTP REST API without external proprietary SDKs
 */
export class OpenAiImageService {
  private static getApiKey(overrideKey?: string): string {
    const key =
      overrideKey ||
      process.env.OPENAI_API_KEY ||
      "";

    if (!key) {
      throw new Error(
        "OpenAI API key not configured. Please supply OPENAI_API_KEY in server environment variables."
      );
    }
    return key;
  }

  /**
   * Generates single or multiple photorealistic room renders using OpenAI DALL-E and stores them in Cloud Storage
   */
  public static async generateRoomImages(
    options: GenerateImageOptions
  ): Promise<GenerateMultipleImagesResult> {
    const apiKey = this.getApiKey(options.apiKey);
    const model = process.env.OPENAI_IMAGE_MODEL || options.model || "gpt-image-1";
    const size = options.size || "1024x1024";
    const quality = options.quality || "standard";
    const count = Math.max(1, Math.min(4, options.count || 1));

    try {
      const requestPromises = Array.from({ length: count }).map(async (_, idx) => {
        // Add subtle variation hint for multiple images if count > 1
        const variedPrompt =
          count > 1
            ? `${options.prompt} (Architectural variation angle ${idx + 1}, unique perspective view)`
            : options.prompt;

        const requestBody: Record<string, any> = {
          model,
          prompt: variedPrompt,
          n: 1,
          size,
        };

        if (model === "dall-e-3") {
          requestBody.quality = quality;
        }

        const response = await axios.post(
          "https://api.openai.com/v1/images/generations",
          requestBody,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: 90000,
          }
        );

        const data = response.data?.data?.[0];
        const remoteUrl = data?.url;
        const b64Json = data?.b64_json;
        const revisedPrompt = data?.revised_prompt || variedPrompt;

        let buffer: Buffer;

        if (b64Json) {
          buffer = Buffer.from(b64Json, "base64");
        } else if (remoteUrl) {
          // Download and upload to permanent cloud storage (Rule 4 Standard)
          const imgDownloadRes = await axios.get(remoteUrl, {
            responseType: "arraybuffer",
            timeout: 30000,
          });
          buffer = Buffer.from(imgDownloadRes.data);
        } else {
          throw new Error(
            `No image data returned from OpenAI for image variation #${idx + 1}`
          );
        }

        const fileName = `room_render_${Date.now()}_var${idx + 1}.png`;

        const uploadResult = await storageService.upload(
          {
            buffer,
            originalname: fileName,
            mimetype: "image/png",
            size: buffer.length,
          },
          {
            folder: "homio/ai-studio/room-designs",
          }
        );

        const storedImage: ImageType = {
          id: uploadResult.publicId,
          url: uploadResult.url,
          bytes: uploadResult.bytes,
          format: uploadResult.format,
          provider: uploadResult.provider as any,
        };

        return {
          image: storedImage,
          revisedPrompt,
        };
      });

      const results = await Promise.all(requestPromises);
      const allImages = results.map((r) => r.image);
      const revisedPrompts = results.map((r) => r.revisedPrompt);
      const primaryImage = allImages[0];

      if (!primaryImage) {
        throw new Error("Failed to generate any image renders from OpenAI");
      }

      return {
        primaryImage,
        allImages,
        revisedPrompts,
        originalPrompt: options.prompt,
      };
    } catch (error: any) {
      const apiErrorMsg =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Unknown OpenAI image generation error";
      console.error("[OpenAiImageService] Image generation failed:", apiErrorMsg);
      throw new Error(`OpenAI Room Design generation failed: ${apiErrorMsg}`);
    }
  }
}

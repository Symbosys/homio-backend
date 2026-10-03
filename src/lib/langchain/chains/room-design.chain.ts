import type { LlmMessage } from "../interfaces/llm-provider.interface.js";
import { LlmFactory } from "../llm.factory.js";

export interface RoomDesignPromptInput {
  roomType: string;
  designStyle: string;
  colorPalette?: string[];
  materialPreferences?: string[];
  lightingMode?: string;
  customInstructions?: string;
  hasBeforeImage?: boolean;
}

/**
 * LangChain Chain for Architectural Room Design & Before-to-After Transformation
 * Synthesizes interior architecture design tokens into photorealistic image prompts
 * strictly preserving the room's structural layout and perspective.
 */
export class RoomDesignChain {
  /**
   * Synthesize a hyper-detailed architectural generation prompt with structural preservation
   */
  public static async synthesizePrompt(
    input: RoomDesignPromptInput
  ): Promise<string> {
    const {
      roomType,
      designStyle,
      colorPalette = [],
      materialPreferences = [],
      lightingMode = "Day Natural Sunlight",
      customInstructions = "",
      hasBeforeImage = false,
    } = input;

    const llm = LlmFactory.getProvider();

    const systemPrompt = `
You are an elite interior architect, spatial renovation director, and 3D architectural visualizer.
Your mission is to generate a single, highly precise image generation prompt for a complete "Before-to-After" interior makeover photograph.

### CRITICAL STRUCTURAL PRESERVATION RULES:
1. You MUST PRESERVE the exact room geometry, wall positions, ceiling lines, structural columns, window/door placements, and camera perspective view.
2. Do NOT invent unrelated architectural layouts. The new design must look like a real-world, completed luxury renovation of the EXACT same physical room space.
3. Transform all surfaces, materials, cabinetry, lighting, ceiling treatment, flooring, and furniture to match the requested design style and luxury aesthetic.
4. Output MUST be a single raw photographic prompt without preamble, conversational text, quotes, or markdown. Keep strictly under 900 characters.
`.trim();

    const paletteStr =
      colorPalette.length > 0 ? colorPalette.join(", ") : "Warm neutral luxury palette";
    const materialsStr =
      materialPreferences.length > 0
        ? materialPreferences.join(", ")
        : "Fluted wood, Italian marble, polished brass, textured fabrics";

    const structuralInstruction = hasBeforeImage
      ? "Renovation makeover of existing room space: strictly maintain the original physical room dimensions, window placements, wall boundaries, and camera angle."
      : "Balanced architectural interior perspective with realistic room layout and structural integrity.";

    const userMessage: LlmMessage = {
      role: "user",
      content: `
Room Type: ${roomType}
Design Style: ${designStyle}
Color Theme: ${paletteStr}
Selected Materials & Finishes: ${materialsStr}
Lighting Atmosphere: ${lightingMode}
Structural Context: ${structuralInstruction}
Custom Designer Notes: ${customInstructions || "None"}

Please synthesize this into an ultra-realistic 8K architectural interior photograph prompt of the finished space with crisp textures, ray-traced lighting, and Architectural Digest editorial aesthetics.
`.trim(),
    };

    try {
      const generatedPrompt = await llm.generate([userMessage], {
        systemPrompt,
        temperature: 0.25,
        maxTokens: 400,
      });

      const cleanPrompt = generatedPrompt
        .replace(/^["']|["']$/g, "")
        .replace(/```/g, "")
        .trim();

      if (cleanPrompt && cleanPrompt.length > 20) {
        return cleanPrompt;
      }
    } catch (err) {
      console.warn("[RoomDesignChain] LLM prompt synthesis fallback used:", err);
    }

    // High-fidelity fallback template preserving room structure
    return `Ultra-realistic 8k architectural interior photograph of a renovated ${designStyle} ${roomType}. Maintaining exact structural layout, wall boundaries, and window placement. Featuring ${materialsStr}, harmonized with ${paletteStr}. Illuminated by ${lightingMode} with realistic ambient occlusion, soft cove lighting, crisp reflections, 24mm wide angle perspective, Architectural Digest editorial quality. ${customInstructions ? customInstructions + "." : ""}`.trim();
  }
}

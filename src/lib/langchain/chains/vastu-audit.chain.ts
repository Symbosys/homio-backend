import type { LlmMessage } from "../interfaces/llm-provider.interface.js";
import { LlmFactory } from "../llm.factory.js";
import { VASTU_VEDIC_SPATIAL_SYSTEM_PROMPT } from "./prompts/vastu-system-prompt.js";
import {
  getZoneDefinition,
  evaluateRoomPlacement,
  calculateDocumentedScore,
  calculatePanchaTattva,
  normalizeDirectionCode,
} from "./vastu-rules.js";
import type { RoomEvaluationResult } from "./vastu-rules.js";

export interface VastuAuditInput {
  propertyType: string;
  facingDirection: string;
  totalAreaSqft?: number;
  numberOfFloors?: number;
  city?: string;
  selectedFocusAreas?: string[];
  customInstructions?: string;
  floorPlanUrl?: any | null;
  sitePhotos?: any[] | null;
  hasFloorPlan?: boolean;
  hasSitePhotos?: boolean;
  customSystemPrompt?: string;
  model?: string;
}

export interface ZoneEvaluation {
  zone: string;
  direction: string;
  element: "Water" | "Air" | "Fire" | "Earth" | "Space";
  deityZone?: string;
  idealUsage: string;
  currentStatus: string;
  status?: "OPTIMAL" | "NEEDS_REVIEW" | "ADJUSTMENT" | "DEFECT";
  complianceScore: number; // 0 - 100
  doshaSeverity: "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  observations: string;
  remedyRecommendation?: string;
}

export interface RemedialSolutionItem {
  id: string;
  zone: string;
  issue: string;
  category: "COLOR_THERAPY" | "METAL_INLAY" | "PYRAMID_CRYSTAL" | "MIRROR_LIGHTING" | "BOTANICAL";
  remedyTitle: string;
  description: string;
  isNonDemolition: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW";
  estimatedCostInr: number;
}

export interface VastuAuditOutput {
  isFloorPlanDetected: boolean;
  imageDetectionConfidence?: number;
  overallScore: number;
  complianceRating: "EXCELLENT" | "GOOD" | "MODERATE" | "CRITICAL_DOSHAS";
  summary: string;
  keyStrengths: string[];
  criticalDoshas: string[];
  zoneBreakdown: ZoneEvaluation[];
  remedialSolutions: RemedialSolutionItem[];
  elementalBalance?: {
    water: number; // percentage
    air: number;
    fire: number;
    earth: number;
    space: number;
  };
}

export class VastuAuditChain {
  /**
   * Executes deep Indian Vedic Vastu 9-zone spatial analysis using multimodal vision
   */
  public static async executeAudit(
    input: VastuAuditInput
  ): Promise<VastuAuditOutput> {
    const {
      propertyType,
      facingDirection,
      totalAreaSqft = 1500,
      numberOfFloors = 1,
      city = "Bangalore, India",
      selectedFocusAreas = ["entrance", "kitchen", "master-bedroom", "pooja-room", "living-room"],
      customInstructions = "",
    } = input;

    // Collect image URLs for multimodal vision reasoning (support both http(s) and base64 data URLs)
    const images: string[] = [];
    if (input.floorPlanUrl) {
      const url =
        typeof input.floorPlanUrl === "string"
          ? input.floorPlanUrl
          : input.floorPlanUrl?.url;
      if (url && typeof url === "string" && (url.startsWith("http") || url.startsWith("data:"))) {
        images.push(url);
      }
    }
    if (Array.isArray(input.sitePhotos)) {
      for (const p of input.sitePhotos) {
        const url = typeof p === "string" ? p : p?.url;
        if (url && typeof url === "string" && (url.startsWith("http") || url.startsWith("data:"))) {
          images.push(url);
        }
      }
    }

    const defaultSystemPrompt = VASTU_VEDIC_SPATIAL_SYSTEM_PROMPT;

    // If platform admin defined a custom system prompt/guide in AiServiceRate, inject it with priority
    const systemPrompt = input.customSystemPrompt?.trim()
      ? `${input.customSystemPrompt.trim()}\n\n### MANDATORY AUDIT PROTOCOLS & SCHEMA REQUIREMENTS:\n${defaultSystemPrompt}`
      : defaultSystemPrompt;

    const userMessage: LlmMessage = {
      role: "user",
      content: `
Perform an authentic 9-Zone Indian Vedic Vastu spatial audit on the following property specifications and attached media:
- Property Type: ${propertyType}
- Main Facing Direction: ${facingDirection}
- Total Area: ${totalAreaSqft} sqft
- Number of Floors: ${numberOfFloors}
- City / Location: ${city}
- Target Focus Areas: ${selectedFocusAreas.join(", ")}
- Custom Context / Notes: ${customInstructions || "Analyze spatial energy and directional room placements."}
${
  images.length > 0
    ? "- Attached Media: Inspect the uploaded layout image with strict geometric precision. Identify the North arrow or compass indicators along the outer borders or blueprint (Top=North, Bottom=South, Left=West, Right=East). Divide into a 3x3 grid (NW, N, NE, W, Center, E, SW, S, SE). Read the room label in each quadrant. Map every room to its actual physical geometric quadrant. Do NOT relocate rooms to preferred directions. Evaluate each room as strictly COMPLIANT (OPTIMAL) or NON-COMPLIANT (DEFECT). Never output 'Not utilized' if a room is visible. Never output 'No Specific Rule'."
    : "- Note: No floor plan image attached. Evaluate compliance based on the specified facing direction and property attributes."
}

CRITICAL RULES:
1. Do NOT output any boqEstimations, bill of quantities, or cost tables. Focus strictly on Vastu spatial evaluation and non-demolition remedies.
2. Return ONLY a valid JSON object matching the VastuAuditOutput schema. Do NOT include markdown code fences or conversational text.
`.trim(),
      images: images.length > 0 ? images : undefined,
    };

    // Use OpenAI directly for Vastu spatial vision & Vedic reasoning
    const llm = LlmFactory.getProvider("openai");

    try {
      const response = await llm.generate([userMessage], {
        systemPrompt,
        temperature: 0.1,
        maxTokens: 3500,
        jsonMode: true,
        model: input.model || "gpt-4o",
      });

      const cleanJson = response
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed = JSON.parse(cleanJson);

      // Validate and normalize through deterministic 9-zone rule engine
      return VastuAuditChain.validateAndNormalizeAuditOutput(parsed, facingDirection);
    } catch (err: any) {
      console.error("[VastuAuditChain] OpenAI generation error:", err?.message || err);
      // If error occurs and images were attached, do not return mock data
      if (images.length > 0) {
        throw new Error(`OpenAI Vastu Consultation failed: ${err?.message || "Invalid response format"}`);
      }
      // If no image was provided, return deterministic directional fallback without BOQ
      return VastuAuditChain.getVedicMatrixFallback(input);
    }
  }

  /**
   * Deterministic validation and cross-consistency normalization guardrail.
   * Ensures:
   * 1. Every room is verified against the 9-Zone Reference (Toilet in NW is NOT a defect; Kitchen in E is NEEDS_REVIEW).
   * 2. Compliance score is calculated using the documented formula.
   * 3. Pancha Tattva is calculated using the validated formula.
   * 4. criticalDoshas has zero false claims.
   * 5. Summary, findings, counts, and scores are 100% consistent.
   */
  public static validateAndNormalizeAuditOutput(
    parsed: any,
    facingDirection: string = "East"
  ): VastuAuditOutput {
    // Handle non-floor-plan detection
    if (parsed.isFloorPlanDetected === false || parsed.overallScore === 0) {
      return {
        isFloorPlanDetected: false,
        imageDetectionConfidence: parsed.imageDetectionConfidence ?? 0.05,
        overallScore: 0,
        complianceRating: "CRITICAL_DOSHAS",
        summary:
          parsed.summary ||
          "No architectural floor plan detected. The uploaded media does not contain a recognizable floor plan, blueprint, or architectural layout. Please upload a clear 2D floor plan image to conduct an authentic Vastu spatial audit.",
        keyStrengths: [],
        criticalDoshas: [
          "No valid architectural floor plan or layout detected in uploaded media. Please upload a clear 2D blueprint or layout sketch.",
        ],
        zoneBreakdown: [],
        remedialSolutions: [],
        elementalBalance: undefined,
      };
    }

    const rawZones: any[] = Array.isArray(parsed.zoneBreakdown) ? parsed.zoneBreakdown : [];
    const normalizedEvaluations: RoomEvaluationResult[] = [];
    const normalizedZoneBreakdown: ZoneEvaluation[] = [];
    const zoneScoreMap = new Map<string, number>();

    for (const rz of rawZones) {
      const roomDesc = (rz.currentStatus || rz.observations || rz.roomName || "").trim();
      const rawDir = rz.direction || rz.zone || "";
      const evaluation = evaluateRoomPlacement(roomDesc, rawDir);
      normalizedEvaluations.push(evaluation);

      const zoneDef = getZoneDefinition(evaluation.zoneCode);
      zoneScoreMap.set(evaluation.zoneCode, evaluation.complianceScore);

      normalizedZoneBreakdown.push({
        zone: zoneDef.zoneName,
        direction: zoneDef.direction,
        element: zoneDef.element,
        deityZone: zoneDef.deityZone,
        idealUsage: zoneDef.idealUsage,
        currentStatus: roomDesc || "Open Space / Circulation",
        status: evaluation.status,
        complianceScore: evaluation.complianceScore,
        doshaSeverity: evaluation.doshaSeverity,
        observations: evaluation.observations,
        remedyRecommendation:
          evaluation.remedyRecommendation ||
          (evaluation.status === "DEFECT" ? rz.remedyRecommendation : undefined),
      });
    }

    // 1. Calculate deterministic compliance score using the documented formula
    const documentedScore =
      normalizedEvaluations.length > 0
        ? calculateDocumentedScore(normalizedEvaluations)
        : typeof parsed.overallScore === "number"
        ? parsed.overallScore
        : 0;

    // 2. Calculate validated Pancha Tattva balance
    const elementalBalance = calculatePanchaTattva(zoneScoreMap);

    // 3. Separate validated defects from strengths
    const verifiedDefects = normalizedEvaluations
      .filter((e) => e.status === "DEFECT")
      .map(
        (e) =>
          `${e.roomName} in ${e.direction}: Confirmed defect against Vedic avoidance rule.`
      );

    const verifiedStrengths = normalizedEvaluations
      .filter((e) => e.status === "OPTIMAL")
      .map(
        (e) =>
          `${e.roomName} in ${e.direction}: Harmonious Vedic placement.`
      );

    // 4. Clean and validate remedial solutions to strictly address actual defects
    const verifiedRemedies: RemedialSolutionItem[] = [];
    const rawRemedies: any[] = Array.isArray(parsed.remedialSolutions)
      ? parsed.remedialSolutions
      : [];

    for (const rem of rawRemedies) {
      const targetZoneCode = normalizeDirectionCode(rem.zone || "");
      // Only keep remedies where there's an actual DEFECT or ADJUSTMENT in that zone
      const hasIssueInZone = normalizedEvaluations.some(
        (e) => e.zoneCode === targetZoneCode && e.status === "DEFECT"
      );
      if (hasIssueInZone) {
        verifiedRemedies.push({
          id: rem.id || `rem-${verifiedRemedies.length + 1}`,
          zone: rem.zone || getZoneDefinition(targetZoneCode).zoneName,
          issue: rem.issue || "Elemental alignment balance",
          category: rem.category || "METAL_INLAY",
          remedyTitle: rem.remedyTitle || "Non-Demolition Vedic Remedy",
          description: rem.description || "Apply non-demolition directional boundary cures.",
          isNonDemolition: true,
          priority:
            rem.priority === "HIGH" || rem.priority === "CRITICAL"
              ? "HIGH"
              : rem.priority === "LOW"
              ? "LOW"
              : "MEDIUM",
          estimatedCostInr:
            typeof rem.estimatedCostInr === "number" ? rem.estimatedCostInr : 3500,
        });
      }
    }

    // 5. Build consistent summary
    const optimalCount = normalizedEvaluations.filter((e) => e.status === "OPTIMAL").length;
    const defectCount = verifiedDefects.length;

    let rating: "EXCELLENT" | "GOOD" | "MODERATE" | "CRITICAL_DOSHAS" = "GOOD";
    if (defectCount === 0 && documentedScore >= 80) rating = "EXCELLENT";
    else if (defectCount <= 1 && documentedScore >= 70) rating = "GOOD";
    else if (defectCount > 2 || documentedScore < 60) rating = "CRITICAL_DOSHAS";
    else rating = "MODERATE";

    const consistentSummary = `Vastu spatial audit completed for ${facingDirection}-facing layout. Evaluated ${normalizedEvaluations.length} identified zones: ${optimalCount} compliant (optimal) and ${defectCount} non-compliant (requiring remedial harmonization). Overall Vedic compliance score is ${documentedScore}/100.`;

    return {
      isFloorPlanDetected: true,
      imageDetectionConfidence: parsed.imageDetectionConfidence ?? 0.95,
      overallScore: documentedScore,
      complianceRating: rating,
      summary: consistentSummary,
      keyStrengths:
        verifiedStrengths.length > 0
          ? verifiedStrengths
          : ["Auspicious directional orientation welcoming positive prana."],
      criticalDoshas: verifiedDefects, // Empty array [] if 0 defects!
      zoneBreakdown: normalizedZoneBreakdown,
      remedialSolutions: verifiedRemedies,
      elementalBalance,
    };
  }

  /**
   * Deterministic Vedic Vastu calculation fallback (strictly for text-only without images, NO BOQ)
   */
  public static getVedicMatrixFallback(input: VastuAuditInput): VastuAuditOutput {
    const rawSample = {
      isFloorPlanDetected: true,
      imageDetectionConfidence: 1.0,
      overallScore: 80,
      complianceRating: "GOOD",
      summary: "",
      keyStrengths: [],
      criticalDoshas: [],
      zoneBreakdown: [
        {
          zone: "North-East (NE)",
          direction: "North-East",
          element: "Water",
          currentStatus: "Entrance & Prayer Area",
        },
        {
          zone: "East (E)",
          direction: "East",
          element: "Air",
          currentStatus: "Living Area with Ventilation",
        },
        {
          zone: "South-East (SE)",
          direction: "South-East",
          element: "Fire",
          currentStatus: "Kitchen Cooktop & Utility",
        },
        {
          zone: "South-West (SW)",
          direction: "South-West",
          element: "Earth",
          currentStatus: "Master Bedroom Suite",
        },
        {
          zone: "North-West (NW)",
          direction: "North-West",
          element: "Air",
          currentStatus: "Guest Bedroom & Utility Toilet",
        },
        {
          zone: "Center (Brahmasthan)",
          direction: "Center",
          element: "Space",
          currentStatus: "Central Hallway Passage",
        },
      ],
      remedialSolutions: [],
    };

    return VastuAuditChain.validateAndNormalizeAuditOutput(rawSample, input.facingDirection);
  }
}


import type { LlmMessage } from "../interfaces/llm-provider.interface.js";
import { LlmFactory } from "../llm.factory.js";

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
}

export interface ZoneEvaluation {
  zone: string;
  direction: string;
  element: "Water" | "Air" | "Fire" | "Earth" | "Space";
  deityZone?: string;
  idealUsage: string;
  currentStatus: string;
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

export interface VastuBoqItem {
  item: string;
  category: string;
  quantity: string;
  unitRateInr: number;
  totalCostInr: number;
  zone: string;
}

export interface VastuAuditOutput {
  overallScore: number;
  complianceRating: "EXCELLENT" | "GOOD" | "MODERATE" | "CRITICAL_DOSHAS";
  summary: string;
  keyStrengths: string[];
  criticalDoshas: string[];
  zoneBreakdown: ZoneEvaluation[];
  remedialSolutions: RemedialSolutionItem[];
  boqEstimations: {
    items: VastuBoqItem[];
    totalRemedialCostInr: number;
    laborAndInstallationInr: number;
    grandTotalInr: number;
  };
  elementalBalance: {
    water: number; // percentage
    air: number;
    fire: number;
    earth: number;
    space: number;
  };
}

export class VastuAuditChain {
  /**
   * Executes deep Vedic Vastu 16-zone spatial analysis
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

    const systemPrompt = `
You are Homio AI Vedic Vastu Master & Senior Architectural Spatial Auditor.
You conduct authoritative 16-zone Vastu Shastra audits for residential and commercial construction in India and globally.

### AUDIT PROTOCOLS & MANDATORY REQUIREMENTS:
1. Base your spatial calculations on authentic 16-Zone Vedic Vastu Mandala (North, NNE, NE/Eshan, ENE, East, ESE, SE/Agneya, SSE, South, SSW, SW/Nairuthi, WSW, West, WNW, NW/Vayavya, NNW) and Pancha Tattva (5 Elements).
2. CRITICAL VISION & LAYOUT ANALYSIS: If an image is attached, visually inspect it carefully.
   - If it is a floor plan, blueprint, or architectural layout: Identify the specific rooms, doors, kitchen, bedrooms, toilets, balconies, and their relative directional positions relative to the main facing direction (${facingDirection}).
   - If it is a photo of a specific room (e.g. kitchen, bedroom, living area): Identify specific furniture positions, sink/stove alignments, window orientations, and clutter.
   - If it is a non-architectural image (e.g. a portrait of a person, vehicle, landscape, or animal): Explicitly state in the summary what was identified in the image, note that no architectural floor plan was detected, and evaluate the spatial configuration based on the provided direction and room parameters.
3. Calculate a dynamic, realistic overall score between 40 and 95 out of 100 reflecting the specific property's facing direction (${facingDirection}) and layout.
4. Every single remedy recommendation MUST be a strictly NON-DEMOLITION solution (e.g., Brass/Copper/Zinc elemental wire inlays, lead blocks, color treatments, specific mirror placements, elemental stones, yantras, sacred plants).
5. Provide realistic BOQ (Bill of Quantities) items with accurate Indian market rates (INR ₹).
6. Output MUST be valid, parsable JSON matching the required schema. Do NOT include markdown code blocks (\`\`\`json) or conversational text.
`.trim();

    const userMessage: LlmMessage = {
      role: "user",
      content: `
Analyze the following property for Vastu compliance:
- Property Type: ${propertyType}
- Main Facing Direction: ${facingDirection}
- Total Area: ${totalAreaSqft} sqft
- Number of Floors: ${numberOfFloors}
- Location: ${city}
- Focus Rooms / Zones: ${selectedFocusAreas.join(", ")}
- Custom Context & Floor Plan Observations: ${customInstructions || "Analyze spatial energy and directional alignment from the provided property specifications."}
${images.length > 0 ? "- Attached Floor Plan / Media: Please visually inspect the attached image(s) and provide spatial zone analysis corresponding to what is visibly depicted." : ""}

Return a valid JSON object matching this exact structure:
{
  "overallScore": 76,
  "complianceRating": "GOOD",
  "summary": "Detailed executive summary of the spatial alignment and energy balance for this ${propertyType} (${facingDirection} Facing)...",
  "keyStrengths": ["Strength 1", "Strength 2", "Strength 3"],
  "criticalDoshas": ["Dosha 1", "Dosha 2"],
  "zoneBreakdown": [
    {
      "zone": "North-East (Eshan)",
      "direction": "North-East",
      "element": "Water",
      "deityZone": "Lord Shiva / Divine Energy",
      "idealUsage": "Pooja Room, Meditation, Open Clean Space",
      "currentStatus": "Pooja room & Foyer located here",
      "complianceScore": 90,
      "doshaSeverity": "NONE",
      "observations": "Excellent water element balance with abundant morning light.",
      "remedyRecommendation": "Keep clean and place brass water pot with fresh flowers."
    }
  ],
  "remedialSolutions": [
    {
      "id": "rem-1",
      "zone": "South-East (Agneya)",
      "issue": "Water element presence near fire corner",
      "category": "METAL_INLAY",
      "remedyTitle": "Copper Wire Energy Harmonizer",
      "description": "Install a 3mm pure copper strip flush into the flooring between the sink and cooktop.",
      "isNonDemolition": true,
      "priority": "HIGH",
      "estimatedCostInr": 3500
    }
  ],
  "boqEstimations": {
    "items": [
      {
        "item": "Pure Copper Floor Inlay Strip (3mm x 15ft)",
        "category": "Elemental Inlays",
        "quantity": "15 Rft",
        "unitRateInr": 250,
        "totalCostInr": 3750,
        "zone": "South-East (Agneya)"
      }
    ],
    "totalRemedialCostInr": 12500,
    "laborAndInstallationInr": 3500,
    "grandTotalInr": 16000
  },
  "elementalBalance": {
    "water": 82,
    "air": 75,
    "fire": 68,
    "earth": 70,
    "space": 85
  }
}
`.trim(),
      images: images.length > 0 ? images : undefined,
    };

    // Use OpenAI directly for Vastu spatial vision & Vedic reasoning
    const llm = LlmFactory.getProvider("openai");

    try {
      const response = await llm.generate([userMessage], {
        systemPrompt,
        temperature: 0.3,
        maxTokens: 3500,
      });

      const cleanJson = response
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const parsed: VastuAuditOutput = JSON.parse(cleanJson);

      if (parsed?.overallScore && Array.isArray(parsed?.zoneBreakdown)) {
        return parsed;
      }
    } catch (err: any) {
      console.error("[VastuAuditChain] OpenAI generation error:", err?.message || err);
      throw new Error(`OpenAI Vastu Consultation failed: ${err?.message || "Invalid response format"}`);
    }

    throw new Error("OpenAI Vastu Consultation returned an empty or invalid audit payload.");
  }

  /**
   * Deterministic Vedic Vastu calculation fallback
   */
  private static getVedicMatrixFallback(input: VastuAuditInput): VastuAuditOutput {
    const isNorthOrEast = ["North", "North-East", "East"].includes(input.facingDirection);
    const overallScore = isNorthOrEast ? 82 : 72;

    const zoneBreakdown: ZoneEvaluation[] = [
      {
        zone: "North-East (Eshan)",
        direction: "North-East",
        element: "Water",
        deityZone: "Eshanya / Divine Consciousness",
        idealUsage: "Pooja Room, Meditation, Water Features",
        currentStatus: "Pooja & Light Entrance Zone",
        complianceScore: 88,
        doshaSeverity: "NONE",
        observations: "Pure, clutter-free zone facilitating positive spiritual vibrations and mental clarity.",
        remedyRecommendation: "Maintain supreme cleanliness. Place a silver or brass bowl with clean water and fresh flowers.",
      },
      {
        zone: "East (Indra)",
        direction: "East",
        element: "Air",
        deityZone: "Lord Surya / Social Connections",
        idealUsage: "Living Room, Large Windows, Study",
        currentStatus: "Living Area with Ventilation",
        complianceScore: 84,
        doshaSeverity: "NONE",
        observations: "Good morning sunlight access enhances vitality and social connections.",
        remedyRecommendation: "Add light green or wooden accents on the eastern wall to boost Air element.",
      },
      {
        zone: "South-East (Agneya)",
        direction: "South-East",
        element: "Fire",
        deityZone: "Lord Agni / Digestion & Cash Flow",
        idealUsage: "Kitchen, Electrical Meters, Cooktops",
        currentStatus: "Kitchen Cooktop & Utility",
        complianceScore: 78,
        doshaSeverity: "LOW",
        observations: "Cooktop alignment requires slight harmonic balance with water inlet.",
        remedyRecommendation: "Install a 3mm copper strip along the floor boundary between sink and cooktop.",
      },
      {
        zone: "South-West (Nairuthi)",
        direction: "South-West",
        element: "Earth",
        deityZone: "Nirriti / Stability & Relationships",
        idealUsage: "Master Bedroom, Heavy Wardrobes, Heavy Furniture",
        currentStatus: "Master Bedroom Suite",
        complianceScore: 80,
        doshaSeverity: "LOW",
        observations: "Heavy master bedroom in South-West anchors the home stability and leadership.",
        remedyRecommendation: "Use warm earthy tones (beige, sand, ochre) and place heavy wooden furniture in the SW corner.",
      },
      {
        zone: "North-West (Vayavya)",
        direction: "North-West",
        element: "Air",
        deityZone: "Vayu / Support & Movement",
        idealUsage: "Guest Bedroom, Living Room, Movement Areas",
        currentStatus: "Guest Bedroom & Storage",
        complianceScore: 74,
        doshaSeverity: "MODERATE",
        observations: "Storage clutter in NW can slow down cash flow and helpful relationships.",
        remedyRecommendation: "Declutter NW corner. Place a white metal wind chime or brass horse figurine for positive mobility.",
      },
      {
        zone: "Center (Brahmasthan)",
        direction: "Center",
        element: "Space",
        deityZone: "Lord Brahma / Cosmic Energy Center",
        idealUsage: "Open Hall, Courtyard, Uncluttered Circulation",
        currentStatus: "Central Hallway Passage",
        complianceScore: 85,
        doshaSeverity: "NONE",
        observations: "Brahmasthan is open and unobstructed, allowing free cosmic energy circulation.",
        remedyRecommendation: "Never place heavy pillars, water storage, or toilets in the exact center.",
      },
    ];

    const remedialSolutions: RemedialSolutionItem[] = [
      {
        id: "rem-1",
        zone: "South-East (Agneya)",
        issue: "Fire-Water proximity in kitchen counter area",
        category: "METAL_INLAY",
        remedyTitle: "Copper Energy Harmonizer Inlay",
        description: "Insert a 3mm pure copper strip flush into the floor or quartz countertop between the sink and stove.",
        isNonDemolition: true,
        priority: "HIGH",
        estimatedCostInr: 3200,
      },
      {
        id: "rem-2",
        zone: "North-West (Vayavya)",
        issue: "Stagnant energy in support/mobility sector",
        category: "BOTANICAL",
        remedyTitle: "Vedic Air-Purifying botanical and metal chime",
        description: "Hang a 6-rod hollow brass wind chime and position a thriving indoor snake plant in the NW quadrant.",
        isNonDemolition: true,
        priority: "MEDIUM",
        estimatedCostInr: 2400,
      },
      {
        id: "rem-3",
        zone: "South-West (Nairuthi)",
        issue: "Light Earth anchoring in master bedroom",
        category: "COLOR_THERAPY",
        remedyTitle: "Earthy Ochre & Terracotta Wall Treatment",
        description: "Paint the south-west bedroom feature wall in rich terracotta or warm sandstone texture.",
        isNonDemolition: true,
        priority: "MEDIUM",
        estimatedCostInr: 4500,
      },
    ];

    const boqItems: VastuBoqItem[] = [
      {
        item: "Pure Copper Floor Inlay Strip (3mm x 12ft)",
        category: "Elemental Metals",
        quantity: "12 Rft",
        unitRateInr: 250,
        totalCostInr: 3000,
        zone: "South-East (Agneya)",
      },
      {
        item: "Six-Rod Hollow Brass Wind Chime",
        category: "Energy Cures",
        quantity: "1 Unit",
        unitRateInr: 1200,
        totalCostInr: 1200,
        zone: "North-West (Vayavya)",
      },
      {
        item: "Vedic Brass Water Urli with Floating Diya",
        category: "Sacred Accessories",
        quantity: "1 Unit",
        unitRateInr: 1800,
        totalCostInr: 1800,
        zone: "North-East (Eshan)",
      },
      {
        item: "Earth Element Natural Ochre Texture Paint Application",
        category: "Color Therapy",
        quantity: "120 Sqft",
        unitRateInr: 45,
        totalCostInr: 5400,
        zone: "South-West (Nairuthi)",
      },
    ];

    const totalRemedialCostInr = boqItems.reduce((acc, i) => acc + i.totalCostInr, 0);
    const laborAndInstallationInr = 2500;

    return {
      overallScore,
      complianceRating: overallScore >= 80 ? "EXCELLENT" : "GOOD",
      summary: `The ${input.propertyType} with a ${input.facingDirection} orientation exhibits a strong ${overallScore}/100 Vedic spatial balance. The North-East and Brahmasthan zones are clear and auspicious. Minor fire-water and airflow enhancements in the SE and NW quadrants can be seamlessly remedied without structural demolition.`,
      keyStrengths: [
        "Auspicious entrance orientation welcoming vital solar and magnetic pranic energy",
        "Clear and unobstructed Brahmasthan (central cosmic zone) facilitating free energy flow",
        "Properly zoned North-East spiritual quadrant with pristine light penetration",
      ],
      criticalDoshas: [
        "Slight elemental interference between fire and water lines in the kitchen zone",
        "Minor airflow stagnation in the North-West relationship/support corner",
      ],
      zoneBreakdown,
      remedialSolutions,
      boqEstimations: {
        items: boqItems,
        totalRemedialCostInr,
        laborAndInstallationInr,
        grandTotalInr: totalRemedialCostInr + laborAndInstallationInr,
      },
      elementalBalance: {
        water: 85,
        air: 78,
        fire: 72,
        earth: 80,
        space: 88,
      },
    };
  }
}

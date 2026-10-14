/**
 * Authoritative 9-Zone Vedic Vastu Reference Architecture & Deterministic Scoring Engine
 * 
 * Rules Source of Truth:
 * 1. North-West (NW) - Air (Vayavya): Permits Toilet/Powder Room, Washing, Guest Bed, Dining, Study.
 * 2. North (N) - Water (Kubera): Permits Safe, Open Space, Living, Bath (no WC). Prohibits Bedrooms.
 * 3. North-East (NE) - Water (Eshan): Permits Entrance, Temple/Pooja, Balcony, Sump. Prohibits Toilet, Kitchen, Septic Tank.
 * 4. East (E) - Air/Fire: Permits Bathrooms, Open Space, Living, Study, Guest Room. No explicit rule for Kitchen (Needs Review).
 * 5. South-East (SE) - Fire (Agni): Recommends Kitchen, Electrical Meter, Oil/Fuel store. Prohibits Cellar/Well/Underground tank.
 * 6. South (S) - Fire/Earth: Permits Bedroom (head South), Staircase, Store. Prohibits Cellar/Well.
 * 7. South-West (SW) - Earth (Nairuthi): Recommends Master Bedroom, Heavy Storage, Staircase. Prohibits Cellar/Basement/Well/Underground tank.
 * 8. West (W) - Space/Air: Permits Dining, Overhead tank, Children Bed, Study, Toilet. Prohibits Cellar/Basement.
 * 9. Center (Brahmasthan) - Cosmic Space: Permits Open Courtyard, Light/Airflow, Tulsi. Prohibits Pillars, Toilets, Septic Tank, Water Storage.
 */

export interface ZoneRuleDefinition {
  zoneCode: string; // "NE" | "N" | "NW" | "W" | "Center" | "E" | "SE" | "S" | "SW"
  zoneName: string;
  direction: string;
  element: "Water" | "Air" | "Fire" | "Earth" | "Space";
  deityZone: string;
  idealUsage: string;
  weight: number; // Importance weight in overall scoring (1.0 to 1.5)
  idealKeywords: string[];
  prohibitedKeywords: string[];
}

export const VASTU_9_ZONE_REFERENCE: Record<string, ZoneRuleDefinition> = {
  NE: {
    zoneCode: "NE",
    zoneName: "North-East (NE)",
    direction: "North-East",
    element: "Water",
    deityZone: "Eshan / Divine Energy",
    idealUsage: "Entrance, Temple / Meditation Room, Porch, Balcony, Underground Water Tank, Sump",
    weight: 1.5,
    idealKeywords: [
      "entrance",
      "main door",
      "temple",
      "pooja",
      "puja",
      "meditation",
      "prayer",
      "balcony",
      "porch",
      "verandah",
      "water tank",
      "sump",
      "borewell",
      "foyer",
      "altar",
      "mandir",
    ],
    prohibitedKeywords: [
      "toilet",
      "wc",
      "commode",
      "powder room",
      "restroom",
      "latrine",
      "kitchen",
      "cooking",
      "stove",
      "cooktop",
      "septic tank",
      "garbage",
      "heavy staircase",
      "bedroom",
      "bed",
      "master",
      "store",
    ],
  },
  N: {
    zoneCode: "N",
    zoneName: "North (N)",
    direction: "North",
    element: "Water",
    deityZone: "Lord Kubera / Wealth & Prosperity",
    idealUsage: "Treasury / Safe, More Open Space, Living Room, Bath (without toilet), Main Entrance",
    weight: 1.0,
    idealKeywords: [
      "living",
      "living room",
      "drawing",
      "reception",
      "safe",
      "treasury",
      "cash",
      "open space",
      "entrance",
      "bath",
      "balcony",
      "foyer",
    ],
    prohibitedKeywords: [
      "bedroom",
      "bed",
      "master",
      "master bedroom",
      "toilet",
      "wc",
      "kitchen",
      "cook",
      "stove",
      "septic tank",
      "heavy storage",
      "clutter",
      "store",
    ],
  },
  NW: {
    zoneCode: "NW",
    zoneName: "North-West (NW)",
    direction: "North-West",
    element: "Air",
    deityZone: "Lord Vayavya / Air, Movement & Relationships",
    idealUsage: "Guest Bedroom, Washing & Utility, Septic Tank, Dining, Toilet / Powder Room, Parking, Elder Child Room",
    weight: 1.0,
    idealKeywords: [
      "guest bedroom",
      "guest room",
      "washing",
      "utility",
      "laundry",
      "septic tank",
      "toilet",
      "powder room",
      "wc",
      "restroom",
      "washroom",
      "dining",
      "study",
      "parking",
      "garage",
      "children bedroom",
      "elder child",
      "granary",
    ],
    prohibitedKeywords: [
      "master bedroom", // Master bedroom belongs strictly in SW
      "temple",
      "pooja",
      "puja",
      "mandir",
      "shrine",
    ],
  },
  E: {
    zoneCode: "E",
    zoneName: "East (E)",
    direction: "East",
    element: "Air",
    deityZone: "Lord Surya & Indra / Health & Vitality",
    idealUsage: "Dining Room, Bathrooms (bathing), Open Space, Large Windows, Living Room, Study Room",
    weight: 1.0,
    idealKeywords: [
      "dining",
      "dining room",
      "bathroom",
      "bath",
      "open space",
      "living",
      "living room",
      "drawing",
      "study",
      "balcony",
      "verandah",
      "entrance",
    ],
    prohibitedKeywords: [
      "toilet",
      "wc",
      "kitchen",
      "cooking",
      "stove",
      "septic tank",
      "heavy storage",
      "dark store",
      "master bedroom",
    ],
  },
  SE: {
    zoneCode: "SE",
    zoneName: "South-East (SE)",
    direction: "South-East",
    element: "Fire",
    deityZone: "Lord Agni / Digestion, Energy & Cash Flow",
    idealUsage: "Kitchen (cook facing East), Electric Meter, Main Electrical Panel, Inverter, Oil/Fuel Store, Tulsi",
    weight: 1.3,
    idealKeywords: [
      "kitchen",
      "cooking",
      "stove",
      "cooktop",
      "pantry",
      "electrical",
      "inverter",
      "meter",
      "generator",
      "utility",
      "tulsi",
    ],
    prohibitedKeywords: [
      "bedroom",
      "bed",
      "guest",
      "guest bedroom",
      "master",
      "children",
      "underground water tank",
      "sump",
      "well",
      "cellar",
      "water tank",
      "pooja",
      "puja",
      "temple",
      "mandir",
      "toilet",
      "wc",
    ],
  },
  S: {
    zoneCode: "S",
    zoneName: "South (S)",
    direction: "South",
    element: "Fire",
    deityZone: "Lord Yama / Dharma & Stability",
    idealUsage: "Bedroom (head to South), Children's Bedroom, Staircase Block, Store Room, Provision Room",
    weight: 1.0,
    idealKeywords: [
      "bedroom",
      "bed",
      "children",
      "children bedroom",
      "kids",
      "staircase",
      "stairs",
      "store",
      "store room",
      "storage",
      "provision",
      "dressing",
    ],
    prohibitedKeywords: [
      "cellar",
      "well",
      "underground tank",
      "sump",
      "main entrance",
      "pooja",
      "puja",
      "temple",
      "mandir",
      "kitchen",
      "toilet",
    ],
  },
  SW: {
    zoneCode: "SW",
    zoneName: "South-West (SW)",
    direction: "South-West",
    element: "Earth",
    deityZone: "Nairuthi / Heavy Anchoring, Stability & Leadership",
    idealUsage: "Master Bedroom, Wardrobes, Store Room, Heavy Items Storage, Staircase Block, Overhead Water Tank, Cash Box",
    weight: 1.4,
    idealKeywords: [
      "master bedroom",
      "master suite",
      "bedroom",
      "wardrobe",
      "heavy storage",
      "store",
      "store room",
      "storage",
      "boxes",
      "staircase",
      "stairs",
      "overhead water tank",
      "cash box",
      "safe",
      "vault",
    ],
    prohibitedKeywords: [
      "cellar",
      "basement",
      "well",
      "underground water tank",
      "sump",
      "toilet",
      "wc",
      "pooja",
      "puja",
      "temple",
      "mandir",
      "shrine",
      "altar",
      "entrance",
    ],
  },
  W: {
    zoneCode: "W",
    zoneName: "West (W)",
    direction: "West",
    element: "Space",
    deityZone: "Lord Varuna / Gains & Prosperity",
    idealUsage: "Dining Room, Staircase, Store Room, Overhead Water Tank, Children's Bedroom, Study Room, Toilet, Septic Tank",
    weight: 1.0,
    idealKeywords: [
      "dining",
      "dining room",
      "overhead tank",
      "children bedroom",
      "kids bedroom",
      "study",
      "toilet",
      "powder room",
      "wc",
      "septic tank",
      "staircase",
      "stairs",
      "store",
      "store room",
      "storage",
    ],
    prohibitedKeywords: [
      "cellar",
      "basement",
      "main temple",
      "pooja",
      "puja",
      "temple",
      "mandir",
      "kitchen",
    ],
  },
  Center: {
    zoneCode: "Center",
    zoneName: "Center (Brahmasthan)",
    direction: "Center",
    element: "Space",
    deityZone: "Lord Brahma / Cosmic Energy Center",
    idealUsage: "Open Space, Living Room, Central Courtyard, Maximum Natural Light & Ventilation, Tulsi Plant",
    weight: 1.5,
    idealKeywords: [
      "courtyard",
      "open space",
      "passage",
      "hallway",
      "central hall",
      "tulsi",
      "living",
      "living room",
      "atrium",
    ],
    prohibitedKeywords: [
      "toilet",
      "wc",
      "septic tank",
      "heavy pillar",
      "column",
      "kitchen",
      "cooking",
      "underground tank",
      "staircase",
      "bedroom",
    ],
  },
};

/**
 * Normalized directional mapping helper
 */
export function normalizeDirectionCode(rawDir: string): string {
  const d = (rawDir || "").trim().toUpperCase();
  if (d.includes("NORTH-EAST") || d === "NE" || d.includes("NORTHEAST") || d.includes("ESHAN")) return "NE";
  if (d.includes("NORTH-WEST") || d === "NW" || d.includes("NORTHWEST") || d.includes("VAYAVYA")) return "NW";
  if (d.includes("SOUTH-EAST") || d === "SE" || d.includes("SOUTHEAST") || d.includes("AGNI") || d.includes("AGNEYA")) return "SE";
  if (d.includes("SOUTH-WEST") || d === "SW" || d.includes("SOUTHWEST") || d.includes("NAIRUTHI")) return "SW";
  if (d.includes("BRAHMA") || d.includes("CENTER") || d.includes("CENTRAL") || d === "C") return "Center";
  if (d.includes("NORTH") || d === "N") return "N";
  if (d.includes("SOUTH") || d === "S") return "S";
  if (d.includes("EAST") || d === "E") return "E";
  if (d.includes("WEST") || d === "W") return "W";
  return "Center";
}

export interface RoomEvaluationResult {
  roomName: string;
  direction: string;
  zoneCode: string;
  status: "OPTIMAL" | "DEFECT";
  complianceScore: number; // 0 - 100
  doshaSeverity: "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  observations: string;
  remedyRecommendation?: string;
  isSpecificRuleMatched: boolean;
}

/**
 * Guaranteed non-null zone definition lookup
 */
export function getZoneDefinition(rawZoneCode: string): ZoneRuleDefinition {
  const code = normalizeDirectionCode(rawZoneCode);
  return VASTU_9_ZONE_REFERENCE[code] ?? VASTU_9_ZONE_REFERENCE["Center"]!;
}

/**
 * Evaluates a room placement against the authentic 9-Zone Vedic Vastu Reference Architecture.
 * Strictly adheres to binary Compliant ("OPTIMAL") vs Non-Compliant ("DEFECT") evaluation:
 * 1. Toilet in NW is explicitly permitted and COMPLIANT.
 * 2. Store Room in SW or W or S is COMPLIANT.
 * 3. Bedroom in North is strictly avoided (DEFECT / Non-Compliant).
 * 4. Kitchen in North-East is strictly avoided (CRITICAL DEFECT / Non-Compliant).
 * 5. Puja Room in South-West is strictly avoided (CRITICAL DEFECT / Non-Compliant).
 * 6. Guest Bedroom in South-East is avoided (DEFECT / Non-Compliant).
 * 7. NEVER returns "No Specific Rule" or "NEEDS_REVIEW".
 */
export function evaluateRoomPlacement(
  rawRoomName: string,
  rawDirection: string
): RoomEvaluationResult {
  const roomName = (rawRoomName || "").trim();
  const roomLower = roomName.toLowerCase();
  const zoneCode = normalizeDirectionCode(rawDirection);
  const zoneDef = getZoneDefinition(zoneCode);

  // 1. Check for explicit TOILET in NW -> Explicitly permitted by reference (COMPLIANT)
  if (
    zoneCode === "NW" &&
    (roomLower.includes("toilet") || roomLower.includes("wc") || roomLower.includes("powder") || roomLower.includes("washroom"))
  ) {
    return {
      roomName,
      direction: zoneDef.direction,
      zoneCode,
      status: "OPTIMAL",
      complianceScore: 92,
      doshaSeverity: "NONE",
      observations: `${roomName} located in North-West (Vayavya). This is an auspicious, explicitly compliant Vedic placement for toilets and washrooms.`,
      isSpecificRuleMatched: true,
    };
  }

  // 2. Check for explicit PROHIBITED placements (Confirmed DEFECTS)
  const isProhibited = zoneDef.prohibitedKeywords.some((kw) => roomLower.includes(kw));
  if (isProhibited) {
    const isCritical =
      (zoneCode === "NE" && (roomLower.includes("toilet") || roomLower.includes("kitchen") || roomLower.includes("stove") || roomLower.includes("septic"))) ||
      (zoneCode === "SW" && (roomLower.includes("puja") || roomLower.includes("pooja") || roomLower.includes("temple") || roomLower.includes("mandir") || roomLower.includes("toilet") || roomLower.includes("underground") || roomLower.includes("sump"))) ||
      (zoneCode === "Center" && (roomLower.includes("toilet") || roomLower.includes("pillar") || roomLower.includes("kitchen"))) ||
      (zoneCode === "N" && (roomLower.includes("bedroom") || roomLower.includes("bed") || roomLower.includes("toilet")));

    const severity = isCritical ? "CRITICAL" : "HIGH";
    const score = isCritical ? (zoneCode === "SW" && (roomLower.includes("puja") || roomLower.includes("pooja")) ? 25 : 30) : 40;

    let remedy = "Implement non-demolition elemental boundary strip (copper/brass) and energetic cures.";
    if (zoneCode === "N" && (roomLower.includes("bedroom") || roomLower.includes("bed"))) {
      remedy = "Master Bedroom must ideally be in South-West. If placed in North, keep the head strictly towards South or East, use light blue or green tones, and install a lead energy helix to ground Kubera energy.";
    } else if (zoneCode === "NE" && (roomLower.includes("kitchen") || roomLower.includes("stove"))) {
      remedy = "Kitchen in North-East clashes with water energy. Install a green jade/marble slab beneath the stove and install a copper energy strip to suppress Agni-Jala conflict.";
    } else if (zoneCode === "SW" && (roomLower.includes("puja") || roomLower.includes("temple") || roomLower.includes("mandir"))) {
      remedy = "Puja Room in South-West creates heavy energetic disharmony. Relocate sacred altar to North-East. If immovable, elevate the deity on a pristine yellow/white marble pedestal with brass pyramidal shielding.";
    } else if (zoneCode === "SE" && (roomLower.includes("bedroom") || roomLower.includes("bed"))) {
      remedy = "Bedroom in South-East causes sleep restlessness due to fire dominance. Use cooling pastel green or ivory wall tones, avoid mirrors opposite the bed, and install a zinc helix in the corner.";
    } else if (roomLower.includes("toilet")) {
      remedy = "Apply a 3-metal zinc or brass energy boundary strip around the perimeter. Keep the door closed and use rock salt bowls.";
    }

    let specificConflictNote = `${roomName} in ${zoneDef.zoneName} is non-compliant with authentic Vedic principles.`;
    if (zoneCode === "N" && (roomLower.includes("bedroom") || roomLower.includes("bed"))) {
      specificConflictNote = `${roomName} in North conflicts with Vedic rules. Vastu strictly advises avoiding bedrooms in the North (Kubera water quadrant), which disrupts restorative sleep and energy balance. Master Bedroom belongs in South-West.`;
    } else if (zoneCode === "NE" && (roomLower.includes("kitchen") || roomLower.includes("stove"))) {
      specificConflictNote = `${roomName} in North-East (Eshan) creates a severe Agni-Jala (Fire vs Water) conflict. Vastu strictly prohibits cooking areas in the sacred North-East quadrant, impacting peace and prosperity. Kitchen belongs in South-East.`;
    } else if (zoneCode === "SW" && (roomLower.includes("puja") || roomLower.includes("temple") || roomLower.includes("mandir"))) {
      specificConflictNote = `${roomName} in South-West (Nairuthi) is a critical Vastu dosha. Sacred spiritual shrines must never be placed in the heavy Earth quadrant. Puja Room belongs in North-East.`;
    } else if (zoneCode === "SE" && (roomLower.includes("bedroom") || roomLower.includes("bed"))) {
      specificConflictNote = `${roomName} in South-East (Agni) conflicts with Vastu rules. Sleeping in the fire quadrant creates restlessness and health disharmony. South-East is strictly reserved for Kitchen and electricals.`;
    }

    return {
      roomName,
      direction: zoneDef.direction,
      zoneCode,
      status: "DEFECT",
      complianceScore: score,
      doshaSeverity: severity,
      observations: specificConflictNote,
      remedyRecommendation: remedy,
      isSpecificRuleMatched: true,
    };
  }

  // 3. Check for explicit IDEAL placements (COMPLIANT / OPTIMAL)
  const isIdeal = zoneDef.idealKeywords.some((kw) => roomLower.includes(kw));
  if (isIdeal) {
    return {
      roomName,
      direction: zoneDef.direction,
      zoneCode,
      status: "OPTIMAL",
      complianceScore: 92,
      doshaSeverity: "NONE",
      observations: `${roomName} aligns harmoniously with ${zoneDef.zoneName} (${zoneDef.element} Element). Governed by ${zoneDef.deityZone}, providing auspicious Vastu compliance.`,
      isSpecificRuleMatched: true,
    };
  }

  // 4. Default: If a room is not an ideal placement for this zone, it is classified as Non-Compliant (DEFECT)
  return {
    roomName,
    direction: zoneDef.direction,
    zoneCode,
    status: "DEFECT",
    complianceScore: 48,
    doshaSeverity: "MODERATE",
    observations: `${roomName} in ${zoneDef.zoneName} does not align with recommended Vedic placements. This zone is ideally governed by ${zoneDef.deityZone} for ${zoneDef.idealUsage}.`,
    remedyRecommendation: `Apply non-demolition elemental color balancing and directional energy harmonizers in ${zoneDef.zoneName}.`,
    isSpecificRuleMatched: true,
  };
}

/**
 * Calculates deterministic overall compliance score from actual room placements using documented formula:
 * OverallScore = round( Sum( RoomScore_i * ZoneWeight_i ) / Sum( ZoneWeight_i ) )
 */
export function calculateDocumentedScore(evaluations: RoomEvaluationResult[]): number {
  if (!evaluations || evaluations.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const ev of evaluations) {
    const zoneDef = getZoneDefinition(ev.zoneCode);
    const w = zoneDef.weight || 1.0;
    totalWeightedScore += ev.complianceScore * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return 75;
  return Math.min(100, Math.max(10, Math.round(totalWeightedScore / totalWeight)));
}

/**
 * Calculates validated Pancha Tattva (5 Elements) balance percentages
 * based on actual evaluated zone scores.
 * Formula:
 * - Water: NE (60%) + N (40%)
 * - Air: NW (60%) + E (40%)
 * - Fire: SE (70%) + S (30%)
 * - Earth: SW (100%)
 * - Space: Center (70%) + W (30%)
 */
export function calculatePanchaTattva(
  zoneMap: Map<string, number>
): { water: number; air: number; fire: number; earth: number; space: number } | undefined {
  const getScore = (code: string) => zoneMap.get(code) ?? 75;

  const water = Math.round(getScore("NE") * 0.6 + getScore("N") * 0.4);
  const air = Math.round(getScore("NW") * 0.6 + getScore("E") * 0.4);
  const fire = Math.round(getScore("SE") * 0.7 + getScore("S") * 0.3);
  const earth = Math.round(getScore("SW") * 1.0);
  const space = Math.round(getScore("Center") * 0.7 + getScore("W") * 0.3);

  return { water, air, fire, earth, space };
}

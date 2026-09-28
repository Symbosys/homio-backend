import { ENV } from "../../config/env.js";

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  lat?: number | null;
  lng?: number | null;
}

export interface GeocodeResult {
  formattedAddress: string;
  siteName?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  lat: number;
  lng: number;
}

/**
 * Service handling Ola Maps Places, Geocoding, and Reverse Geocoding integrations.
 * Decouples external API communication and keeps raw API credentials protected on the backend.
 */
class MapsService {
  private readonly baseUrl = "https://api.olamaps.io/places/v1";

  /**
   * Fetch place predictions for a given search query using Ola Maps Places Autocomplete API.
   *
   * @param query Search query string (e.g. site name, apartment name, street)
   * @returns Array of structured place predictions with coordinates if available
   */
  async autocompletePlaces(query: string): Promise<PlacePrediction[]> {
    if (!query || !query.trim()) {
      return [];
    }

    const apiKey = ENV.OLA_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("[MapsService] OLA_MAPS_API_KEY is not configured.");
      return [];
    }

    try {
      const url = `${this.baseUrl}/autocomplete?input=${encodeURIComponent(
        query.trim()
      )}&api_key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[MapsService] Ola Maps Autocomplete error (${res.status}):`, errText);
        return [];
      }

      const json = (await res.json()) as any;
      const predictions = json?.predictions || [];

      return predictions.map((p: any) => {
        const lat =
          p.geometry?.location?.lat ??
          p.location?.lat ??
          p.geometry?.lat ??
          (typeof p.lat === "number" ? p.lat : null);
        const lng =
          p.geometry?.location?.lng ??
          p.location?.lng ??
          p.geometry?.lng ??
          (typeof p.lng === "number" ? p.lng : null);

        return {
          placeId: p.place_id || p.id || String(Math.random()),
          description: p.description || p.formatted_address || query,
          mainText: p.structured_formatting?.main_text || p.name || p.description || query,
          secondaryText: p.structured_formatting?.secondary_text || "",
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
        };
      });
    } catch (error) {
      console.error("[MapsService] Failed to autocomplete places:", error);
      return [];
    }
  }

  /**
   * Geocode a text address into GPS latitude and longitude using Ola Maps Geocoding API.
   *
   * @param address Full address query string
   * @returns Structured geocoded location with parsed address components
   */
  async geocodeAddress(address: string): Promise<GeocodeResult | null> {
    if (!address || !address.trim()) {
      return null;
    }

    const apiKey = ENV.OLA_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("[MapsService] OLA_MAPS_API_KEY is not configured.");
      return null;
    }

    try {
      const url = `${this.baseUrl}/geocode?address=${encodeURIComponent(
        address.trim()
      )}&api_key=${encodeURIComponent(apiKey)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[MapsService] Ola Maps Geocode error (${res.status}):`, errText);
        return null;
      }

      const json = (await res.json()) as any;
      const results = json?.results || json?.geocodingResults || json?.data || [];
      if (!results || results.length === 0) {
        return null;
      }

      const first = results[0];
      const lat =
        first.geometry?.location?.lat ??
        first.location?.lat ??
        first.geometry?.lat ??
        (typeof first.lat === "number" ? first.lat : null);
      const lng =
        first.geometry?.location?.lng ??
        first.location?.lng ??
        first.geometry?.lng ??
        (typeof first.lng === "number" ? first.lng : null);

      if (typeof lat !== "number" || typeof lng !== "number") {
        return null;
      }

      return this.parseAddressComponents(first, lat, lng);
    } catch (error) {
      console.error("[MapsService] Failed to geocode address:", error);
      return null;
    }
  }

  /**
   * Reverse-geocode latitude and longitude coordinates into human-readable address components.
   *
   * @param lat Latitude coordinate
   * @param lng Longitude coordinate
   * @returns Structured location with street address, city, state, and pincode
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
      return null;
    }

    const apiKey = ENV.OLA_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("[MapsService] OLA_MAPS_API_KEY is not configured.");
      return null;
    }

    try {
      const url = `${this.baseUrl}/reverse-geocode?latlng=${lat},${lng}&api_key=${encodeURIComponent(
        apiKey
      )}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[MapsService] Ola Maps Reverse Geocode error (${res.status}):`, errText);
        return null;
      }

      const json = (await res.json()) as any;
      const results = json?.results || [];
      if (!results || results.length === 0) {
        return null;
      }

      const first = results[0];
      return this.parseAddressComponents(first, lat, lng);
    } catch (error) {
      console.error("[MapsService] Failed to reverse-geocode coordinates:", error);
      return null;
    }
  }

  /**
   * Helper function to extract standard address components from Ola Maps result objects.
   */
  private parseAddressComponents(rawResult: any, lat: number, lng: number): GeocodeResult {
    const formattedAddress = rawResult.formatted_address || rawResult.name || "";
    const components = rawResult.address_components || [];

    let city: string | null = null;
    let state: string | null = null;
    let country: string | null = "India";
    let pincode: string | null = null;
    let streetAddress: string | null = null;
    let siteName: string | null = rawResult.name || null;

    for (const comp of components) {
      const types = comp.types || [];
      if (types.includes("locality") || types.includes("administrative_area_level_2") || types.includes("city")) {
        city = comp.long_name || comp.short_name;
      }
      if (types.includes("administrative_area_level_1") || types.includes("state")) {
        state = comp.long_name || comp.short_name;
      }
      if (types.includes("country")) {
        country = comp.long_name || comp.short_name;
      }
      if (types.includes("postal_code") || types.includes("pincode")) {
        pincode = comp.long_name || comp.short_name;
      }
      if (types.includes("route") || types.includes("sublocality") || types.includes("street_address")) {
        if (!streetAddress) {
          streetAddress = comp.long_name || comp.short_name;
        }
      }
    }

    return {
      formattedAddress,
      siteName: siteName || (formattedAddress.split(",")[0] || "").trim(),
      address: streetAddress || formattedAddress,
      city: city || "Bangalore",
      state: state || "Karnataka",
      country: country || "India",
      pincode: pincode || "",
      lat,
      lng,
    };
  }
}

export const mapsService = new MapsService();

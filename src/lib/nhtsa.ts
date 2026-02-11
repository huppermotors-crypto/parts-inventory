import { NHTSADecodeResult } from "@/types/database";

const NHTSA_API_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

export async function decodeVIN(vin: string): Promise<NHTSADecodeResult> {
  const response = await fetch(
    `${NHTSA_API_BASE}/DecodeVinValues/${vin}?format=json`
  );

  if (!response.ok) {
    throw new Error("Failed to decode VIN");
  }

  const data: { Results: Array<Record<string, string>> } =
    await response.json();

  if (!data.Results || data.Results.length === 0) {
    throw new Error("No results found for this VIN");
  }

  const result = data.Results[0];

  return {
    year: result.ModelYear ? parseInt(result.ModelYear, 10) : null,
    make: result.Make || null,
    model: result.Model || null,
  };
}

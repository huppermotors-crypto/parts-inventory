import { NHTSADecodeResult, NHTSAFullDecodeResult } from "@/types/database";
import { normalizeMakeModel } from "@/lib/utils";

const NHTSA_API_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles";

async function fetchNHTSA(vin: string): Promise<Record<string, string>> {
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

  return data.Results[0];
}

export async function decodeVIN(vin: string): Promise<NHTSADecodeResult> {
  const result = await fetchNHTSA(vin);

  return {
    year: result.ModelYear ? parseInt(result.ModelYear, 10) : null,
    make: result.Make ? normalizeMakeModel(result.Make) : null,
    model: result.Model ? normalizeMakeModel(result.Model) : null,
  };
}

export async function decodeVINFull(vin: string): Promise<NHTSAFullDecodeResult> {
  const result = await fetchNHTSA(vin);

  const displacementL = result.DisplacementL ? `${parseFloat(result.DisplacementL).toFixed(1)}L` : null;

  return {
    year: result.ModelYear ? parseInt(result.ModelYear, 10) : null,
    make: result.Make ? normalizeMakeModel(result.Make) : null,
    model: result.Model ? normalizeMakeModel(result.Model) : null,
    body_class: result.BodyClass || null,
    engine_displacement: displacementL,
    engine_cylinders: result.EngineCylinders ? parseInt(result.EngineCylinders, 10) : null,
    engine_hp: result.EngineHP || null,
    engine_turbo: result.Turbo === "Yes",
    drive_type: result.DriveType || null,
    fuel_type: result.FuelTypePrimary || null,
  };
}

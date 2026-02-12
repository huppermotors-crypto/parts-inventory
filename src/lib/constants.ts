export const PART_CATEGORIES = [
  { value: "airbags", label: "Airbags" },
  { value: "wheels_tires", label: "Wheels & Tires" },
  { value: "radiator_cooling", label: "Radiator & Cooling" },
  { value: "engine", label: "Engine" },
  { value: "transmission", label: "Transmission" },
  { value: "brakes", label: "Brakes" },
  { value: "suspension", label: "Suspension" },
  { value: "exhaust", label: "Exhaust" },
  { value: "electrical", label: "Electrical" },
  { value: "lighting", label: "Lighting" },
  { value: "body_panels", label: "Body Panels" },
  { value: "bumpers", label: "Bumpers" },
  { value: "mirrors", label: "Mirrors" },
  { value: "glass", label: "Glass" },
  { value: "interior", label: "Interior" },
  { value: "seats", label: "Seats" },
  { value: "steering", label: "Steering" },
  { value: "fuel_system", label: "Fuel System" },
  { value: "ac_heating", label: "A/C & Heating" },
  { value: "electronics_ecu", label: "ECU & Electronics" },
  { value: "sensors", label: "Sensors" },
  { value: "other", label: "Other" },
] as const;

export const PART_CONDITIONS = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "used", label: "Used" },
  { value: "for_parts", label: "For Parts" },
] as const;

export function getCategoryLabel(value: string): string {
  const cat = PART_CATEGORIES.find((c) => c.value === value);
  return cat ? cat.label : value;
}

export function getConditionLabel(value: string): string {
  const cond = PART_CONDITIONS.find((c) => c.value === value);
  return cond ? cond.label : value;
}

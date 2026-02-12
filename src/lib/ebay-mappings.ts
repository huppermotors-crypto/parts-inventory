// Map internal categories to eBay Motors Parts & Accessories category IDs
export const CATEGORY_TO_EBAY: Record<string, string> = {
  airbags: "33646",
  wheels_tires: "179680",
  radiator_cooling: "42613",
  engine: "33615",
  transmission: "33726",
  brakes: "33559",
  suspension: "33580",
  exhaust: "33605",
  electrical: "33598",
  lighting: "33707",
  body_panels: "174108",
  bumpers: "33640",
  mirrors: "33649",
  glass: "33638",
  interior: "33694",
  seats: "33695",
  steering: "33580",
  fuel_system: "33612",
  ac_heating: "33554",
  electronics_ecu: "33596",
  sensors: "33596",
  other: "174116",
};

// Map internal conditions to eBay condition IDs
// eBay Motors Parts: 1000=New, 1500=New Other, 3000=Used, 7000=For parts/not working
export const CONDITION_TO_EBAY: Record<
  string,
  { id: string; description: string }
> = {
  new: { id: "1000", description: "Brand new, never installed" },
  like_new: { id: "1500", description: "Like new, barely used" },
  excellent: {
    id: "3000",
    description: "Used - excellent condition, fully functional",
  },
  good: { id: "3000", description: "Used - good condition, fully functional" },
  fair: {
    id: "3000",
    description: "Used - fair condition, functional with cosmetic wear",
  },
  used: { id: "3000", description: "Used - functional condition" },
  for_parts: { id: "7000", description: "For parts or not working" },
};

export function getEbayCategoryId(category: string): string {
  return CATEGORY_TO_EBAY[category] || CATEGORY_TO_EBAY["other"];
}

export function getEbayCondition(
  condition: string
): { id: string; description: string } {
  return CONDITION_TO_EBAY[condition] || CONDITION_TO_EBAY["used"];
}

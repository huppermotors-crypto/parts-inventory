export interface EbaySearchResult {
  title: string;
  price: number | null;
  currency: string;
  condition: string;
  image: string | null;
  itemWebUrl: string;
  itemId: string;
}

export interface EbaySearchResponse {
  items: EbaySearchResult[];
  total: number;
}

export function buildEbaySearchQuery(part: {
  name: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
}): string {
  const terms = [part.year, part.make, part.model, part.name].filter(Boolean);
  return terms.join(" ");
}

export async function searchEbayPrices(
  query: string,
  limit: number = 8
): Promise<EbaySearchResponse> {
  const params = new URLSearchParams({ q: query, limit: limit.toString() });
  const response = await fetch(`/api/ebay/search?${params}`);

  if (!response.ok) {
    throw new Error("Failed to search eBay");
  }

  return response.json();
}

export interface Part {
  id: string;
  created_at: string;
  updated_at: string;
  stock_number: string | null;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  name: string;
  description: string | null;
  serial_number: string | null;
  price: number;
  condition: string;
  category: string;
  photos: string[];
  is_published: boolean;
  is_sold: boolean;
  ebay_listing_id: string | null;
  ebay_offer_id: string | null;
  ebay_listing_url: string | null;
  ebay_listed_at: string | null;
}

export type PartInsert = Omit<Part, "id" | "created_at" | "updated_at" | "stock_number" | "ebay_listing_id" | "ebay_offer_id" | "ebay_listing_url" | "ebay_listed_at">;
export type PartUpdate = Partial<PartInsert>;

export interface NHTSADecodeResult {
  year: number | null;
  make: string | null;
  model: string | null;
}

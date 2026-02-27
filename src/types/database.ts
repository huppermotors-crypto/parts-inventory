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
  quantity: number;
  price_per: "lot" | "item";
  photos: string[];
  is_published: boolean;
  is_sold: boolean;
  sold_price: number | null;
  sold_at: string | null;
  fb_posted_at: string | null;
  ebay_listing_id: string | null;
  ebay_offer_id: string | null;
  ebay_listing_url: string | null;
  ebay_listed_at: string | null;
}

export type PartInsert = Omit<Part, "id" | "created_at" | "updated_at" | "stock_number" | "fb_posted_at" | "ebay_listing_id" | "ebay_offer_id" | "ebay_listing_url" | "ebay_listed_at">;
export type PartUpdate = Partial<PartInsert>;

export interface PriceRule {
  id: string;
  type: "discount" | "markup";
  scope: "all" | "make" | "model" | "vin" | "part";
  scope_value: string | null;
  amount: number;
  amount_type: "percent" | "fixed";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NHTSADecodeResult {
  year: number | null;
  make: string | null;
  model: string | null;
}

export interface NHTSAFullDecodeResult extends NHTSADecodeResult {
  body_class: string | null;
  engine_displacement: string | null;
  engine_cylinders: number | null;
  engine_hp: string | null;
  engine_turbo: boolean;
  drive_type: string | null;
  fuel_type: string | null;
}

export interface Vehicle {
  id: string;
  created_at: string;
  updated_at: string;
  vin: string;
  year: number | null;
  make: string | null;
  model: string | null;
  body_class: string | null;
  engine_displacement: string | null;
  engine_cylinders: number | null;
  engine_hp: string | null;
  engine_turbo: boolean;
  drive_type: string | null;
  fuel_type: string | null;
  purchase_price: number | null;
  notes: string | null;
  photos: string[];
}

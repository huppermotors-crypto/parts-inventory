export interface Part {
  id: string;
  created_at: string;
  updated_at: string;
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
}

export type PartInsert = Omit<Part, "id" | "created_at" | "updated_at">;
export type PartUpdate = Partial<PartInsert>;

export interface NHTSADecodeResult {
  year: number | null;
  make: string | null;
  model: string | null;
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const conditionColors: Record<string, string> = {
  new: "bg-green-100 text-green-800",
  like_new: "bg-emerald-100 text-emerald-800",
  excellent: "bg-blue-100 text-blue-800",
  good: "bg-sky-100 text-sky-800",
  fair: "bg-yellow-100 text-yellow-800",
  used: "bg-orange-100 text-orange-800",
  for_parts: "bg-red-100 text-red-800",
};

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function formatVehicle(
  year: number | string | null | undefined,
  make: string | null | undefined,
  model: string | null | undefined,
): string {
  return [year, make, model].filter(Boolean).join(" ");
}

/**
 * Calculate lot price: the total price for the whole lot.
 * price_per = "lot"  → lot_price = price (already total)
 * price_per = "item" → lot_price = price × quantity
 */
export function getLotPrice(price: number, quantity: number, pricePer: "lot" | "item"): number {
  if (pricePer === "item") return price * quantity;
  return price;
}

/**
 * Calculate per-item price.
 * price_per = "lot"  → item_price = price / quantity
 * price_per = "item" → item_price = price
 */
export function getItemPrice(price: number, quantity: number, pricePer: "lot" | "item"): number {
  if (pricePer === "lot" && quantity > 1) return price / quantity;
  return price;
}

/**
 * Normalize make/model to consistent Title Case.
 * "FORD" → "Ford", "BMW" → "BMW", "CADILLAC" → "Cadillac"
 * Short all-caps words (≤3 chars) stay uppercase (BMW, GMC, etc.)
 */
export function normalizeMakeModel(value: string): string {
  if (!value) return value;
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      // Short all-caps abbreviations stay as-is: BMW, GMC, AMG
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      // Everything else → Title Case
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

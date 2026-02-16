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
      if (word.length <= 3 && word === word.toUpperCase()) return word;
      if (word === word.toUpperCase()) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word;
    })
    .join(" ");
}

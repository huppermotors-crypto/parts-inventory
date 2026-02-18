import { Part, PriceRule } from "@/types/database";

export interface PriceResult {
  originalPrice: number;
  finalPrice: number;
  hasDiscount: boolean;
  hasMarkup: boolean;
  appliedRule: PriceRule | null;
}

/**
 * Apply price rules to a part. Priority: VIN > model > make > all.
 * Only the most specific matching active rule applies.
 */
export function applyPriceRules(part: Part, rules: PriceRule[]): PriceResult {
  const activeRules = rules.filter((r) => r.is_active);

  const scopePriority: Record<string, number> = { vin: 4, model: 3, make: 2, all: 1 };

  const matching = activeRules.filter((rule) => {
    switch (rule.scope) {
      case "all":
        return true;
      case "make":
        return (
          part.make &&
          rule.scope_value &&
          part.make.toLowerCase() === rule.scope_value.toLowerCase()
        );
      case "model":
        return (
          part.model &&
          rule.scope_value &&
          part.model.toLowerCase() === rule.scope_value.toLowerCase()
        );
      case "vin":
        return (
          part.vin &&
          rule.scope_value &&
          part.vin.toLowerCase() === rule.scope_value.toLowerCase()
        );
      default:
        return false;
    }
  });

  if (matching.length === 0) {
    return {
      originalPrice: part.price,
      finalPrice: part.price,
      hasDiscount: false,
      hasMarkup: false,
      appliedRule: null,
    };
  }

  matching.sort((a, b) => scopePriority[b.scope] - scopePriority[a.scope]);
  const rule = matching[0];

  let adjustment = 0;
  if (rule.amount_type === "percent") {
    adjustment = part.price * (rule.amount / 100);
  } else {
    adjustment = rule.amount;
  }

  const finalPrice =
    rule.type === "discount"
      ? Math.max(0, part.price - adjustment)
      : part.price + adjustment;

  return {
    originalPrice: part.price,
    finalPrice: Math.round(finalPrice * 100) / 100,
    hasDiscount: rule.type === "discount",
    hasMarkup: rule.type === "markup",
    appliedRule: rule,
  };
}

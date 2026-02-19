import { memo } from "react";
import { Part, PriceRule } from "@/types/database";
import { getCategoryLabel, getConditionLabel } from "@/lib/constants";
import { conditionColors, formatPrice, formatVehicle } from "@/lib/utils";
import { applyPriceRules } from "@/lib/price-rules";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PartCardProps {
  part: Part;
  priceRules?: PriceRule[];
  compact?: boolean;
}

export const PartCard = memo(function PartCard({ part, priceRules, compact }: PartCardProps) {
  const vehicle = formatVehicle(part.year, part.make, part.model);
  const qty = part.quantity || 1;
  // Apply price rules to part.price directly (the entered price, whether per item or per lot)
  const pr = priceRules && priceRules.length > 0 ? applyPriceRules(part, priceRules) : null;
  const displayPrice = pr && (pr.hasDiscount || pr.hasMarkup) ? pr.finalPrice : part.price;

  return (
    <Link href={`/parts/${part.id}`}>
      <Card className="overflow-hidden group hover:shadow-lg transition-shadow h-full">
        <div className={`${compact ? "aspect-square" : "aspect-[4/3]"} relative bg-muted`}>
          {part.photos && part.photos.length > 0 ? (
            <Image
              src={part.photos[0]}
              alt={part.name}
              fill
              sizes={compact ? "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"}
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className={`${compact ? "h-8 w-8" : "h-12 w-12"} text-muted-foreground/50`} />
            </div>
          )}
          {!compact && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs bg-white/90 text-black shadow-sm">
                {getCategoryLabel(part.category).split(" / ")[0]}
              </Badge>
            </div>
          )}
          {part.photos && part.photos.length > 1 && (
            <div className={`absolute ${compact ? "bottom-1 right-1" : "bottom-2 right-2"}`}>
              <Badge variant="secondary" className={`${compact ? "text-[10px] px-1.5 py-0" : "text-xs"} bg-black/60 text-white border-0`}>
                {part.photos.length}
              </Badge>
            </div>
          )}
        </div>
        <CardContent className={compact ? "p-2 space-y-1" : "p-4 space-y-2"}>
          <h3 className={`font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors ${compact ? "text-xs" : "text-base"}`}>
            {part.name}
          </h3>
          {vehicle && !compact && (
            <p className="text-sm text-muted-foreground">{vehicle}</p>
          )}
          <div className={`flex items-center justify-between ${compact ? "" : "pt-1"}`}>
            <div>
              <div className="flex items-center gap-1">
                {pr && pr.hasDiscount ? (
                  <>
                    <span className={`font-bold text-red-600 ${compact ? "text-sm" : "text-lg"}`}>{formatPrice(pr.finalPrice)}</span>
                    {!compact && <span className="text-sm text-muted-foreground line-through">{formatPrice(part.price)}</span>}
                  </>
                ) : (
                  <span className={`font-bold ${compact ? "text-sm" : "text-lg"}`}>{formatPrice(displayPrice)}</span>
                )}
              </div>
              {qty > 1 && (
                <p className={`text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
                  Lot of {qty}
                </p>
              )}
            </div>
            {!compact && (
              <Badge
                variant="secondary"
                className={`text-xs ${conditionColors[part.condition] || ""}`}
              >
                {getConditionLabel(part.condition)}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});

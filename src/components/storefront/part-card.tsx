import { memo } from "react";
import { Part, PriceRule } from "@/types/database";
import { getCategoryLabel, getConditionLabel } from "@/lib/constants";
import { conditionColors, formatPrice, formatVehicle, getLotPrice, getItemPrice } from "@/lib/utils";
import { applyPriceRules } from "@/lib/price-rules";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface PartCardProps {
  part: Part;
  priceRules?: PriceRule[];
}

export const PartCard = memo(function PartCard({ part, priceRules }: PartCardProps) {
  const vehicle = formatVehicle(part.year, part.make, part.model);

  return (
    <Link href={`/parts/${part.id}`}>
      <Card className="overflow-hidden group hover:shadow-lg transition-shadow h-full">
        <div className="aspect-[4/3] relative bg-muted">
          {part.photos && part.photos.length > 0 ? (
            <Image
              src={part.photos[0]}
              alt={part.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
          )}
          {/* Category badge */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs bg-white/90 text-black shadow-sm">
              {getCategoryLabel(part.category).split(" / ")[0]}
            </Badge>
          </div>
          {/* Photo count */}
          {part.photos && part.photos.length > 1 && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="secondary" className="text-xs bg-black/60 text-white border-0">
                {part.photos.length} photos
              </Badge>
            </div>
          )}
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {part.name}
          </h3>
          {vehicle && (
            <p className="text-sm text-muted-foreground">{vehicle}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            {(() => {
              const qty = part.quantity || 1;
              const pp = part.price_per || "lot";
              const lotPrice = getLotPrice(part.price, qty, pp);
              const itemPrice = getItemPrice(part.price, qty, pp);
              const pr = priceRules && priceRules.length > 0 ? applyPriceRules({ ...part, price: lotPrice }, priceRules) : null;
              const displayPrice = pr && (pr.hasDiscount || pr.hasMarkup) ? pr.finalPrice : lotPrice;

              return (
                <div>
                  <div className="flex items-center gap-2">
                    {pr && pr.hasDiscount ? (
                      <>
                        <span className="text-lg font-bold text-red-600">{formatPrice(pr.finalPrice)}</span>
                        <span className="text-sm text-muted-foreground line-through">{formatPrice(lotPrice)}</span>
                      </>
                    ) : (
                      <span className="text-lg font-bold">{formatPrice(displayPrice)}</span>
                    )}
                  </div>
                  {qty > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Lot of {qty} · {formatPrice(pr && pr.hasDiscount ? pr.finalPrice / qty : itemPrice)}/ea
                    </p>
                  )}
                </div>
              );
            })()}
            <Badge
              variant="secondary"
              className={`text-xs ${conditionColors[part.condition] || ""}`}
            >
              {getConditionLabel(part.condition)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
});

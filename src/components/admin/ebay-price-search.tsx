"use client";

import { useState, useCallback } from "react";
import {
  searchEbayPrices,
  buildEbaySearchQuery,
  EbaySearchResult,
} from "@/lib/ebay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  ExternalLink,
  TrendingUp,
  DollarSign,
} from "lucide-react";

interface EbayPriceSearchProps {
  partName: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  onPriceSelect?: (price: number) => void;
}

export function EbayPriceSearch({
  partName,
  make,
  model,
  year,
  onPriceSelect,
}: EbayPriceSearchProps) {
  const [results, setResults] = useState<EbaySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [customQuery, setCustomQuery] = useState("");
  const [minPriceInput, setMinPriceInput] = useState("50");
  const [error, setError] = useState<string | null>(null);

  const autoQuery = buildEbaySearchQuery({ name: partName, make, model, year });

  const handleSearch = useCallback(
    async (query?: string) => {
      const q = query || customQuery || autoQuery;
      if (!q.trim()) return;

      setLoading(true);
      setError(null);
      setSearched(true);

      try {
        const minPrice = parseFloat(minPriceInput) || 0;
        const data = await searchEbayPrices(q, { minPrice });
        setResults(data.items);
      } catch {
        setError("Could not fetch eBay prices. Try again.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [customQuery, autoQuery, minPriceInput]
  );

  const prices = results
    .filter((r) => r.price !== null)
    .map((r) => r.price!);
  const avgPrice =
    prices.length > 0
      ? prices.reduce((a, b) => a + b, 0) / prices.length
      : null;
  const lowPrice = prices.length > 0 ? Math.min(...prices) : null;
  const highPrice = prices.length > 0 ? Math.max(...prices) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          eBay Price Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={autoQuery || "Search eBay..."}
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            className="flex-1"
          />
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Min $</span>
            <Input
              type="number"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              className="w-20"
              min={0}
              step={10}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleSearch()}
            disabled={loading || (!customQuery && !autoQuery)}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </div>

        {!searched && autoQuery && (
          <p className="text-xs text-muted-foreground">
            Will search: &quot;{autoQuery}&quot;
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {prices.length > 0 && (
          <div className="flex gap-3 text-sm flex-wrap">
            <Badge variant="outline" className="gap-1">
              <DollarSign className="h-3 w-3" />
              Avg: ${avgPrice!.toFixed(0)}
            </Badge>
            <Badge variant="outline">Low: ${lowPrice!.toFixed(0)}</Badge>
            <Badge variant="outline">High: ${highPrice!.toFixed(0)}</Badge>
          </div>
        )}

        {searched && results.length === 0 && !loading && !error && (
          <p className="text-sm text-muted-foreground">
            No results found on eBay. Try a lower min price or different search.
          </p>
        )}

        {results.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {results.map((item) => (
              <div
                key={item.itemId}
                className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                {item.image && (
                  <div className="relative h-12 w-12 rounded overflow-hidden shrink-0 bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.condition}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">
                    {item.price !== null ? `$${item.price.toFixed(0)}` : "N/A"}
                  </span>
                  {onPriceSelect && item.price !== null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onPriceSelect(item.price!)}
                    >
                      Use
                    </Button>
                  )}
                  <a
                    href={item.itemWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

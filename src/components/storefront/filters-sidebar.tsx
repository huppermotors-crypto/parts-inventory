"use client";

import { PART_CATEGORIES, PART_CONDITIONS, getCategoryLabel, getConditionLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { X, CarFront, Layers, SlidersHorizontal, Shield, DollarSign } from "lucide-react";

interface FiltersSidebarProps {
  makes: string[];
  categories: string[];
  selectedMake: string | null;
  selectedCategory: string | null;
  selectedCondition: string | null;
  priceMin: string;
  priceMax: string;
  onMakeChange: (make: string | null) => void;
  onCategoryChange: (category: string | null) => void;
  onConditionChange: (condition: string | null) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

export function FiltersSidebar({
  makes,
  categories,
  selectedMake,
  selectedCategory,
  selectedCondition,
  priceMin,
  priceMax,
  onMakeChange,
  onCategoryChange,
  onConditionChange,
  onPriceMinChange,
  onPriceMaxChange,
  totalCount,
  filteredCount,
}: FiltersSidebarProps) {
  const hasFilters = selectedMake || selectedCategory || selectedCondition || priceMin || priceMax;

  const clearAll = () => {
    onMakeChange(null);
    onCategoryChange(null);
    onConditionChange(null);
    onPriceMinChange("");
    onPriceMaxChange("");
  };

  return (
    <aside className="space-y-6">
      {/* Active filters */}
      {hasFilters && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <SlidersHorizontal className="h-4 w-4" />
              Active Filters
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={clearAll}
            >
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedMake && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {selectedMake}
                <button
                  onClick={() => onMakeChange(null)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCategory && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {getCategoryLabel(selectedCategory)}
                <button
                  onClick={() => onCategoryChange(null)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {selectedCondition && (
              <Badge variant="secondary" className="gap-1 pr-1">
                {getConditionLabel(selectedCondition)}
                <button
                  onClick={() => onConditionChange(null)}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(priceMin || priceMax) && (
              <Badge variant="secondary" className="gap-1 pr-1">
                ${priceMin || "0"} – ${priceMax || "∞"}
                <button
                  onClick={() => { onPriceMinChange(""); onPriceMaxChange(""); }}
                  className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {filteredCount} of {totalCount} parts
          </p>
          <Separator />
        </div>
      )}

      {/* Makes */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <CarFront className="h-4 w-4" />
          Make
        </h3>
        <div className="space-y-1">
          {makes.map((make) => (
            <button
              key={make}
              onClick={() =>
                onMakeChange(selectedMake === make ? null : make)
              }
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedMake === make
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              {make}
            </button>
          ))}
          {makes.length === 0 && (
            <p className="text-xs text-muted-foreground px-3">No makes available</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Categories */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Layers className="h-4 w-4" />
          Category
        </h3>
        <div className="space-y-1">
          {PART_CATEGORIES.filter((c) => categories.includes(c.value)).map(
            (cat) => (
              <button
                key={cat.value}
                onClick={() =>
                  onCategoryChange(
                    selectedCategory === cat.value ? null : cat.value
                  )
                }
                className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                  selectedCategory === cat.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-foreground"
                }`}
              >
                {cat.label}
              </button>
            )
          )}
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground px-3">
              No categories available
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Condition */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <Shield className="h-4 w-4" />
          Condition
        </h3>
        <div className="space-y-1">
          {PART_CONDITIONS.map((cond) => (
            <button
              key={cond.value}
              onClick={() =>
                onConditionChange(
                  selectedCondition === cond.value ? null : cond.value
                )
              }
              className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                selectedCondition === cond.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              {cond.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price Range */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <DollarSign className="h-4 w-4" />
          Price Range
        </h3>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Min</Label>
            <Input
              type="number"
              placeholder="0"
              value={priceMin}
              onChange={(e) => onPriceMinChange(e.target.value)}
              min={0}
              className="h-8"
            />
          </div>
          <span className="text-muted-foreground mt-4">–</span>
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Max</Label>
            <Input
              type="number"
              placeholder="Any"
              value={priceMax}
              onChange={(e) => onPriceMaxChange(e.target.value)}
              min={0}
              className="h-8"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}

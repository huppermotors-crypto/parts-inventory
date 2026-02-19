"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part, PriceRule } from "@/types/database";
import { applyPriceRules } from "@/lib/price-rules";
import { StorefrontHeader } from "@/components/storefront/header";
import { PartCard } from "@/components/storefront/part-card";
import { FiltersSidebar } from "@/components/storefront/filters-sidebar";
import { getCategoryLabel, getConditionLabel } from "@/lib/constants";
import { conditionColors, formatPrice, formatVehicle, getLotPrice, getItemPrice } from "@/lib/utils";
import { Package, Loader2, SlidersHorizontal, X, ArrowUpDown, LayoutGrid, List, Grid3X3, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type SortOption = "newest" | "price_asc" | "price_desc" | "name_asc";
type ViewMode = "grid" | "compact" | "list";

const PAGE_SIZE = 20;
const supabase = createClient();

export default function StorefrontPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [priceRules, setPriceRules] = useState<PriceRule[]>([]);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const [partsRes, rulesRes] = await Promise.all([
      supabase
        .from("parts")
        .select("id, name, price, quantity, price_per, year, make, model, vin, condition, category, photos, created_at")
        .eq("is_published", true)
        .eq("is_sold", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("price_rules")
        .select("*")
        .eq("is_active", true),
    ]);

    if (partsRes.error) {
      console.error("Error fetching parts:", partsRes.error);
    } else {
      setParts(partsRes.data || []);
    }
    setPriceRules(rulesRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const uniqueMakes = useMemo(() => {
    const makes = parts.map((p) => p.make).filter((m): m is string => !!m);
    // Deduplicate case-insensitively: keep the first-seen casing as canonical
    const seen = new Map<string, string>();
    for (const m of makes) {
      const key = m.toLowerCase().trim();
      if (!seen.has(key)) seen.set(key, m.trim());
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
  }, [parts]);

  const usedCategories = useMemo(() => {
    const cats = parts.map((p) => p.category).filter((c): c is string => !!c);
    return Array.from(new Set(cats)).sort();
  }, [parts]);

  const filteredParts = useMemo(() => {
    const filtered = parts.filter((part) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        part.name.toLowerCase().includes(q) ||
        (part.make && part.make.toLowerCase().includes(q)) ||
        (part.model && part.model.toLowerCase().includes(q)) ||
        (part.description && part.description.toLowerCase().includes(q));

      const matchesMake = !selectedMake || (part.make && part.make.toLowerCase().trim() === selectedMake.toLowerCase().trim());
      const matchesCategory =
        !selectedCategory || part.category === selectedCategory;
      const matchesCondition =
        !selectedCondition || part.condition === selectedCondition;

      const min = priceMin ? parseFloat(priceMin) : null;
      const max = priceMax ? parseFloat(priceMax) : null;
      const matchesPrice =
        (min === null || part.price >= min) &&
        (max === null || part.price <= max);

      return matchesSearch && matchesMake && matchesCategory && matchesCondition && matchesPrice;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return a.price - b.price;
        case "price_desc":
          return b.price - a.price;
        case "name_asc":
          return a.name.localeCompare(b.name);
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return filtered;
  }, [parts, search, selectedMake, selectedCategory, selectedCondition, priceMin, priceMax, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredParts.length / PAGE_SIZE));
  const paginatedParts = filteredParts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedMake, selectedCategory, selectedCondition, priceMin, priceMax, sortBy]);

  const activeFiltersCount =
    (selectedMake ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    (selectedCondition ? 1 : 0) +
    (priceMin || priceMax ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col">
      <StorefrontHeader search={search} onSearchChange={setSearch} />

      <div className="container mx-auto px-4 py-6 flex-1">
        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <div className="hidden lg:block w-64 shrink-0">
            <FiltersSidebar
              makes={uniqueMakes}
              categories={usedCategories}
              selectedMake={selectedMake}
              selectedCategory={selectedCategory}
              selectedCondition={selectedCondition}
              priceMin={priceMin}
              priceMax={priceMax}
              onMakeChange={setSelectedMake}
              onCategoryChange={setSelectedCategory}
              onConditionChange={setSelectedCondition}
              onPriceMinChange={setPriceMin}
              onPriceMaxChange={setPriceMax}
              totalCount={parts.length}
              filteredCount={filteredParts.length}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-4">
            {/* Mobile filter button + sort */}
            <div className="flex items-center justify-between gap-2 lg:hidden">
              <p className="text-sm text-muted-foreground shrink-0">
                {filteredParts.length} part{filteredParts.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-9 text-xs">
                  <ArrowUpDown className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_asc">Price: Low-High</SelectItem>
                  <SelectItem value="price_desc">Price: High-Low</SelectItem>
                  <SelectItem value="name_asc">Name: A-Z</SelectItem>
                </SelectContent>
              </Select>
              <Sheet
                open={mobileFiltersOpen}
                onOpenChange={setMobileFiltersOpen}
              >
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                    {activeFiltersCount > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                        {activeFiltersCount}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <FiltersSidebar
                      makes={uniqueMakes}
                      categories={usedCategories}
                      selectedMake={selectedMake}
                      selectedCategory={selectedCategory}
                      selectedCondition={selectedCondition}
                      priceMin={priceMin}
                      priceMax={priceMax}
                      onMakeChange={setSelectedMake}
                      onCategoryChange={setSelectedCategory}
                      onConditionChange={setSelectedCondition}
                      onPriceMinChange={setPriceMin}
                      onPriceMaxChange={setPriceMax}
                      totalCount={parts.length}
                      filteredCount={filteredParts.length}
                    />
                  </div>
                </SheetContent>
              </Sheet>
              </div>
            </div>

            {/* Results count + sort + view toggle for desktop */}
            <div className="hidden lg:flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredParts.length} part{filteredParts.length !== 1 ? "s" : ""} found
              </p>
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[180px] h-9">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="price_asc">Price: Low to High</SelectItem>
                    <SelectItem value="price_desc">Price: High to Low</SelectItem>
                    <SelectItem value="name_asc">Name: A to Z</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-r-none"
                    onClick={() => setViewMode("grid")}
                    title="Large cards"
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "compact" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-none border-x"
                    onClick={() => setViewMode("compact")}
                    title="Compact cards"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-l-none"
                    onClick={() => setViewMode("list")}
                    title="List view"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredParts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No parts found</h3>
                <p className="text-muted-foreground mt-1 max-w-sm">
                  {search || activeFiltersCount > 0
                    ? "Try adjusting your search or filters to find what you're looking for."
                    : "No parts are available at the moment. Check back soon!"}
                </p>
                {(search || activeFiltersCount > 0) && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setSearch("");
                      setSelectedMake(null);
                      setSelectedCategory(null);
                      setSelectedCondition(null);
                      setPriceMin("");
                      setPriceMax("");
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedParts.map((part) => (
                  <PartCard key={part.id} part={part} priceRules={priceRules} />
                ))}
              </div>
            ) : viewMode === "compact" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {paginatedParts.map((part) => (
                  <PartCard key={part.id} part={part} priceRules={priceRules} compact />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedParts.map((part) => {
                  const vehicle = formatVehicle(part.year, part.make, part.model);
                  return (
                    <Link key={part.id} href={`/parts/${part.id}`}>
                      <div className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-md transition-shadow">
                        <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-muted shrink-0">
                          {part.photos && part.photos.length > 0 ? (
                            <Image
                              src={part.photos[0]}
                              alt={part.name}
                              fill
                              sizes="80px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Package className="h-8 w-8 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{part.name}</h3>
                          {vehicle && (
                            <p className="text-sm text-muted-foreground">{vehicle}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {getCategoryLabel(part.category).split(" / ")[0]}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${conditionColors[part.condition] || ""}`}
                            >
                              {getConditionLabel(part.condition)}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {(() => {
                            const qty = part.quantity || 1;
                            const pp = part.price_per || "lot";
                            const lotPrice = getLotPrice(part.price, qty, pp);
                            const itemPrice = getItemPrice(part.price, qty, pp);
                            const pr = priceRules.length > 0 ? applyPriceRules({ ...part, price: lotPrice } as Part, priceRules) : null;
                            const displayPrice = pr && (pr.hasDiscount || pr.hasMarkup) ? pr.finalPrice : lotPrice;

                            return (
                              <div>
                                {pr && pr.hasDiscount ? (
                                  <>
                                    <span className="text-lg font-bold text-red-600">{formatPrice(pr.finalPrice)}</span>
                                    <span className="text-sm text-muted-foreground line-through ml-2">{formatPrice(lotPrice)}</span>
                                  </>
                                ) : (
                                  <span className="text-lg font-bold">{formatPrice(displayPrice)}</span>
                                )}
                                {qty > 1 && (
                                  <p className="text-xs text-muted-foreground">Lot of {qty} · {formatPrice(pr && pr.hasDiscount ? pr.finalPrice / qty : itemPrice)}/ea</p>
                                )}
                              </div>
                            );
                          })()}
                          {part.photos && part.photos.length > 1 && (
                            <p className="text-xs text-muted-foreground">{part.photos.length} photos</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  {(currentPage - 1) * PAGE_SIZE + 1}&ndash;{Math.min(currentPage * PAGE_SIZE, filteredParts.length)} of {filteredParts.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} HuppeR Auto Parts. All rights reserved.
            {" | "}
            <a href="/shipping" className="underline hover:text-foreground">Shipping &amp; Payment</a>
            {" | "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>
          </p>
        </div>
      </footer>
    </div>
  );
}

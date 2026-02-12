"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import { StorefrontHeader } from "@/components/storefront/header";
import { PartCard } from "@/components/storefront/part-card";
import { FiltersSidebar } from "@/components/storefront/filters-sidebar";
import { Package, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const supabase = createClient();

export default function StorefrontPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .eq("is_published", true)
      .eq("is_sold", false)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching parts:", error);
    } else {
      setParts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const uniqueMakes = useMemo(() => {
    const makes = parts.map((p) => p.make).filter((m): m is string => !!m);
    return Array.from(new Set(makes)).sort();
  }, [parts]);

  const usedCategories = useMemo(() => {
    const cats = parts.map((p) => p.category).filter((c): c is string => !!c);
    return Array.from(new Set(cats)).sort();
  }, [parts]);

  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        part.name.toLowerCase().includes(q) ||
        (part.make && part.make.toLowerCase().includes(q)) ||
        (part.model && part.model.toLowerCase().includes(q)) ||
        (part.description && part.description.toLowerCase().includes(q));

      const matchesMake = !selectedMake || part.make === selectedMake;
      const matchesCategory =
        !selectedCategory || part.category === selectedCategory;

      return matchesSearch && matchesMake && matchesCategory;
    });
  }, [parts, search, selectedMake, selectedCategory]);

  const activeFiltersCount =
    (selectedMake ? 1 : 0) + (selectedCategory ? 1 : 0);

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
              onMakeChange={setSelectedMake}
              onCategoryChange={setSelectedCategory}
              totalCount={parts.length}
              filteredCount={filteredParts.length}
            />
          </div>

          {/* Main content */}
          <div className="flex-1 space-y-4">
            {/* Mobile filter button */}
            <div className="flex items-center justify-between lg:hidden">
              <p className="text-sm text-muted-foreground">
                {filteredParts.length} part{filteredParts.length !== 1 ? "s" : ""}
              </p>
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
                      onMakeChange={(m) => {
                        setSelectedMake(m);
                      }}
                      onCategoryChange={(c) => {
                        setSelectedCategory(c);
                      }}
                      totalCount={parts.length}
                      filteredCount={filteredParts.length}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Results count for desktop */}
            <div className="hidden lg:flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredParts.length} part{filteredParts.length !== 1 ? "s" : ""} found
              </p>
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
                    }}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredParts.map((part) => (
                  <PartCard key={part.id} part={part} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Auto Parts Inventory. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

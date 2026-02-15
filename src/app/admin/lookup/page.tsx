"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Car,
  QrCode,
  X,
  Package,
  DollarSign,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Part } from "@/types/database";

const supabase = createClient();

type SearchMode = "vehicle" | "vin";

interface VehicleFilter {
  year: string;
  make: string;
  model: string;
}

export default function LookupPage() {
  const [mode, setMode] = useState<SearchMode>("vehicle");

  // Vehicle search
  const [filter, setFilter] = useState<VehicleFilter>({ year: "", make: "", model: "" });
  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  // VIN search — list of VINs from inventory
  const [vinList, setVinList] = useState<Array<{ vin: string; year: number | null; make: string | null; model: string | null; count: number }>>([]);
  const [selectedVin, setSelectedVin] = useState("");
  const [vinFilter, setVinFilter] = useState("");

  // Results
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Load filter options + VIN list
  useEffect(() => {
    async function loadOptions() {
      const { data } = await supabase
        .from("parts")
        .select("year, make, model, vin");

      if (!data) return;

      const rawYears: number[] = data.map((p: { year: number | null }) => p.year).filter((y: number | null): y is number => y !== null);
      const rawMakes: string[] = data.map((p: { make: string | null }) => p.make).filter((m: string | null): m is string => m !== null);
      setYears(Array.from(new Set(rawYears)).sort((a, b) => b - a));
      setMakes(Array.from(new Set(rawMakes)).sort());

      // Build VIN list
      const vinMap = new Map<string, { vin: string; year: number | null; make: string | null; model: string | null; count: number }>();
      for (const p of data as Array<{ vin: string | null; year: number | null; make: string | null; model: string | null }>) {
        if (!p.vin) continue;
        const existing = vinMap.get(p.vin);
        if (existing) {
          existing.count++;
        } else {
          vinMap.set(p.vin, { vin: p.vin, year: p.year, make: p.make, model: p.model, count: 1 });
        }
      }
      setVinList(Array.from(vinMap.values()).sort((a, b) => {
        const aVeh = [a.year, a.make, a.model].filter(Boolean).join(" ");
        const bVeh = [b.year, b.make, b.model].filter(Boolean).join(" ");
        return aVeh.localeCompare(bVeh);
      }));
    }
    loadOptions();
  }, []);

  // Load models when make changes
  useEffect(() => {
    if (!filter.make) {
      setModels([]);
      return;
    }
    async function loadModels() {
      const { data } = await supabase
        .from("parts")
        .select("model")
        .eq("make", filter.make)
        .not("model", "is", null);
      if (data) {
        const rawModels: string[] = data.map((p: { model: string | null }) => p.model).filter((m: string | null): m is string => m !== null);
        const unique = Array.from(new Set(rawModels)).sort();
        setModels(unique as string[]);
      }
    }
    loadModels();
  }, [filter.make]);

  async function searchByVehicle() {
    if (!filter.year && !filter.make && !filter.model) return;
    setLoading(true);
    setSearched(true);

    let query = supabase.from("parts").select("*").order("created_at", { ascending: false });
    if (filter.year) query = query.eq("year", parseInt(filter.year));
    if (filter.make) query = query.ilike("make", filter.make);
    if (filter.model) query = query.ilike("model", `%${filter.model}%`);

    const { data } = await query;
    setParts(data || []);
    setLoading(false);
  }

  async function searchByVin(vin: string) {
    if (!vin) return;
    setSelectedVin(vin);
    setLoading(true);
    setSearched(true);

    const { data } = await supabase
      .from("parts")
      .select("*")
      .eq("vin", vin)
      .order("created_at", { ascending: false });

    setParts(data || []);
    setLoading(false);
  }

  function clearVehicle() {
    setFilter({ year: "", make: "", model: "" });
    setParts([]);
    setSearched(false);
  }

  function clearVin() {
    setSelectedVin("");
    setVinFilter("");
    setParts([]);
    setSearched(false);
  }

  const hasVehicleFilter = !!(filter.year || filter.make || filter.model);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Parts Lookup</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find parts by vehicle or VIN
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "vehicle" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMode("vehicle"); clearVin(); }}
          className="gap-2"
        >
          <Car className="h-4 w-4" />
          By Vehicle
        </Button>
        <Button
          variant={mode === "vin" ? "default" : "outline"}
          size="sm"
          onClick={() => { setMode("vin"); clearVehicle(); }}
          className="gap-2"
        >
          <QrCode className="h-4 w-4" />
          By VIN
        </Button>
      </div>

      {/* Vehicle Search */}
      {mode === "vehicle" && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Year */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Year</label>
                <select
                  value={filter.year}
                  onChange={(e) => setFilter((f) => ({ ...f, year: e.target.value, model: "" }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Any year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Make */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Make</label>
                <select
                  value={filter.make}
                  onChange={(e) => setFilter((f) => ({ ...f, make: e.target.value, model: "" }))}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Any make</option>
                  {makes.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Model */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium">Model</label>
                {models.length > 0 ? (
                  <select
                    value={filter.model}
                    onChange={(e) => setFilter((f) => ({ ...f, model: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Any model</option>
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <Input
                    placeholder="Any model"
                    value={filter.model}
                    onChange={(e) => setFilter((f) => ({ ...f, model: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && searchByVehicle()}
                  />
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={searchByVehicle} disabled={!hasVehicleFilter || loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </Button>
              {hasVehicleFilter && (
                <Button variant="ghost" size="icon" onClick={clearVehicle}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* VIN Search */}
      {mode === "vin" && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {vinList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No VINs found in inventory. Add parts with VIN numbers first.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground font-medium">
                    Filter VINs ({vinList.length} donor cars)
                  </label>
                  <input
                    type="text"
                    placeholder="Type to filter..."
                    value={vinFilter}
                    onChange={(e) => setVinFilter(e.target.value.toUpperCase())}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono"
                  />
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {vinList
                    .filter((v) => !vinFilter || v.vin.includes(vinFilter) ||
                      [v.make, v.model].some(s => s?.toUpperCase().includes(vinFilter)))
                    .map((v) => (
                      <button
                        key={v.vin}
                        onClick={() => searchByVin(v.vin)}
                        className={`w-full text-left rounded-md px-3 py-2 text-sm transition-colors border ${
                          selectedVin === v.vin
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-input"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs">{v.vin}</span>
                          <Badge variant={selectedVin === v.vin ? "secondary" : "outline"} className="text-xs shrink-0">
                            {v.count} {v.count === 1 ? "part" : "parts"}
                          </Badge>
                        </div>
                        {(v.year || v.make || v.model) && (
                          <p className={`text-xs mt-0.5 ${selectedVin === v.vin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {[v.year, v.make, v.model].filter(Boolean).join(" ")}
                          </p>
                        )}
                      </button>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {searched && (
        <>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading ? "Searching..." : `Found ${parts.length} part${parts.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : parts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="font-medium">No parts found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different vehicle or check your inventory
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {parts.map((part) => (
                <Link key={part.id} href={`/admin/dashboard?highlight=${part.id}`} className="block">
                  <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        {/* Photo */}
                        {part.photos.length > 0 ? (
                          <div className="relative w-16 h-16 rounded-md overflow-hidden shrink-0 bg-muted">
                            <Image
                              src={part.photos[0]}
                              alt={part.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{part.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[part.year, part.make, part.model].filter(Boolean).join(" ") || "No vehicle info"}
                              </p>
                              {part.stock_number && (
                                <p className="text-xs text-muted-foreground">#{part.stock_number}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="font-semibold text-sm flex items-center gap-0.5">
                                <DollarSign className="h-3 w-3" />
                                {part.price.toFixed(2)}
                              </span>
                              <div className="flex gap-1">
                                {part.is_sold && (
                                  <Badge variant="secondary" className="text-xs">Sold</Badge>
                                )}
                                {!part.is_published && (
                                  <Badge variant="outline" className="text-xs">Hidden</Badge>
                                )}
                                {part.category && (
                                  <Badge variant="outline" className="text-xs">{part.category}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          {part.vin && (
                            <p className="text-xs text-muted-foreground mt-1 font-mono">VIN: {part.vin}</p>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Part, Vehicle } from "@/types/database";
import { formatPrice, getLotPrice, normalizeMakeModel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  DollarSign,
  Package,
  TrendingUp,
  ShoppingCart,
  ArrowUpDown,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Car,
  Fuel,
  Gauge,
  Cog,
} from "lucide-react";
import { VehicleDialog } from "@/components/admin/vehicle-dialog";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

const supabase = createClient();

// ── Statistics types ──
type GroupBy = "make" | "model" | "vin";
type SortKey = "key" | "partCount" | "totalValue" | "inStockValue" | "soldValue";
type SortDir = "asc" | "desc";

interface GroupStats {
  key: string;
  subtitle?: string;
  partCount: number;
  totalValue: number;
  inStockCount: number;
  inStockValue: number;
  soldCount: number;
  soldValue: number;
}

// ── Vehicle with parts aggregation ──
interface VehicleWithParts extends Vehicle {
  partsCount: number;
  partsInStockValue: number;
  partsSoldValue: number;
}

export default function StatsPage() {
  const t = useTranslations('admin.stats');
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("statistics");

  // ── Statistics state ──
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("make");
  const [sortKey, setSortKey] = useState<SortKey>("totalValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Vehicles state ──
  const [vehicles, setVehicles] = useState<VehicleWithParts[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [vehicleParts, setVehicleParts] = useState<Record<string, Part[]>>({});

  // ── Fetch parts (statistics) ──
  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("parts")
      .select("id, name, price, quantity, price_per, vin, make, model, year, is_sold, is_published")
      .order("created_at", { ascending: false });
    setParts((data || []) as Part[]);
    setLoading(false);
  }, []);

  // ── Fetch vehicles ──
  const fetchVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    const { data: vehicleData } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: allParts } = await supabase
      .from("parts")
      .select("vin, price, quantity, price_per, is_sold")
      .not("vin", "is", null);

    const partsArr = (allParts || []) as Part[];

    const enriched: VehicleWithParts[] = ((vehicleData || []) as Vehicle[]).map((v) => {
      const vParts = partsArr.filter((p) => p.vin === v.vin);
      const inStock = vParts.filter((p) => !p.is_sold);
      const sold = vParts.filter((p) => p.is_sold);
      return {
        ...v,
        partsCount: vParts.length,
        partsInStockValue: inStock.reduce((s, p) => s + getLotPrice(p.price, p.quantity || 1, p.price_per || "lot"), 0),
        partsSoldValue: sold.reduce((s, p) => s + getLotPrice(p.price, p.quantity || 1, p.price_per || "lot"), 0),
      };
    });

    setVehicles(enriched);
    setVehiclesLoading(false);
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    if (mainTab === "vehicles") {
      fetchVehicles();
    }
  }, [mainTab, fetchVehicles]);

  // ── Expand vehicle → load its parts ──
  const toggleExpand = async (vehicleId: string, vehicleVin: string) => {
    if (expandedVehicle === vehicleId) {
      setExpandedVehicle(null);
      return;
    }
    setExpandedVehicle(vehicleId);
    if (!vehicleParts[vehicleId]) {
      const { data } = await supabase
        .from("parts")
        .select("id, name, price, quantity, price_per, is_sold, stock_number, category, condition, photos")
        .eq("vin", vehicleVin)
        .order("created_at", { ascending: false });
      setVehicleParts((prev) => ({ ...prev, [vehicleId]: (data || []) as Part[] }));
    }
  };

  // ── Delete vehicle ──
  const handleDelete = async (v: Vehicle) => {
    if (!confirm(t('deleteVehicle', { year: v.year || '', make: v.make || '', model: v.model || '', vin: v.vin }))) return;

    // Delete vehicle photos from storage
    if (v.photos && v.photos.length > 0) {
      for (const url of v.photos) {
        const match = url.match(/\/part-photos\/(.+)$/);
        if (match) {
          await supabase.storage.from("part-photos").remove([match[1]]);
        }
      }
    }

    const { error } = await supabase.from("vehicles").delete().eq("id", v.id);
    if (error) {
      toast({ title: t('vehicleDeleteError'), variant: "destructive" });
    } else {
      toast({ title: t('vehicleDeleted') });
      fetchVehicles();
    }
  };

  // ── Statistics calculations ──
  const partLotPrice = (p: Part) => getLotPrice(p.price, p.quantity || 1, p.price_per || "lot");

  const overallStats = useMemo(() => {
    const inStock = parts.filter((p) => !p.is_sold);
    const sold = parts.filter((p) => p.is_sold);
    return {
      totalParts: parts.length,
      totalValue: parts.reduce((s, p) => s + partLotPrice(p), 0),
      inStockParts: inStock.length,
      inStockValue: inStock.reduce((s, p) => s + partLotPrice(p), 0),
      soldParts: sold.length,
      soldValue: sold.reduce((s, p) => s + partLotPrice(p), 0),
    };
  }, [parts]);

  const groupedStats = useMemo(() => {
    const groups = new Map<string, GroupStats>();

    for (const part of parts) {
      let key: string;
      let subtitle: string | undefined;

      const nMake = part.make ? normalizeMakeModel(part.make) : null;
      const nModel = part.model ? normalizeMakeModel(part.model) : null;

      switch (groupBy) {
        case "vin":
          key = part.vin || "No VIN";
          subtitle = [part.year, nMake, nModel].filter(Boolean).join(" ") || undefined;
          break;
        case "make":
          key = nMake || "Unknown";
          break;
        case "model":
          key = nModel ? `${nMake || ""} ${nModel}`.trim() : "Unknown";
          break;
      }

      const existing = groups.get(key) || {
        key, subtitle, partCount: 0, totalValue: 0,
        inStockCount: 0, inStockValue: 0, soldCount: 0, soldValue: 0,
      };

      const lp = partLotPrice(part);
      existing.partCount++;
      existing.totalValue += lp;
      if (part.is_sold) { existing.soldCount++; existing.soldValue += lp; }
      else { existing.inStockCount++; existing.inStockValue += lp; }
      if (subtitle && !existing.subtitle) existing.subtitle = subtitle;

      groups.set(key, existing);
    }

    const arr = Array.from(groups.values());
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "key": cmp = a.key.localeCompare(b.key); break;
        case "partCount": cmp = a.partCount - b.partCount; break;
        case "totalValue": cmp = a.totalValue - b.totalValue; break;
        case "inStockValue": cmp = a.inStockValue - b.inStockValue; break;
        case "soldValue": cmp = a.soldValue - b.soldValue; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return arr;
  }, [parts, groupBy, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const sortLabels: Record<string, string> = {
    "key": groupBy === "vin" ? "VIN" : groupBy === "make" ? t('brand') : t('byModel'),
    "partCount": t('parts'),
    "inStockValue": t('inStockValue'),
    "soldValue": t('soldValue'),
    "totalValue": t('totalDollar'),
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(field)}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('subtitle')}
        </p>
      </div>

      {/* Main tabs: Statistics / Vehicles */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="statistics">{t('statistics')}</TabsTrigger>
          <TabsTrigger value="vehicles">{t('vehicles')}</TabsTrigger>
        </TabsList>

        {/* ═══════════ STATISTICS TAB ═══════════ */}
        <TabsContent value="statistics" className="space-y-4 mt-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" /> {t('totalParts')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{overallStats.totalParts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> {t('totalValue')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{formatPrice(overallStats.totalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" /> {t('inStock')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-green-600">{formatPrice(overallStats.inStockValue)}</p>
                <p className="text-xs text-muted-foreground">{overallStats.inStockParts} parts</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-amber-600" /> {t('soldLabel')}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-amber-600">{formatPrice(overallStats.soldValue)}</p>
                <p className="text-xs text-muted-foreground">{overallStats.soldParts} parts</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown table */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('breakdown')}</CardTitle>
                <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <TabsList>
                    <TabsTrigger value="make">{t('byBrand')}</TabsTrigger>
                    <TabsTrigger value="model">{t('byModel')}</TabsTrigger>
                    <TabsTrigger value="vin">{t('byVin')}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {groupedStats.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">{t('noVehicles')}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <SortHeader label={sortLabels.key} field="key" />
                        </TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={t('parts')} field="partCount" /></div></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={t('inStockValue')} field="inStockValue" /></div></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={t('soldValue')} field="soldValue" /></div></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={t('totalDollar')} field="totalValue" /></div></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedStats.map((g) => (
                        <TableRow key={g.key}>
                          <TableCell>
                            <div>
                              <span className="font-medium">{g.key}</span>
                              {g.subtitle && <p className="text-xs text-muted-foreground">{g.subtitle}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">{g.partCount}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-green-700">{formatPrice(g.inStockValue)}</span>
                            <span className="text-xs text-muted-foreground ml-1">({g.inStockCount})</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono text-amber-700">{formatPrice(g.soldValue)}</span>
                            <span className="text-xs text-muted-foreground ml-1">({g.soldCount})</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatPrice(g.totalValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {groupedStats.length > 0 && (
                <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/30">
                  <span className="text-sm font-medium text-muted-foreground">
                    {t('groups', { count: groupedStats.length })}
                  </span>
                  <span className="text-sm font-bold">{t('total')}: {formatPrice(overallStats.totalValue)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ VEHICLES TAB ═══════════ */}
        <TabsContent value="vehicles" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""}</p>
            <Button onClick={() => { setEditVehicle(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> {t('addVehicle')}
            </Button>
          </div>

          {vehiclesLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : vehicles.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Car className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{t('noVehicles')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Vehicle summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> {t('totalInvested')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold">
                      {formatPrice(vehicles.reduce((s, v) => s + (v.purchase_price || 0), 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" /> {t('partsInStock')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold text-green-600">
                      {formatPrice(vehicles.reduce((s, v) => s + v.partsInStockValue, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <ShoppingCart className="h-4 w-4 text-amber-600" /> {t('partsSold')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <p className="text-2xl font-bold text-amber-600">
                      {formatPrice(vehicles.reduce((s, v) => s + v.partsSoldValue, 0))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> {t('totalProfit')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    {(() => {
                      const profit = vehicles.reduce((s, v) => s + v.partsSoldValue - (v.purchase_price || 0), 0);
                      return (
                        <p className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                        </p>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>

              {/* Vehicle list */}
              {vehicles.map((v) => {
                const profit = v.partsSoldValue - (v.purchase_price || 0);
                const isExpanded = expandedVehicle === v.id;

                return (
                  <Card key={v.id} className="overflow-hidden">
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(v.id, v.vin)}
                    >
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                        {v.photos && v.photos.length > 0 ? (
                          <Image
                            src={v.photos[0]}
                            alt={`${v.make} ${v.model}`}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Car className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg">
                            {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown"}
                          </span>
                          {v.engine_turbo && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Turbo</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span className="font-mono">{v.vin}</span>
                          {v.body_class && <span className="flex items-center gap-1"><Car className="h-3 w-3" />{v.body_class}</span>}
                          {v.engine_displacement && <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{v.engine_displacement} {v.engine_cylinders ? `V${v.engine_cylinders}` : ""} {v.engine_hp ? `${v.engine_hp}hp` : ""}</span>}
                          {v.drive_type && <span className="flex items-center gap-1"><Cog className="h-3 w-3" />{v.drive_type}</span>}
                          {v.fuel_type && <span className="flex items-center gap-1"><Fuel className="h-3 w-3" />{v.fuel_type}</span>}
                        </div>
                      </div>

                      {/* Values */}
                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t('paid')}: </span>
                          <span className="font-mono font-bold">{v.purchase_price ? formatPrice(v.purchase_price) : "—"}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t('parts')}: </span>
                          <span className="font-mono">{v.partsCount}</span>
                          <span className="text-muted-foreground ml-1">
                            ({formatPrice(v.partsInStockValue + v.partsSoldValue)})
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{t('profit')}: </span>
                          <span className={`font-mono font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setEditVehicle(v); setDialogOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); handleDelete(v); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-4">
                        {/* Photos */}
                        {v.photos && v.photos.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Photos</p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {v.photos.map((url, i) => (
                                <div key={i} className="w-32 h-32 flex-shrink-0 rounded-md overflow-hidden">
                                  <Image
                                    src={url}
                                    alt={`Photo ${i + 1}`}
                                    width={128}
                                    height={128}
                                    className="object-cover w-full h-full"
                                    unoptimized
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {v.notes && (
                          <div>
                            <p className="text-sm font-medium mb-1">Notes</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.notes}</p>
                          </div>
                        )}

                        {/* Parts from this VIN */}
                        <div>
                          <p className="text-sm font-medium mb-2">{t('partsFromVehicle')}</p>
                          {!vehicleParts[v.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : vehicleParts[v.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('noPartsForVin')}</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>SN</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Price</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {vehicleParts[v.id].map((p) => (
                                    <TableRow key={p.id}>
                                      <TableCell className="font-mono text-xs">{p.stock_number || "—"}</TableCell>
                                      <TableCell className="font-medium">{p.name}</TableCell>
                                      <TableCell className="text-sm text-muted-foreground">{p.category}</TableCell>
                                      <TableCell className="text-right font-mono">
                                        {formatPrice(getLotPrice(p.price, p.quantity || 1, p.price_per || "lot"))}
                                      </TableCell>
                                      <TableCell>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.is_sold ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                                          {p.is_sold ? t('soldLabel') : t('inStock')}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Vehicle Dialog */}
      <VehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editVehicle}
        onSaved={fetchVehicles}
      />
    </div>
  );
}

"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  DollarSign,
  Package,
  TrendingUp,
  ShoppingCart,
  ArrowUpDown,
} from "lucide-react";

const supabase = createClient();

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

export default function StatsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>("make");
  const [sortKey, setSortKey] = useState<SortKey>("totalValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("parts")
      .select("id, name, price, vin, make, model, year, is_sold, is_published")
      .order("created_at", { ascending: false });
    setParts((data || []) as Part[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  const overallStats = useMemo(() => {
    const inStock = parts.filter((p) => !p.is_sold);
    const sold = parts.filter((p) => p.is_sold);
    return {
      totalParts: parts.length,
      totalValue: parts.reduce((s, p) => s + p.price, 0),
      inStockParts: inStock.length,
      inStockValue: inStock.reduce((s, p) => s + p.price, 0),
      soldParts: sold.length,
      soldValue: sold.reduce((s, p) => s + p.price, 0),
    };
  }, [parts]);

  const groupedStats = useMemo(() => {
    const groups = new Map<string, GroupStats>();

    for (const part of parts) {
      let key: string;
      let subtitle: string | undefined;

      switch (groupBy) {
        case "vin":
          key = part.vin || "No VIN";
          subtitle = [part.year, part.make, part.model].filter(Boolean).join(" ") || undefined;
          break;
        case "make":
          key = part.make || "Unknown";
          break;
        case "model":
          key = part.model
            ? `${part.make || ""} ${part.model}`.trim()
            : "Unknown";
          break;
      }

      const existing = groups.get(key) || {
        key,
        subtitle,
        partCount: 0,
        totalValue: 0,
        inStockCount: 0,
        inStockValue: 0,
        soldCount: 0,
        soldValue: 0,
      };

      existing.partCount++;
      existing.totalValue += part.price;
      if (part.is_sold) {
        existing.soldCount++;
        existing.soldValue += part.price;
      } else {
        existing.inStockCount++;
        existing.inStockValue += part.price;
      }
      if (subtitle && !existing.subtitle) existing.subtitle = subtitle;

      groups.set(key, existing);
    }

    const arr = Array.from(groups.values());

    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "key":
          cmp = a.key.localeCompare(b.key);
          break;
        case "partCount":
          cmp = a.partCount - b.partCount;
          break;
        case "totalValue":
          cmp = a.totalValue - b.totalValue;
          break;
        case "inStockValue":
          cmp = a.inStockValue - b.inStockValue;
          break;
        case "soldValue":
          cmp = a.soldValue - b.soldValue;
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return arr;
  }, [parts, groupBy, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
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
        <h1 className="text-2xl font-bold">Inventory Statistics</h1>
        <p className="text-muted-foreground text-sm">
          Value breakdown by vehicle, brand, and model
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Total Parts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{overallStats.totalParts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Total Value
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">{formatPrice(overallStats.totalValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" /> In Stock
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
              <ShoppingCart className="h-4 w-4 text-amber-600" /> Sold
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-amber-600">{formatPrice(overallStats.soldValue)}</p>
            <p className="text-xs text-muted-foreground">{overallStats.soldParts} parts</p>
          </CardContent>
        </Card>
      </div>

      {/* Group By Tabs */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Breakdown</CardTitle>
            <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <TabsList>
                <TabsTrigger value="make">By Brand</TabsTrigger>
                <TabsTrigger value="model">By Model</TabsTrigger>
                <TabsTrigger value="vin">By VIN</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groupedStats.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No data available
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortHeader
                        label={groupBy === "vin" ? "VIN" : groupBy === "make" ? "Brand" : "Model"}
                        field="key"
                      />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortHeader label="Parts" field="partCount" />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortHeader label="In Stock ($)" field="inStockValue" />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortHeader label="Sold ($)" field="soldValue" />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortHeader label="Total ($)" field="totalValue" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedStats.map((g) => (
                    <TableRow key={g.key}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{g.key}</span>
                          {g.subtitle && (
                            <p className="text-xs text-muted-foreground">{g.subtitle}</p>
                          )}
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
                      <TableCell className="text-right font-mono font-bold">
                        {formatPrice(g.totalValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Total row */}
          {groupedStats.length > 0 && (
            <div className="border-t px-4 py-3 flex items-center justify-between bg-muted/30">
              <span className="text-sm font-medium text-muted-foreground">
                {groupedStats.length} group{groupedStats.length !== 1 ? "s" : ""}
              </span>
              <span className="text-sm font-bold">
                Total: {formatPrice(overallStats.totalValue)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

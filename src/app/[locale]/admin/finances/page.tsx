"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Part, Vehicle, Expense, ExpenseCategory } from "@/types/database";
import { formatPrice, getLotPrice, normalizeMakeModel } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, DollarSign, Package, TrendingUp, TrendingDown, ShoppingCart,
  ArrowUpDown, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Car, Fuel, Gauge, Cog, Download, Receipt,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { decodeVINFull } from "@/lib/nhtsa";
import { VehicleDialog } from "@/components/admin/vehicle-dialog";
import { ExpenseDialog } from "@/components/admin/expense-dialog";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

const supabase = createClient();

// ── Types ──
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

interface VehicleWithParts extends Vehicle {
  partsCount: number;
  partsInStockValue: number;
  partsSoldValue: number;
}

const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#6b7280"];

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "rent", "shipping", "tools", "supplies", "advertising", "fees", "other",
];

export default function FinancesPage() {
  const t = useTranslations("admin.finances");
  const ts = useTranslations("admin.stats");
  const { toast } = useToast();
  const [mainTab, setMainTab] = useState("overview");

  // ── Year filter ──
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  // ── Parts & expenses data ──
  const [parts, setParts] = useState<Part[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Statistics state ──
  const [groupBy, setGroupBy] = useState<GroupBy>("make");
  const [sortKey, setSortKey] = useState<SortKey>("totalValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Vehicles state ──
  const [vehicles, setVehicles] = useState<VehicleWithParts[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [expandedVehicle, setExpandedVehicle] = useState<string | null>(null);
  const [vehicleParts, setVehicleParts] = useState<Record<string, Part[]>>({});

  // ── Re-decode state ──
  const [redecoding, setRedecoding] = useState(false);
  const [redecodeProgress, setRedecodeProgress] = useState("");

  // ── Expense dialog state ──
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");

  // ── Fetch parts ──
  const fetchParts = useCallback(async () => {
    const { data } = await supabase
      .from("parts")
      .select("id, name, price, quantity, price_per, vin, make, model, year, is_sold, is_published, sold_price, sold_at, created_at")
      .order("created_at", { ascending: false });
    setParts((data || []) as Part[]);
  }, []);

  // ── Fetch expenses ──
  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });
    setExpenses((data || []) as Expense[]);
  }, []);

  // ── Initial load ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchParts(), fetchExpenses()]);
      setLoading(false);
    };
    load();
  }, [fetchParts, fetchExpenses]);

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
    if (mainTab === "vehicles") fetchVehicles();
  }, [mainTab, fetchVehicles]);

  // ── Helpers ──
  const partLotPrice = (p: Part) => getLotPrice(p.price, p.quantity || 1, p.price_per || "lot");

  // ── Year-filtered data ──
  const yearInt = parseInt(selectedYear, 10);

  const soldPartsInYear = useMemo(() =>
    parts.filter((p) => p.is_sold && p.sold_at && new Date(p.sold_at).getFullYear() === yearInt),
    [parts, yearInt]
  );

  const expensesInYear = useMemo(() =>
    expenses.filter((e) => new Date(e.date).getFullYear() === yearInt),
    [expenses, yearInt]
  );

  // ══════════ OVERVIEW TAB DATA ══════════

  const totalRevenue = useMemo(() =>
    soldPartsInYear.reduce((s, p) => s + (p.sold_price || partLotPrice(p)), 0),
    [soldPartsInYear]
  );

  const totalExpenses = useMemo(() =>
    expensesInYear.reduce((s, e) => s + e.amount, 0),
    [expensesInYear]
  );

  const vehicleInvestment = useMemo(() =>
    vehicles.reduce((s, v) => {
      if (!v.purchase_price) return s;
      const vDate = new Date(v.created_at);
      if (vDate.getFullYear() === yearInt) return s + v.purchase_price;
      return s;
    }, 0),
    [vehicles, yearInt]
  );

  const netProfit = totalRevenue - totalExpenses - vehicleInvestment;

  // ── Monthly chart data ──
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(yearInt, i).toLocaleString("default", { month: "short" }),
      income: 0,
      expenses: 0,
    }));

    for (const p of soldPartsInYear) {
      if (p.sold_at) {
        const m = new Date(p.sold_at).getMonth();
        months[m].income += p.sold_price || partLotPrice(p);
      }
    }

    for (const e of expensesInYear) {
      const m = new Date(e.date).getMonth();
      months[m].expenses += e.amount;
    }

    return months;
  }, [soldPartsInYear, expensesInYear, yearInt]);

  // ── Pie chart data ──
  const expenseByCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expensesInYear) {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: t(`categories.${name}`), value }))
      .sort((a, b) => b.value - a.value);
  }, [expensesInYear, t]);

  // ══════════ EXPENSES TAB ══════════

  const filteredExpenses = useMemo(() => {
    let result = expensesInYear;
    if (expenseCategoryFilter !== "all") {
      result = result.filter((e) => e.category === expenseCategoryFilter);
    }
    return result;
  }, [expensesInYear, expenseCategoryFilter]);

  const handleDeleteExpense = async (expense: Expense) => {
    if (!confirm(t("deleteExpenseConfirm"))) return;
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (error) {
      toast({ title: t("expenseDeleteError"), variant: "destructive" });
    } else {
      toast({ title: t("expenseDeleted") });
      fetchExpenses();
    }
  };

  // ── CSV Export ──
  const exportCSV = () => {
    const rows: string[][] = [["Date", "Type", "Category", "Description", "Amount"]];

    for (const p of soldPartsInYear) {
      rows.push([
        p.sold_at ? p.sold_at.split("T")[0] : "",
        "Income",
        "Part Sale",
        p.name,
        (p.sold_price || partLotPrice(p)).toFixed(2),
      ]);
    }

    for (const e of expensesInYear) {
      rows.push([
        e.date,
        "Expense",
        e.category,
        e.description || "",
        (-e.amount).toFixed(2),
      ]);
    }

    rows.sort((a, b) => a[0].localeCompare(b[0]));

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finances-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ══════════ STATISTICS TAB (from stats page) ══════════

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
    key: groupBy === "vin" ? "VIN" : groupBy === "make" ? ts("brand") : ts("byModel"),
    partCount: ts("parts"),
    inStockValue: ts("inStockValue"),
    soldValue: ts("soldValue"),
    totalValue: ts("totalDollar"),
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => handleSort(field)}>
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortKey === field ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );

  // ══════════ VEHICLES TAB (from stats page) ══════════

  const handleRedecodeAll = async () => {
    setRedecoding(true);
    try {
      const { data, error } = await supabase
        .from("parts")
        .select("id, vin")
        .not("vin", "is", null)
        .neq("vin", "")
        .is("body_class", null);

      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: ts("redecodeNone") });
        setRedecoding(false);
        return;
      }

      const vinMap = new Map<string, string[]>();
      for (const row of data) {
        const v = (row.vin as string).trim().toUpperCase();
        if (v.length === 17) {
          const ids = vinMap.get(v) || [];
          ids.push(row.id);
          vinMap.set(v, ids);
        }
      }

      let done = 0;
      const total = vinMap.size;

      for (const [vin, ids] of vinMap) {
        setRedecodeProgress(`${done + 1} / ${total}`);
        try {
          const result = await decodeVINFull(vin);
          await supabase
            .from("parts")
            .update({
              body_class: result.body_class,
              engine_displacement: result.engine_displacement,
              engine_cylinders: result.engine_cylinders,
              engine_hp: result.engine_hp,
              engine_turbo: result.engine_turbo,
              drive_type: result.drive_type,
              fuel_type: result.fuel_type,
            })
            .in("id", ids);
        } catch {
          // Skip failed VINs
        }
        done++;
        await new Promise((r) => setTimeout(r, 350));
      }

      toast({ title: ts("redecodeComplete"), description: `${done} VINs` });
      fetchParts();
    } catch {
      toast({ title: ts("redecodeFailed"), variant: "destructive" });
    } finally {
      setRedecoding(false);
      setRedecodeProgress("");
    }
  };

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

  const handleDeleteVehicle = async (v: Vehicle) => {
    if (!confirm(ts("deleteVehicle", { year: v.year || "", make: v.make || "", model: v.model || "", vin: v.vin }))) return;
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
      toast({ title: ts("vehicleDeleteError"), variant: "destructive" });
    } else {
      toast({ title: ts("vehicleDeleted") });
      fetchVehicles();
    }
  };

  // ══════════ RENDER ══════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("expenses")}</TabsTrigger>
          <TabsTrigger value="statistics">{ts("statistics")}</TabsTrigger>
          <TabsTrigger value="vehicles">{ts("vehicles")}</TabsTrigger>
        </TabsList>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" /> {t("revenue")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-green-600">{formatPrice(totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">{soldPartsInYear.length} {t("sales")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" /> {t("totalExpenses")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-red-600">{formatPrice(totalExpenses)}</p>
                <p className="text-xs text-muted-foreground">{expensesInYear.length} {t("entries")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Car className="h-4 w-4 text-amber-600" /> {t("vehicleInvestment")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-amber-600">{formatPrice(vehicleInvestment)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> {t("netProfit")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {netProfit >= 0 ? "+" : ""}{formatPrice(netProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Bar chart — income vs expenses by month */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("monthlyOverview")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => `$${v}`} />
                    <Tooltip formatter={(value) => formatPrice(Number(value))} />
                    <Legend />
                    <Bar dataKey="income" name={t("income")} fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name={t("expenses")} fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pie chart — expense categories */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{t("expenseBreakdown")}</CardTitle>
              </CardHeader>
              <CardContent>
                {expenseByCategoryData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    {t("noExpenses")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expenseByCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {expenseByCategoryData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatPrice(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════ EXPENSES TAB ═══════════ */}
        <TabsContent value="expenses" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={t("allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("allCategories")}</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{t(`categories.${cat}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {filteredExpenses.length} {t("entries")} &middot; {formatPrice(filteredExpenses.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
            <Button onClick={() => { setEditExpense(null); setExpenseDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> {t("addExpense")}
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredExpenses.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>{t("noExpenses")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>{t("category")}</TableHead>
                        <TableHead>{t("description")}</TableHead>
                        <TableHead className="text-right">{t("amount")}</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-mono text-sm">{e.date}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{t(`categories.${e.category}`)}</span>
                              {e.is_recurring && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {t(e.recurring_interval === "yearly" ? "yearly" : "monthly")}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                          <TableCell className="text-right font-mono font-bold text-red-600">
                            {formatPrice(e.amount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => { setEditExpense(e); setExpenseDialogOpen(true); }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteExpense(e)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ STATISTICS TAB ═══════════ */}
        <TabsContent value="statistics" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRedecodeAll}
              disabled={redecoding || loading}
            >
              {redecoding ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{redecodeProgress}</>
              ) : (
                ts("redecodeAll")
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Package className="h-4 w-4" /> {ts("totalParts")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{overallStats.totalParts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> {ts("totalValue")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{formatPrice(overallStats.totalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" /> {ts("inStock")}
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
                  <ShoppingCart className="h-4 w-4 text-amber-600" /> {ts("soldLabel")}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-amber-600">{formatPrice(overallStats.soldValue)}</p>
                <p className="text-xs text-muted-foreground">{overallStats.soldParts} parts</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{ts("breakdown")}</CardTitle>
                <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <TabsList>
                    <TabsTrigger value="make">{ts("byBrand")}</TabsTrigger>
                    <TabsTrigger value="model">{ts("byModel")}</TabsTrigger>
                    <TabsTrigger value="vin">{ts("byVin")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {groupedStats.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">{ts("noVehicles")}</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead><SortHeader label={sortLabels.key} field="key" /></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={ts("parts")} field="partCount" /></div></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={ts("inStockValue")} field="inStockValue" /></div></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={ts("soldValue")} field="soldValue" /></div></TableHead>
                        <TableHead><div className="flex justify-end"><SortHeader label={ts("totalDollar")} field="totalValue" /></div></TableHead>
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
                    {ts("groups", { count: groupedStats.length })}
                  </span>
                  <span className="text-sm font-bold">{ts("total")}: {formatPrice(overallStats.totalValue)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ VEHICLES TAB ═══════════ */}
        <TabsContent value="vehicles" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""}</p>
            <Button onClick={() => { setEditVehicle(null); setVehicleDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> {ts("addVehicle")}
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
                <p>{ts("noVehicles")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="py-3 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> {ts("totalInvested")}
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
                      <TrendingUp className="h-4 w-4 text-green-600" /> {ts("partsInStock")}
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
                      <ShoppingCart className="h-4 w-4 text-amber-600" /> {ts("partsSold")}
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
                      <TrendingUp className="h-4 w-4" /> {ts("totalProfit")}
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

              {vehicles.map((v) => {
                const profit = v.partsSoldValue - (v.purchase_price || 0);
                const isExpanded = expandedVehicle === v.id;

                return (
                  <Card key={v.id} className="overflow-hidden">
                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpand(v.id, v.vin)}
                    >
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

                      <div className="text-right flex-shrink-0 space-y-0.5">
                        <div className="text-sm">
                          <span className="text-muted-foreground">{ts("paid")}: </span>
                          <span className="font-mono font-bold">{v.purchase_price ? formatPrice(v.purchase_price) : "—"}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{ts("parts")}: </span>
                          <span className="font-mono">{v.partsCount}</span>
                          <span className="text-muted-foreground ml-1">
                            ({formatPrice(v.partsInStockValue + v.partsSoldValue)})
                          </span>
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">{ts("profit")}: </span>
                          <span className={`font-mono font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {profit >= 0 ? "+" : ""}{formatPrice(profit)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); setEditVehicle(v); setVehicleDialogOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700"
                          onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(v); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/20 p-4 space-y-4">
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

                        {v.notes && (
                          <div>
                            <p className="text-sm font-medium mb-1">Notes</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.notes}</p>
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-medium mb-2">{ts("partsFromVehicle")}</p>
                          {!vehicleParts[v.id] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : vehicleParts[v.id].length === 0 ? (
                            <p className="text-sm text-muted-foreground">{ts("noPartsForVin")}</p>
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
                                          {p.is_sold ? ts("soldLabel") : ts("inStock")}
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

      {/* Dialogs */}
      <VehicleDialog
        open={vehicleDialogOpen}
        onOpenChange={setVehicleDialogOpen}
        vehicle={editVehicle}
        onSaved={fetchVehicles}
      />
      <ExpenseDialog
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        expense={editExpense}
        onSaved={fetchExpenses}
      />
    </div>
  );
}

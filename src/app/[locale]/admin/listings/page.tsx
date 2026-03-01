"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Part } from "@/types/database";
import { formatPrice, getLotPrice } from "@/lib/utils";
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
  ShoppingBag,
  Clock,
  ArrowUpDown,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Facebook,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

const supabase = createClient();

type PlatformFilter = "all" | "fb" | "ebay" | "none";
type StatusFilter = "all" | "active" | "sold";
type SortKey = "date" | "days" | "price" | "name";
type SortDir = "asc" | "desc";

function daysAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysLabel(days: number | null): string {
  if (days === null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// Speed indicator for listing performance
function SpeedBadge({ part }: { part: Part }) {
  const fbDays = daysAgo(part.fb_posted_at);
  const ebayDays = daysAgo(part.ebay_listed_at);
  const listedDays = Math.max(fbDays ?? 0, ebayDays ?? 0);
  const isListed = fbDays !== null || ebayDays !== null;

  if (!isListed) return <span className="text-xs text-muted-foreground">—</span>;

  if (part.is_sold) {
    // Sold — compute days from listing to sold (using updated_at as proxy)
    const soldDate = new Date(part.updated_at).getTime();
    const listedDate = Math.min(
      part.fb_posted_at ? new Date(part.fb_posted_at).getTime() : Infinity,
      part.ebay_listed_at ? new Date(part.ebay_listed_at).getTime() : Infinity
    );
    const soldInDays = Math.floor((soldDate - listedDate) / (1000 * 60 * 60 * 24));

    if (soldInDays < 3) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          <TrendingUp className="w-3 h-3" />
          {soldInDays}d — Fast
        </span>
      );
    }
    if (soldInDays <= 14) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-3 h-3" />
          {soldInDays}d — Normal
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
        <Minus className="w-3 h-3" />
        {soldInDays}d — Slow
      </span>
    );
  }

  // Active listing
  if (listedDays > 30) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
        <AlertTriangle className="w-3 h-3" />
        {listedDays}d — Lower price?
      </span>
    );
  }
  if (listedDays > 14) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <TrendingDown className="w-3 h-3" />
        {listedDays}d — Slow
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />
      {listedDays}d
    </span>
  );
}

export default function ListingsPage() {
  const t = useTranslations('admin.listings');
  const td = useTranslations('admin.dashboard');
  const { toast } = useToast();
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<PlatformFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchParts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Listings fetch error:", error);
    }
    setParts((data || []) as Part[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Stats
  const stats = useMemo(() => {
    const listed = parts.filter((p) => p.fb_posted_at || p.ebay_listed_at);
    const onFb = parts.filter((p) => p.fb_posted_at);
    const onEbay = parts.filter((p) => p.ebay_listed_at);

    // Avg days to sell (only for sold+listed parts)
    const soldListed = parts.filter(
      (p) => p.is_sold && (p.fb_posted_at || p.ebay_listed_at)
    );
    let avgDays = 0;
    if (soldListed.length > 0) {
      const totalDays = soldListed.reduce((sum, p) => {
        const soldDate = new Date(p.updated_at).getTime();
        const listedDate = Math.min(
          p.fb_posted_at ? new Date(p.fb_posted_at).getTime() : Infinity,
          p.ebay_listed_at ? new Date(p.ebay_listed_at).getTime() : Infinity
        );
        return sum + Math.max(0, (soldDate - listedDate) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDays = Math.round(totalDays / soldListed.length);
    }

    return {
      totalListed: listed.length,
      onFb: onFb.length,
      onEbay: onEbay.length,
      avgDays,
    };
  }, [parts]);

  // Filter + sort
  const filteredParts = useMemo(() => {
    let result = parts;

    // Platform filter
    if (platform === "fb") result = result.filter((p) => p.fb_posted_at);
    else if (platform === "ebay") result = result.filter((p) => p.ebay_listed_at);
    else if (platform === "none")
      result = result.filter((p) => !p.fb_posted_at && !p.ebay_listed_at);
    else result = result.filter((p) => p.fb_posted_at || p.ebay_listed_at);

    // Status filter
    if (status === "active") result = result.filter((p) => !p.is_sold);
    else if (status === "sold") result = result.filter((p) => p.is_sold);

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date": {
          const aDate = Math.min(
            a.fb_posted_at ? new Date(a.fb_posted_at).getTime() : Infinity,
            a.ebay_listed_at ? new Date(a.ebay_listed_at).getTime() : Infinity
          );
          const bDate = Math.min(
            b.fb_posted_at ? new Date(b.fb_posted_at).getTime() : Infinity,
            b.ebay_listed_at ? new Date(b.ebay_listed_at).getTime() : Infinity
          );
          cmp = aDate - bDate;
          break;
        }
        case "days": {
          const aDays = Math.max(daysAgo(a.fb_posted_at) ?? 0, daysAgo(a.ebay_listed_at) ?? 0);
          const bDays = Math.max(daysAgo(b.fb_posted_at) ?? 0, daysAgo(b.ebay_listed_at) ?? 0);
          cmp = aDays - bDays;
          break;
        }
        case "price":
          cmp = getLotPrice(a.price, a.quantity, a.price_per) - getLotPrice(b.price, b.quantity, b.price_per);
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [parts, platform, status, sortKey, sortDir]);

  const handleDelistFb = async (partId: string) => {
    const prev = parts;
    setParts((p) => p.map((x) => x.id === partId ? { ...x, fb_posted_at: null } : x));
    const { error } = await supabase
      .from("parts")
      .update({ fb_posted_at: null })
      .eq("id", partId);
    if (error) {
      setParts(prev);
      toast({ title: t("delistFailed"), variant: "destructive" });
    } else {
      toast({ title: t("delistedFb") });
    }
  };

  const handleDelistEbay = async (partId: string) => {
    const prev = parts;
    setParts((p) => p.map((x) => x.id === partId ? { ...x, ebay_listed_at: null, ebay_listing_id: null, ebay_offer_id: null, ebay_listing_url: null } : x));
    const { error } = await supabase
      .from("parts")
      .update({ ebay_listed_at: null, ebay_listing_id: null, ebay_offer_id: null, ebay_listing_url: null })
      .eq("id", partId);
    if (error) {
      setParts(prev);
      toast({ title: t("delistFailed"), variant: "destructive" });
    } else {
      toast({ title: t("delistedEbay") });
    }
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortButton({ column, children }: { column: SortKey; children: React.ReactNode }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-0 font-medium hover:bg-transparent"
        onClick={() => toggleSort(column)}
      >
        {children}
        <ArrowUpDown className={`ml-1 h-3 w-3 ${sortKey === column ? "opacity-100" : "opacity-30"}`} />
      </Button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('subtitle')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalListed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('fbOnly')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.onFb}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              eBay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.onEbay}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('daysListed')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avgDays > 0 ? `${stats.avgDays}d` : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Tabs value={platform} onValueChange={(v) => setPlatform(v as PlatformFilter)}>
          <TabsList>
            <TabsTrigger value="all">{t('allPlatforms')}</TabsTrigger>
            <TabsTrigger value="fb">{t('fbOnly')}</TabsTrigger>
            <TabsTrigger value="ebay">{t('ebayOnly')}</TabsTrigger>
            <TabsTrigger value="none">{t('notListed')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">{t('allPlatforms')}</TabsTrigger>
            <TabsTrigger value="active">{t('activeOnly')}</TabsTrigger>
            <TabsTrigger value="sold">{t('soldOnly')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="min-w-[200px]">
                    <SortButton column="name">{td('name')}</SortButton>
                  </TableHead>
                  <TableHead className="text-right">
                    <SortButton column="price">{td('price')}</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton column="date">FB</SortButton>
                  </TableHead>
                  <TableHead>
                    <SortButton column="date">eBay</SortButton>
                  </TableHead>
                  <TableHead>{td('status')}</TableHead>
                  <TableHead>
                    <SortButton column="days">{t('daysListed')}</SortButton>
                  </TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {t('noListings')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParts.map((part) => (
                    <TableRow key={part.id}>
                      <TableCell className="p-1">
                        {part.photos?.[0] ? (
                          <div className="relative h-10 w-10 rounded overflow-hidden flex-shrink-0">
                            <Image src={part.photos[0]} alt={part.name} fill className="object-cover" sizes="40px" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{part.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[part.year, part.make, part.model].filter(Boolean).join(" ")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPrice(getLotPrice(part.price, part.quantity, part.price_per))}
                      </TableCell>
                      <TableCell>
                        {part.fb_posted_at ? (
                          <div>
                            <div className="text-sm">{formatDate(part.fb_posted_at)}</div>
                            <div className="text-xs text-muted-foreground">
                              {daysLabel(daysAgo(part.fb_posted_at))} ago
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {part.ebay_listed_at ? (
                          <div>
                            <div className="text-sm">{formatDate(part.ebay_listed_at)}</div>
                            <div className="text-xs text-muted-foreground">
                              {daysLabel(daysAgo(part.ebay_listed_at))} ago
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {part.is_sold ? (
                          <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            {t('soldOnly')}
                          </span>
                        ) : part.fb_posted_at || part.ebay_listed_at ? (
                          <span className="inline-flex items-center text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            {t('activeOnly')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {t('notListed')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <SpeedBadge part={part} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {part.fb_posted_at && !part.is_sold && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                              onClick={() => handleDelistFb(part.id)}
                            >
                              <X className="h-3 w-3" />
                              FB
                            </Button>
                          )}
                          {part.ebay_listed_at && !part.is_sold && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-red-600 hover:text-red-800 hover:bg-red-50"
                              onClick={() => handleDelistEbay(part.id)}
                            >
                              <X className="h-3 w-3" />
                              eBay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {filteredParts.length} part{filteredParts.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}

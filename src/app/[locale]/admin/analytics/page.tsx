"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
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
  Eye,
  Users,
  FileText,
  Globe,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  BarChart3,
  ExternalLink,
  Clock,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const SELF_DOMAINS = ["onrender.com", "vercel.app", "localhost"];

function countryFlag(code: string): string {
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

function CountryBadge({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center gap-1 text-sm mr-1">
      <span>{countryFlag(code)}</span>
      <span className="text-[10px] font-bold font-mono text-muted-foreground">{code.toUpperCase()}</span>
    </span>
  );
}

type PageView = {
  id: number;
  created_at: string;
  page_path: string;
  page_title: string | null;
  visitor_hash: string;
  visitor_id: string | null;
  ip_address: string | null;
  referrer: string | null;
  device_type: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  country_code: string | null;
  city: string | null;
  region: string | null;
};

type Period = "today" | "7d" | "30d" | "all";

const supabase = createClient();

function getPeriodStart(period: Period): Date | null {
  const now = new Date();
  switch (period) {
    case "today":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "all":
      return null;
  }
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AnalyticsPage() {
  const [views, setViews] = useState<PageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("7d");
  const [recentPage, setRecentPage] = useState(1);
  const [dataTruncated, setDataTruncated] = useState(false);
  const { toast } = useToast();

  const fetchViews = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("page_views")
      .select("page_path, page_title, visitor_hash, visitor_id, ip_address, referrer, device_type, browser, os, country, country_code, city, region, created_at")
      .order("created_at", { ascending: false });

    const start = getPeriodStart(period);
    if (start) {
      query = query.gte("created_at", start.toISOString());
    }

    const DATA_LIMIT = 50000;
    const { data, error } = await query.limit(DATA_LIMIT);

    if (error) {
      console.error("Error fetching analytics:", error);
      toast({ title: "Error", description: "Failed to load analytics data.", variant: "destructive" });
      setViews([]);
    } else {
      setViews(data || []);
      setDataTruncated((data?.length || 0) >= DATA_LIMIT);
    }
    setRecentPage(1);
    setLoading(false);
  }, [period, toast]);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  // --- Stats ---
  const stats = useMemo(() => {
    const totalViews = views.length;
    const uniqueVisitors = new Set(views.map((v) => v.visitor_id || v.visitor_hash)).size;

    // Top page
    const pageCounts = new Map<string, number>();
    for (const v of views) {
      pageCounts.set(v.page_path, (pageCounts.get(v.page_path) || 0) + 1);
    }
    let topPage = "—";
    let topPageCount = 0;
    pageCounts.forEach((count, path) => {
      if (count > topPageCount) {
        topPage = path;
        topPageCount = count;
      }
    });

    // Top country
    const countryCounts = new Map<string, number>();
    for (const v of views) {
      if (v.country) {
        countryCounts.set(v.country, (countryCounts.get(v.country) || 0) + 1);
      }
    }
    let topCountry = "—";
    let topCountryCount = 0;
    countryCounts.forEach((count, country) => {
      if (count > topCountryCount) {
        topCountry = country;
        topCountryCount = count;
      }
    });

    return { totalViews, uniqueVisitors, topPage, topPageCount, topCountry, topCountryCount };
  }, [views]);

  // --- Views per day (for chart) ---
  const dailyViews = useMemo(() => {
    const dayCounts = new Map<string, number>();
    for (const v of views) {
      const day = v.created_at.slice(0, 10);
      dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
    }
    const sorted = Array.from(dayCounts.entries()).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return sorted;
  }, [views]);

  const maxDailyViews = useMemo(
    () => Math.max(1, ...dailyViews.map(([, c]) => c)),
    [dailyViews]
  );

  // --- Top pages ---
  const topPages = useMemo(() => {
    const counts = new Map<string, { count: number; title: string | null }>();
    for (const v of views) {
      const existing = counts.get(v.page_path);
      if (existing) {
        existing.count++;
      } else {
        counts.set(v.page_path, { count: 1, title: v.page_title });
      }
    }
    return Array.from(counts.entries())
      .map(([path, { count, title }]) => ({ path, count, title }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [views]);

  // --- Devices ---
  const devices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of views) {
      const dt = v.device_type || "unknown";
      counts.set(dt, (counts.get(dt) || 0) + 1);
    }
    const total = views.length || 1;
    return Array.from(counts.entries())
      .map(([type, count]) => ({
        type,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [views]);

  // --- Browsers ---
  const browsers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of views) {
      const b = v.browser || "Unknown";
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [views]);

  // --- OS ---
  const operatingSystems = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of views) {
      const o = v.os || "Unknown";
      counts.set(o, (counts.get(o) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [views]);

  // --- Referrers ---
  const referrers = useMemo(() => {
    const counts = new Map<string, number>();
    let directCount = 0;
    for (const v of views) {
      const ref = v.referrer;
      const isSelf = ref && SELF_DOMAINS.some((d: string) => ref.includes(d));
      if (ref && !isSelf) {
        counts.set(ref, (counts.get(ref) || 0) + 1);
      } else {
        directCount++;
      }
    }
    const result = Array.from(counts.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count);
    if (directCount > 0) {
      result.push({ domain: "Direct", count: directCount });
      result.sort((a, b) => b.count - a.count);
    }
    return result.slice(0, 10);
  }, [views]);

  // --- Countries ---
  const countries = useMemo(() => {
    const counts = new Map<string, { count: number; code: string | null }>();
    for (const v of views) {
      const name = v.country || "Unknown";
      const existing = counts.get(name);
      if (existing) {
        existing.count++;
      } else {
        counts.set(name, { count: 1, code: v.country_code });
      }
    }
    const total = views.length || 1;
    return Array.from(counts.entries())
      .map(([country, { count, code }]) => ({
        country,
        code,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [views]);

  const deviceIcon = (type: string) => {
    switch (type) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Storefront page views &amp; visitor insights
          </p>
        </div>
      </div>

      {/* Period Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : views.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No data yet</h3>
          <p className="text-muted-foreground mt-1">
            Page views will appear here once visitors start browsing your
            storefront.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-sm">Total Views</span>
                </div>
                <p className="text-2xl font-bold">
                  {stats.totalViews.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Unique Visitors</span>
                </div>
                <p className="text-2xl font-bold">
                  {stats.uniqueVisitors.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">Top Page</span>
                </div>
                <p className="text-sm font-bold truncate" title={stats.topPage}>
                  {stats.topPage}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stats.topPageCount.toLocaleString()} views
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Globe className="h-4 w-4" />
                  <span className="text-sm">Top Country</span>
                </div>
                <p className="text-sm font-bold">{stats.topCountry}</p>
                <p className="text-xs text-muted-foreground">
                  {stats.topCountryCount.toLocaleString()} views
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Views Chart */}
          {dailyViews.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Views Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-40">
                  {dailyViews.map(([day, count]) => (
                    <div
                      key={day}
                      className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {count}
                      </span>
                      <div
                        className="w-full bg-primary rounded-t min-h-[4px]"
                        style={{
                          height: `${(count / maxDailyViews) * 120}px`,
                        }}
                      />
                      <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                        {formatDate(day)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tables Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Pages */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Top Pages
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead className="text-right w-20">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPages.map((page) => (
                      <TableRow key={page.path}>
                        <TableCell>
                          <div className="min-w-0">
                            <a
                              href={page.path}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium hover:underline flex items-center gap-1.5"
                            >
                              <span className="truncate">
                                {page.title || (page.path === "/" ? "Home" : page.path)}
                              </span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                            </a>
                            <span className="text-xs text-muted-foreground truncate block">
                              {page.path}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {page.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Referrers */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Referrers
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right w-16">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={2}
                          className="text-center text-muted-foreground"
                        >
                          No referrer data
                        </TableCell>
                      </TableRow>
                    ) : (
                      referrers.map((ref) => (
                        <TableRow key={ref.domain}>
                          <TableCell className="text-sm truncate">
                            {ref.domain}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {ref.count.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Devices & Countries */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Devices */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Devices
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {devices.map((d) => (
                  <div key={d.type} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 capitalize">
                        {deviceIcon(d.type)}
                        {d.type}
                      </div>
                      <span className="text-muted-foreground">
                        {d.percent}% ({d.count.toLocaleString()})
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Browsers & OS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Browsers &amp; OS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Browser</TableHead>
                      <TableHead className="text-right w-16">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {browsers.map((b) => (
                      <TableRow key={b.name}>
                        <TableCell className="text-sm">{b.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {b.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t" />
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>OS</TableHead>
                      <TableHead className="text-right w-16">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operatingSystems.map((o) => (
                      <TableRow key={o.name}>
                        <TableCell className="text-sm">{o.name}</TableCell>
                        <TableCell className="text-right font-medium">
                          {o.count.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Countries */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">
                  Countries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {countries.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No country data
                  </p>
                ) : (
                  countries.slice(0, 10).map((c) => (
                    <div key={c.country} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center">
                          <CountryBadge code={c.code} />
                          {c.country}
                        </span>
                        <span className="text-muted-foreground">
                          {c.percent}% ({c.count.toLocaleString()})
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${c.percent}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Data truncation warning */}
          {dataTruncated && (
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Data limit reached. Showing first 50,000 records. Use a shorter time period for complete data.
            </div>
          )}

          {/* Recent Visitors */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Visitors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Time</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="font-mono text-xs">IP</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Referrer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {views.slice((recentPage - 1) * 20, recentPage * 20).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(v.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <span className="text-sm truncate block" title={v.page_title || v.page_path}>
                            {v.page_title || (v.page_path === "/" ? "Home" : v.page_path)}
                          </span>
                          <span className="text-xs text-muted-foreground truncate block">{v.page_path}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <CountryBadge code={v.country_code} />
                            <div>
                              {v.city ? (
                                <span className="text-sm">{v.city}{v.region ? `, ${v.region}` : ""}</span>
                              ) : (
                                <span className="text-sm">{v.country || "—"}</span>
                              )}
                              {v.city && v.country && (
                                <span className="text-xs text-muted-foreground block">{v.country}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {v.ip_address || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs capitalize">
                            {deviceIcon(v.device_type || "desktop")}
                            <span>{v.device_type || "?"}</span>
                            {v.browser && <span className="text-muted-foreground">· {v.browser}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(() => {
                            const ref = v.referrer;
                            const isSelf = ref && SELF_DOMAINS.some((d: string) => ref.includes(d));
                            return isSelf || !ref ? "Direct" : ref;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination */}
              {views.length > 20 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-muted-foreground">
                    {(recentPage - 1) * 20 + 1}&ndash;{Math.min(recentPage * 20, views.length)} of {views.length.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                      disabled={recentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Prev
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {recentPage} / {Math.ceil(views.length / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRecentPage((p) => Math.min(Math.ceil(views.length / 20), p + 1))}
                      disabled={recentPage >= Math.ceil(views.length / 20)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

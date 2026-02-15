"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
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
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";

const ComposableMap = dynamic(
  () => import("react-simple-maps").then((m) => m.ComposableMap),
  { ssr: false }
);
const Geographies = dynamic(
  () => import("react-simple-maps").then((m) => m.Geographies),
  { ssr: false }
);
const Geography = dynamic(
  () => import("react-simple-maps").then((m) => m.Geography),
  { ssr: false }
);

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

function CountryBadge({ code }: { code: string | null }) {
  if (!code) return null;
  return (
    <span className="inline-flex items-center justify-center text-[10px] font-bold bg-muted rounded px-1 py-0.5 leading-none font-mono mr-1">
      {code.toUpperCase()}
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

  const fetchViews = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("page_views")
      .select("*")
      .order("created_at", { ascending: false });

    const start = getPeriodStart(period);
    if (start) {
      query = query.gte("created_at", start.toISOString());
    }

    const { data, error } = await query.limit(10000);

    if (error) {
      console.error("Error fetching analytics:", error);
      setViews([]);
    } else {
      setViews(data || []);
    }
    setLoading(false);
  }, [period]);

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

  const SELF_DOMAINS = ["onrender.com", "vercel.app", "localhost"];

  // --- Referrers ---
  const referrers = useMemo(() => {
    const counts = new Map<string, number>();
    let directCount = 0;
    for (const v of views) {
      const ref = v.referrer;
      const isSelf = ref && SELF_DOMAINS.some(d => ref.includes(d));
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

  // Map ISO-2 country codes to counts for the map
  const countryCodeMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of views) {
      if (v.country_code) {
        const code = v.country_code.toUpperCase();
        map.set(code, (map.get(code) || 0) + 1);
      }
    }
    return map;
  }, [views]);

  const maxCountryViews = useMemo(
    () => Math.max(1, ...Array.from(countryCodeMap.values())),
    [countryCodeMap]
  );

  // Numeric ISO code → ISO-2 mapping for world-atlas TopoJSON
  const numToIso2: Record<string, string> = {
    "004":"AF","008":"AL","012":"DZ","024":"AO","032":"AR","036":"AU","040":"AT",
    "050":"BD","056":"BE","064":"BT","068":"BO","070":"BA","072":"BW","076":"BR",
    "100":"BG","104":"MM","112":"BY","116":"KH","120":"CM","124":"CA","140":"CF",
    "144":"LK","148":"TD","152":"CL","156":"CN","170":"CO","178":"CG","180":"CD",
    "188":"CR","191":"HR","192":"CU","196":"CY","203":"CZ","208":"DK","214":"DO",
    "218":"EC","818":"EG","222":"SV","231":"ET","233":"EE","246":"FI","250":"FR",
    "268":"GE","276":"DE","288":"GH","300":"GR","320":"GT","332":"HT","340":"HN",
    "348":"HU","352":"IS","356":"IN","360":"ID","364":"IR","368":"IQ","372":"IE",
    "376":"IL","380":"IT","388":"JM","392":"JP","398":"KZ","400":"JO","404":"KE",
    "410":"KR","414":"KW","418":"LA","422":"LB","428":"LV","434":"LY","440":"LT",
    "442":"LU","458":"MY","466":"ML","484":"MX","496":"MN","498":"MD","504":"MA",
    "508":"MZ","512":"OM","516":"NA","524":"NP","528":"NL","554":"NZ","558":"NI",
    "562":"NE","566":"NG","578":"NO","586":"PK","591":"PA","600":"PY","604":"PE",
    "608":"PH","616":"PL","620":"PT","634":"QA","642":"RO","643":"RU","682":"SA",
    "686":"SN","688":"RS","702":"SG","703":"SK","704":"VN","705":"SI","706":"SO",
    "710":"ZA","724":"ES","729":"SD","752":"SE","756":"CH","760":"SY","764":"TH",
    "780":"TT","784":"AE","788":"TN","792":"TR","800":"UG","804":"UA","826":"GB",
    "834":"TZ","840":"US","854":"BF","858":"UY","860":"UZ","862":"VE","887":"YE",
    "894":"ZM",
  };

  function getCountryFill(geoId: string): string {
    const iso2 = numToIso2[geoId];
    if (!iso2) return "hsl(220, 10%, 94%)";
    const count = countryCodeMap.get(iso2);
    if (!count) return "hsl(220, 10%, 94%)";
    const intensity = Math.min(1, count / maxCountryViews);
    const lightness = Math.round(88 - intensity * 55);
    return `hsl(221, 83%, ${lightness}%)`;
  }

  function getCountryTooltip(geoId: string, geoName: string): string {
    const iso2 = numToIso2[geoId];
    if (!iso2) return geoName;
    const count = countryCodeMap.get(iso2);
    if (!count) return geoName;
    return `${geoName}: ${count.toLocaleString()} views`;
  }

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

          {/* Visitor Map */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Visitor Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-hidden rounded-b-lg">
              {countryCodeMap.size === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No location data yet
                </p>
              ) : (
                <div className="bg-sky-50 dark:bg-slate-900">
                  <ComposableMap
                    projectionConfig={{ scale: 155, center: [0, 10] }}
                    style={{ width: "100%", height: "auto" }}
                  >
                    <Geographies geography={GEO_URL}>
                      {({ geographies }: { geographies: Array<{ rsmKey: string; id: string; properties: { name: string } }> }) =>
                        geographies.map((geo) => (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getCountryFill(geo.id)}
                            stroke="#fff"
                            strokeWidth={0.4}
                            style={{
                              default: { outline: "none" },
                              hover: { fill: "hsl(221, 83%, 40%)", outline: "none", cursor: "pointer" },
                              pressed: { outline: "none" },
                            }}
                          >
                            <title>{getCountryTooltip(geo.id, geo.properties.name)}</title>
                          </Geography>
                        ))
                      }
                    </Geographies>
                  </ComposableMap>
                  <div className="flex items-center justify-end gap-2 px-4 py-2 text-xs text-muted-foreground">
                    <span>Few</span>
                    {[88, 72, 56, 40, 33].map((l) => (
                      <div
                        key={l}
                        className="w-4 h-3 rounded-sm"
                        style={{ background: `hsl(221, 83%, ${l}%)` }}
                      />
                    ))}
                    <span>Many</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

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
                    {views.slice(0, 50).map((v) => (
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
                            const isSelf = ref && SELF_DOMAINS.some(d => ref.includes(d));
                            return isSelf || !ref ? "Direct" : ref;
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

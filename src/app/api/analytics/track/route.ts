import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Service role client for INSERT (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// In-memory rate limiter
const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW = 60_000;
const RATE_MAX = 30;

// In-memory geo cache (24h TTL)
const geoCache = new Map<
  string,
  {
    country: string | null;
    countryCode: string | null;
    city: string | null;
    region: string | null;
    expiresAt: number;
  }
>();

function getDailySalt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `pv-${today}-${process.env.ANALYTICS_SALT || "hpr"}`;
}

function hashIP(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(ip + getDailySalt())
    .digest("hex");
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const key = hashIP(ip);
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
}

function extractDomain(referrer: string): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}

function parseDevice(ua: string) {
  const lc = ua.toLowerCase();

  let device_type = "desktop";
  if (/mobile|android.*mobile|iphone|ipod/.test(lc)) device_type = "mobile";
  else if (/tablet|ipad|android(?!.*mobile)/.test(lc)) device_type = "tablet";

  let browser = "Other";
  if (lc.includes("edg/")) browser = "Edge";
  else if (lc.includes("chrome") && !lc.includes("edg")) browser = "Chrome";
  else if (lc.includes("firefox")) browser = "Firefox";
  else if (lc.includes("safari") && !lc.includes("chrome")) browser = "Safari";
  else if (lc.includes("opera") || lc.includes("opr/")) browser = "Opera";

  let os = "Other";
  if (lc.includes("windows")) os = "Windows";
  else if (lc.includes("mac os")) os = "macOS";
  else if (lc.includes("iphone") || lc.includes("ipad")) os = "iOS";
  else if (lc.includes("android")) os = "Android";
  else if (lc.includes("linux")) os = "Linux";

  return { device_type, browser, os };
}

async function lookupGeo(ip: string): Promise<{
  country: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
}> {
  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.expiresAt) {
    return {
      country: cached.country,
      countryCode: cached.countryCode,
      city: cached.city,
      region: cached.region,
    };
  }

  // Try ipapi.co first (HTTPS, works from cloud)
  const endpoints = [
    {
      url: `https://ipapi.co/${ip}/json/`,
      parse: (geo: Record<string, string>) => ({
        country: geo.country_name || null,
        countryCode: geo.country_code || null,
        city: geo.city || null,
        region: geo.region || null,
      }),
    },
    {
      url: `http://ip-api.com/json/${ip}?fields=country,countryCode,city,regionName`,
      parse: (geo: Record<string, string>) => ({
        country: geo.country || null,
        countryCode: geo.countryCode || null,
        city: geo.city || null,
        region: geo.regionName || null,
      }),
    },
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint.url, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const geo = await res.json();
        if (geo.error || geo.status === "fail") continue;
        const result = endpoint.parse(geo);
        if (result.country) {
          geoCache.set(ip, {
            ...result,
            expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          });
          return result;
        }
      }
    } catch {
      continue;
    }
  }

  return { country: null, countryCode: null, city: null, region: null };
}

// Periodic cleanup (every 5 min)
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((timestamps, key) => {
    const recent = timestamps.filter((t: number) => now - t < RATE_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, recent);
  });
  geoCache.forEach((entry, key) => {
    if (now >= entry.expiresAt) geoCache.delete(key);
  });
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return NextResponse.json({ ok: true });

    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: true });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: true });
    }

    const path = typeof body.path === "string" ? body.path.slice(0, 500) : "";
    const title = typeof body.title === "string" ? body.title.slice(0, 500) : "";
    const referrer = typeof body.referrer === "string" ? body.referrer : "";
    const visitorId =
      typeof body.visitor_id === "string" && body.visitor_id.length <= 36
        ? body.visitor_id
        : null;

    if (!path) return NextResponse.json({ ok: true });

    // Only track storefront pages
    if (
      path.startsWith("/admin") ||
      path.startsWith("/api") ||
      path.startsWith("/login") ||
      path.startsWith("/_next")
    ) {
      return NextResponse.json({ ok: true });
    }

    const visitorHash = hashIP(ip);
    const referrerDomain = extractDomain(referrer);
    const ua = request.headers.get("user-agent") || "";
    const { device_type, browser, os } = parseDevice(ua);

    // Geo lookup (cached, non-blocking timeout)
    let country: string | null = null;
    let countryCode: string | null = null;
    let city: string | null = null;
    let region: string | null = null;
    if (ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
      const geo = await lookupGeo(ip);
      country = geo.country;
      countryCode = geo.countryCode;
      city = geo.city;
      region = geo.region;
    }

    // Treat own domain as direct (no referrer)
    const ownDomains = ["parts-inventory.onrender.com", "localhost"];
    const cleanReferrer = referrerDomain && !ownDomains.some(d => referrerDomain.includes(d))
      ? referrerDomain
      : null;

    await adminClient.from("page_views").insert({
      page_path: path,
      page_title: title || null,
      ip_address: ip !== "unknown" ? ip : null,
      visitor_hash: visitorHash,
      visitor_id: visitorId,
      referrer: cleanReferrer,
      device_type,
      browser,
      os,
      country,
      country_code: countryCode,
      city,
      region,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

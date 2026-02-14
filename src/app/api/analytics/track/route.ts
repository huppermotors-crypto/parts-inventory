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
  { country: string | null; countryCode: string | null; expiresAt: number }
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

async function lookupCountry(
  ip: string
): Promise<{ country: string | null; countryCode: string | null }> {
  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.expiresAt) {
    return { country: cached.country, countryCode: cached.countryCode };
  }

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=country,countryCode`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (res.ok) {
      const geo = await res.json();
      const result = {
        country: (geo.country as string) || null,
        countryCode: (geo.countryCode as string) || null,
      };
      geoCache.set(ip, {
        ...result,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      return result;
    }
  } catch {
    /* silent */
  }

  return { country: null, countryCode: null };
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
    if (ip !== "unknown" && ip !== "127.0.0.1" && ip !== "::1") {
      const geo = await lookupCountry(ip);
      country = geo.country;
      countryCode = geo.countryCode;
    }

    await adminClient.from("page_views").insert({
      page_path: path,
      page_title: title || null,
      visitor_hash: visitorHash,
      referrer: referrerDomain,
      device_type,
      browser,
      os,
      country,
      country_code: countryCode,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

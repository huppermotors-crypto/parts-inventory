import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Cache the application token in memory (expires ~2 hours)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getApplicationToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("eBay API credentials not configured");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const isProduction = process.env.EBAY_ENVIRONMENT === "PRODUCTION";
  const tokenUrl = isProduction
    ? "https://api.ebay.com/identity/v1/oauth2/token"
    : "https://api.sandbox.ebay.com/identity/v1/oauth2/token";

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }),
  });

  if (!response.ok) {
    throw new Error(`eBay token request failed: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return cachedToken.token;
}

export async function GET(request: NextRequest) {
  // Auth check — only logged-in users
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const limit = searchParams.get("limit") || "12";
  const minPrice = searchParams.get("minPrice");
  const sort = searchParams.get("sort") || "BEST_MATCH";

  if (!q || q.length > 200) {
    return NextResponse.json(
      { error: "Invalid search query" },
      { status: 400 }
    );
  }

  try {
    const token = await getApplicationToken();

    const isProduction = process.env.EBAY_ENVIRONMENT === "PRODUCTION";
    const apiBase = isProduction
      ? "https://api.ebay.com"
      : "https://api.sandbox.ebay.com";

    // Build filters
    const filters = ["buyingOptions:{FIXED_PRICE}"];
    if (minPrice) {
      filters.push(`price:[${minPrice}]`);
    }

    const params = new URLSearchParams({
      q,
      limit,
      category_ids: "6000", // eBay Motors > Parts & Accessories
      filter: filters.join(","),
      sort: sort === "price" ? "price" : "",
    });

    // Remove empty sort param (BEST_MATCH is default when no sort specified)
    if (sort !== "price") {
      params.delete("sort");
    }

    const response = await fetch(
      `${apiBase}/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        },
        next: { revalidate: 300 },
      }
    );

    if (!response.ok) {
      console.error("eBay search error:", response.status);
      return NextResponse.json(
        { error: "eBay search failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    const items = (data.itemSummaries || []).map(
      (item: Record<string, unknown>) => ({
        title: item.title,
        price:
          (item.price as Record<string, unknown>)?.value != null
            ? parseFloat((item.price as Record<string, unknown>).value as string)
            : null,
        currency:
          ((item.price as Record<string, unknown>)?.currency as string) || "USD",
        condition: item.condition,
        image:
          (
            item.thumbnailImages as Array<Record<string, unknown>> | undefined
          )?.[0]?.imageUrl ||
          (item.image as Record<string, unknown>)?.imageUrl ||
          null,
        itemWebUrl: item.itemWebUrl,
        itemId: item.itemId,
      })
    );

    return NextResponse.json({
      items,
      total: data.total || 0,
    });
  } catch (error) {
    console.error("eBay search error:", error);
    return NextResponse.json(
      { error: "Failed to search eBay" },
      { status: 500 }
    );
  }
}

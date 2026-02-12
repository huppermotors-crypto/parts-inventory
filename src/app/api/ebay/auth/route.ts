import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEbayClient } from "@/lib/ebay-server";

export async function GET() {
  // Auth check
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const ebay = getEbayClient();
    const authUrl = ebay.OAuth2.generateAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("eBay auth error:", error);
    return NextResponse.json(
      { error: "Failed to generate eBay auth URL" },
      { status: 500 }
    );
  }
}

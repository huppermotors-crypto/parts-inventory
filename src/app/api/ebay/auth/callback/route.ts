import { NextRequest, NextResponse } from "next/server";
import { getEbayClient } from "@/lib/ebay-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "No authorization code provided" },
      { status: 400 }
    );
  }

  try {
    const ebay = getEbayClient();
    const tokenResponse = await ebay.OAuth2.getToken(code);

    return NextResponse.json({
      message: "eBay authorization successful!",
      refresh_token: tokenResponse.refresh_token,
      instructions:
        "Add this refresh_token as EBAY_REFRESH_TOKEN in your environment variables.",
    });
  } catch (error) {
    console.error("eBay OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to exchange authorization code" },
      { status: 500 }
    );
  }
}

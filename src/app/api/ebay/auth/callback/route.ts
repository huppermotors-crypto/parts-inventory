import { NextRequest, NextResponse } from "next/server";
import { getEbayClient } from "@/lib/ebay-server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 400 }
    );
  }

  try {
    const ebay = getEbayClient();
    const tokenResponse = await ebay.OAuth2.getToken(code);

    // Log token server-side only — never expose to client
    console.log("eBay refresh_token obtained. Add to EBAY_REFRESH_TOKEN env var:");
    console.log(tokenResponse.refresh_token);

    return NextResponse.json({
      message: "eBay authorization successful! Check server logs for the refresh token.",
    });
  } catch (error) {
    console.error("eBay OAuth callback error:", error);
    return NextResponse.json(
      { error: "Authorization failed. Please try again." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEbayClient } from "@/lib/ebay-server";
import { getEbayCategoryId, getEbayCondition } from "@/lib/ebay-mappings";

export async function POST(request: NextRequest) {
  // Auth check
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { partId } = body;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!partId || typeof partId !== "string" || !uuidRegex.test(partId)) {
    return NextResponse.json(
      { error: "Invalid part ID" },
      { status: 400 }
    );
  }

  // Fetch part data
  const { data: part, error: fetchError } = await supabase
    .from("parts")
    .select("*")
    .eq("id", partId)
    .single();

  if (fetchError || !part) {
    return NextResponse.json({ error: "Part not found" }, { status: 404 });
  }

  if (part.ebay_listing_id) {
    return NextResponse.json(
      {
        error: "Part is already listed on eBay",
        ebay_listing_url: part.ebay_listing_url,
      },
      { status: 409 }
    );
  }

  try {
    const ebay = getEbayClient();
    const sku = `PARTS-${part.id}`;
    const ebayCategoryId = getEbayCategoryId(part.category);
    const ebayCondition = getEbayCondition(part.condition);

    // Build title (eBay max 80 chars)
    const titleParts = [part.year, part.make, part.model, part.name].filter(
      Boolean
    );
    const title = titleParts.join(" ").slice(0, 80);

    // Build aspects object for eBay (typed as `any` due to incorrect package typings)
    const aspects: Record<string, string[]> = {};
    if (part.make) aspects["Brand"] = [part.make];
    if (part.serial_number)
      aspects["Manufacturer Part Number"] = [part.serial_number];

    // Create/Replace Inventory Item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await ebay.sell.inventory.createOrReplaceInventoryItem(sku, {
      availability: {
        shipToLocationAvailability: { quantity: 1 },
      },
      condition: ebayCondition.id,
      conditionDescription: ebayCondition.description,
      product: {
        title,
        description: part.description || title,
        imageUrls: part.photos || [],
        aspects: aspects as unknown as string,
      },
    });

    // Create Offer
    const offerResponse = await ebay.sell.inventory.createOffer({
      sku,
      marketplaceId: "EBAY_US",
      format: "FIXED_PRICE",
      listingDescription: part.description || title,
      availableQuantity: 1,
      categoryId: ebayCategoryId,
      pricingSummary: {
        price: {
          value: part.price.toString(),
          currency: "USD",
        },
      },
      listingPolicies: {
        fulfillmentPolicyId: process.env.EBAY_FULFILLMENT_POLICY_ID!,
        paymentPolicyId: process.env.EBAY_PAYMENT_POLICY_ID!,
        returnPolicyId: process.env.EBAY_RETURN_POLICY_ID!,
      },
      merchantLocationKey: process.env.EBAY_MERCHANT_LOCATION_KEY,
    });

    const offerId = offerResponse.offerId;

    // Publish Offer
    const publishResponse = await ebay.sell.inventory.publishOffer(offerId);
    const listingId = publishResponse.listingId;

    // Update part record with eBay info
    const isProduction = process.env.EBAY_ENVIRONMENT === "PRODUCTION";
    const ebayDomain = isProduction
      ? "www.ebay.com"
      : "www.sandbox.ebay.com";
    const listingUrl = `https://${ebayDomain}/itm/${listingId}`;

    await supabase
      .from("parts")
      .update({
        ebay_listing_id: listingId,
        ebay_offer_id: offerId,
        ebay_listing_url: listingUrl,
        ebay_listed_at: new Date().toISOString(),
      })
      .eq("id", partId);

    return NextResponse.json({
      success: true,
      listingId,
      offerId,
      listingUrl,
    });
  } catch (error: unknown) {
    console.error("eBay listing error:", error);
    return NextResponse.json(
      { error: "Failed to create eBay listing. Please try again." },
      { status: 500 }
    );
  }
}

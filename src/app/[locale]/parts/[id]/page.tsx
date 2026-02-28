import { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PartDetailClient } from "@/components/storefront/part-detail-client";
import { getConditionLabel } from "@/lib/constants";
import { applyPriceRules } from "@/lib/price-rules";
import { PriceRule } from "@/types/database";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://parts-inventory.onrender.com";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

async function getPart(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("parts")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();
  return data;
}

async function getActivePriceRules(): Promise<PriceRule[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("price_rules")
    .select("*")
    .eq("is_active", true);
  return (data || []) as PriceRule[];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params;
  const part = await getPart(id);

  if (!part) {
    return { title: "Part Not Found" };
  }

  const vehicle = [part.year, part.make, part.model].filter(Boolean).join(" ");
  const title = `${part.name}${vehicle ? ` - ${vehicle}` : ""}`;
  const description = part.description
    ? part.description.slice(0, 160)
    : `${part.name} for sale.${vehicle ? ` Fits ${vehicle}.` : ""} Condition: ${part.condition}. $${part.price}.`;

  const alternates: Record<string, string> = {};
  for (const loc of routing.locales) {
    alternates[loc] = `${BASE_URL}/${loc}/parts/${id}`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/${locale}/parts/${id}`,
      languages: alternates,
    },
    openGraph: {
      title,
      description,
      images: part.photos?.length
        ? [{ url: part.photos[0], width: 1200, height: 630 }]
        : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: part.photos?.length ? [part.photos[0]] : [],
    },
  };
}

export default async function PartDetailPage({ params }: Props) {
  const { id, locale } = await params;
  const [part, priceRules] = await Promise.all([
    getPart(id),
    getActivePriceRules(),
  ]);

  const priceResult = part ? applyPriceRules(part, priceRules) : null;
  const displayPrice = priceResult ? priceResult.finalPrice : (part?.price || 0);

  const jsonLd = part
    ? {
        "@context": "https://schema.org",
        "@type": "Product",
        name: part.name,
        description: part.description || undefined,
        image: part.photos?.length ? part.photos : undefined,
        sku: part.stock_number || undefined,
        offers: {
          "@type": "Offer",
          price: displayPrice,
          priceCurrency: "USD",
          availability: part.is_sold
            ? "https://schema.org/SoldOut"
            : "https://schema.org/InStock",
          itemCondition: part.condition === "new"
            ? "https://schema.org/NewCondition"
            : "https://schema.org/UsedCondition",
        },
        brand: part.make ? { "@type": "Brand", name: part.make } : undefined,
        itemCondition: getConditionLabel(part.condition),
        vehicle: part.year || part.make || part.model
          ? {
              "@type": "Vehicle",
              vehicleModelDate: part.year?.toString(),
              manufacturer: part.make || undefined,
              model: part.model || undefined,
            }
          : undefined,
      }
    : null;

  const breadcrumbJsonLd = part
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: `${BASE_URL}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: part.name,
            item: `${BASE_URL}/${locale}/parts/${id}`,
          },
        ],
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <PartDetailClient initialPart={part} priceRules={priceRules} />
    </>
  );
}

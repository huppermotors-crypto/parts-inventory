import { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PartDetailClient } from "@/components/storefront/part-detail-client";
import { getConditionLabel } from "@/lib/constants";

interface Props {
  params: { id: string };
}

async function getPart(id: string) {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("parts")
    .select("*")
    .eq("id", id)
    .eq("is_published", true)
    .single();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const part = await getPart(params.id);

  if (!part) {
    return { title: "Part Not Found" };
  }

  const vehicle = [part.year, part.make, part.model].filter(Boolean).join(" ");
  const title = `${part.name}${vehicle ? ` - ${vehicle}` : ""}`;
  const description = part.description
    ? part.description.slice(0, 160)
    : `${part.name} for sale.${vehicle ? ` Fits ${vehicle}.` : ""} Condition: ${part.condition}. $${part.price}.`;

  return {
    title,
    description,
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
  const part = await getPart(params.id);

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
          price: part.price,
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

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PartDetailClient initialPart={part} />
    </>
  );
}

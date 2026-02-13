import { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PartDetailClient } from "@/components/storefront/part-detail-client";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createServerSupabaseClient();
  const { data: part } = await supabase
    .from("parts")
    .select("*")
    .eq("id", params.id)
    .eq("is_published", true)
    .single();

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
  const supabase = createServerSupabaseClient();
  const { data: part } = await supabase
    .from("parts")
    .select("*")
    .eq("id", params.id)
    .eq("is_published", true)
    .single();

  return <PartDetailClient initialPart={part} />;
}

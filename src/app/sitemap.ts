import { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BASE_URL = "https://parts-inventory.onrender.com";
const locales = ['en', 'ru', 'es'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createServerSupabaseClient();

  const { data: parts } = await supabase
    .from("parts")
    .select("id, updated_at")
    .eq("is_published", true)
    .eq("is_sold", false)
    .order("created_at", { ascending: false });

  // Static pages × all locales
  const staticPages: MetadataRoute.Sitemap = locales.flatMap((locale) => [
    {
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: locale === 'en' ? 1 : 0.9,
    },
    {
      url: `${BASE_URL}/${locale}/shipping`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/${locale}/privacy`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
  ]);

  // Part pages × all locales
  const partPages: MetadataRoute.Sitemap = locales.flatMap((locale) =>
    (parts || []).map((part) => ({
      url: `${BASE_URL}/${locale}/parts/${part.id}`,
      lastModified: new Date(part.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  );

  return [...staticPages, ...partPages];
}

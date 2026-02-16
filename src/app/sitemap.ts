import { MetadataRoute } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BASE_URL = "https://parts-inventory.onrender.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerSupabaseClient();

  const { data: parts } = await supabase
    .from("parts")
    .select("id, updated_at")
    .eq("is_published", true)
    .eq("is_sold", false)
    .order("created_at", { ascending: false });

  const partPages: MetadataRoute.Sitemap = (parts || []).map((part) => ({
    url: `${BASE_URL}/parts/${part.id}`,
    lastModified: new Date(part.updated_at),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/shipping`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "monthly",
      priority: 0.2,
    },
    ...partPages,
  ];
}

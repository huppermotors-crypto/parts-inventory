import { createClient } from "@/lib/supabase/client";

const MAX_RETRIES = 3;

export async function getNextStockNumber(): Promise<string> {
  const supabase = createClient();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const { data } = await supabase
      .from("parts")
      .select("stock_number")
      .not("stock_number", "is", null)
      .order("stock_number", { ascending: false })
      .limit(1);

    const last = data?.[0]?.stock_number;
    const nextNum = last ? parseInt(last, 10) + 1 : 1;
    const candidate = nextNum.toString().padStart(4, "0");

    // Verify this stock number isn't already taken (race condition guard)
    const { data: existing } = await supabase
      .from("parts")
      .select("id")
      .eq("stock_number", candidate)
      .limit(1);

    if (!existing || existing.length === 0) {
      return candidate;
    }

    // Collision detected — retry with incremented number
    const fallback = (nextNum + attempt + 1).toString().padStart(4, "0");
    const { data: fallbackExists } = await supabase
      .from("parts")
      .select("id")
      .eq("stock_number", fallback)
      .limit(1);

    if (!fallbackExists || fallbackExists.length === 0) {
      return fallback;
    }
  }

  // Last resort: use timestamp-based stock number
  return Date.now().toString().slice(-6);
}

import { createClient } from "@/lib/supabase/client";

export async function getNextStockNumber(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("parts")
    .select("stock_number")
    .not("stock_number", "is", null)
    .order("stock_number", { ascending: false })
    .limit(1);

  const last = data?.[0]?.stock_number;
  const nextNum = last ? parseInt(last, 10) + 1 : 1;
  return nextNum.toString().padStart(4, "0");
}

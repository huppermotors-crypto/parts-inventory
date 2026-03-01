import { createClient } from "@/lib/supabase/client";

export type ActivityAction =
  | "part_created"
  | "part_updated"
  | "part_deleted"
  | "part_sold"
  | "part_unsold"
  | "part_published"
  | "part_unpublished"
  | "part_partial_sold"
  | "bulk_sold"
  | "bulk_available"
  | "bulk_deleted"
  | "bulk_price_update"
  | "lot_merged"
  | "fb_posted"
  | "fb_delisted"
  | "ebay_posted"
  | "ebay_delisted"
  | "photo_rotated"
  | "photo_cropped"
  | "settings_updated";

export async function logActivity(
  action: ActivityAction,
  details?: string,
  partId?: string
) {
  try {
    const supabase = createClient();
    await supabase.from("activity_log").insert({
      action,
      details: details || null,
      part_id: partId || null,
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

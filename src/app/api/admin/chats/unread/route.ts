import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "nvn9586@gmail.com";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ count: 0 });
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ count: 0 });
    }

    // Count sessions where status != 'closed' and has unread messages
    const { data: sessions } = await adminClient
      .from("chat_sessions")
      .select("id, updated_at, admin_last_read_at")
      .neq("status", "closed");

    const unread = (sessions || []).filter((s) => {
      if (!s.updated_at) return false;
      if (!s.admin_last_read_at) return true;
      return new Date(s.updated_at) > new Date(s.admin_last_read_at);
    });

    return NextResponse.json({ count: unread.length });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

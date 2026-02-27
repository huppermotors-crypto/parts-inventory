import { NextRequest, NextResponse } from "next/server";
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

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ sessions: [] });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "all";
    const search = searchParams.get("search") || "";

    // Fetch sessions
    let query = adminClient
      .from("chat_sessions")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: sessions, error } = await query;
    if (error) throw error;

    // For each session, get message count and last message
    const enriched = await Promise.all(
      (sessions || []).map(async (session) => {
        const { count } = await adminClient
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("session_id", session.id);

        const { data: lastMsg } = await adminClient
          .from("chat_messages")
          .select("content, role, created_at")
          .eq("session_id", session.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        return {
          ...session,
          message_count: count || 0,
          last_message: lastMsg || null,
        };
      })
    );

    // Filter by search text if provided
    let filtered = enriched;
    if (search) {
      const q = search.toLowerCase();
      filtered = enriched.filter((s) => {
        const ctx = s.part_context;
        return (
          s.visitor_id?.toLowerCase().includes(q) ||
          ctx?.name?.toLowerCase().includes(q) ||
          ctx?.make?.toLowerCase().includes(q) ||
          ctx?.model?.toLowerCase().includes(q) ||
          s.last_message?.content?.toLowerCase().includes(q)
        );
      });
    }

    return NextResponse.json({ sessions: filtered });
  } catch (err) {
    console.error("Admin chats error:", err);
    return NextResponse.json({ sessions: [] });
  }
}

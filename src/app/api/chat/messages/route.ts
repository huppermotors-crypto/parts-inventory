import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ messages: [] });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const visitorId = searchParams.get("visitorId");
    const after = searchParams.get("after");

    if (!sessionId || !visitorId) {
      return NextResponse.json({ messages: [] });
    }

    // Verify session belongs to this visitor
    const { data: session } = await adminClient
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("visitor_id", visitorId)
      .single();

    if (!session) {
      return NextResponse.json({ messages: [] });
    }

    let query = adminClient
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (after) {
      query = query.gt("created_at", after);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Chat messages fetch error:", error);
      return NextResponse.json({ messages: [] });
    }

    return NextResponse.json({ messages: data || [] });
  } catch (err) {
    console.error("Chat messages error:", err);
    return NextResponse.json({ messages: [] });
  }
}

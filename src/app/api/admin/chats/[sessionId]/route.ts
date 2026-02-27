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

async function checkAdmin() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email === ADMIN_EMAIL;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ messages: [] });
    }

    const { sessionId } = await params;

    // Get session info
    const { data: session } = await adminClient
      .from("chat_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    // Get all messages
    const { data: messages, error } = await adminClient
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    // Mark as read
    await adminClient
      .from("chat_sessions")
      .update({ admin_last_read_at: new Date().toISOString() })
      .eq("id", sessionId);

    return NextResponse.json({
      session: session || null,
      messages: messages || [],
    });
  } catch (err) {
    console.error("Admin chat messages error:", err);
    return NextResponse.json({ messages: [] });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    if (!(await checkAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const { sessionId } = await params;
    const body = await request.json();
    const { status } = body;

    if (!["active", "escalated", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("chat_sessions")
      .update({ status })
      .eq("id", sessionId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin chat status update error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

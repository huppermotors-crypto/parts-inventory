import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendToTelegram } from "@/lib/chat/telegram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: NextRequest) {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) return NextResponse.json({ ok: true });

    const { sessionId, visitorId } = await request.json();
    if (!sessionId || !visitorId) return NextResponse.json({ ok: true });

    // Verify session belongs to this visitor
    const { data: session } = await adminClient
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("visitor_id", visitorId)
      .single();

    if (!session) {
      return NextResponse.json({ ok: true });
    }

    // Load full conversation
    const { data: messages } = await adminClient
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) return NextResponse.json({ ok: true });

    // Update session status to closed
    await adminClient
      .from("chat_sessions")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    // Send session log summary to Telegram
    const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
    if (ADMIN_CHAT_ID && ADMIN_CHAT_ID !== "placeholder") {
      const lines: string[] = [
        `📋 <b>Chat session ended</b> (${messages.length} messages)`,
        `🆔 Session: ${sessionId}`,
        "",
        "💬 <b>Last messages:</b>",
      ];

      const recent = messages.slice(-10);
      for (const m of recent) {
        const label =
          m.role === "user" ? "👤 Customer" : m.role === "operator" ? "👨‍💼 Operator" : "🤖 AI";
        lines.push(`${label}: ${(m.content as string).slice(0, 150)}`);
      }

      sendToTelegram(ADMIN_CHAT_ID, lines.join("\n")).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Chat end error:", err);
    return NextResponse.json({ ok: true });
  }
}

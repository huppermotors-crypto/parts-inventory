import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (skip if not configured)
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const secret = request.headers.get("x-telegram-bot-api-secret-token");
      if (secret !== webhookSecret) {
        console.error("[Telegram webhook] Secret mismatch");
        return NextResponse.json({ ok: false }, { status: 403 });
      }
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ ok: true });
    }

    const update = await request.json();
    const msg = update.message;

    if (!msg?.text) {
      return NextResponse.json({ ok: true });
    }

    let sessionId: string | null = null;

    // Method 1: Extract session ID from reply to escalation message
    if (msg.reply_to_message?.text) {
      const sessionMatch = msg.reply_to_message.text.match(
        /Session:\s*([a-f0-9-]+)/i
      );
      if (sessionMatch) {
        sessionId = sessionMatch[1];
      }
    }

    // Method 2: Find most recent escalated session (for direct messages)
    if (!sessionId) {
      const { data: recentSession } = await adminClient
        .from("chat_sessions")
        .select("id")
        .eq("status", "escalated")
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (recentSession) {
        sessionId = recentSession.id;
      }
    }

    if (!sessionId) {
      console.log("[Telegram webhook] No session found for operator reply");
      return NextResponse.json({ ok: true });
    }

    // Save operator message
    const { error: insertErr } = await adminClient
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "operator",
        content: msg.text,
      });

    if (insertErr) {
      console.error("[Telegram webhook] Insert error:", insertErr);
      return NextResponse.json({ ok: true });
    }

    // Update session with telegram chat id
    await adminClient
      .from("chat_sessions")
      .update({
        telegram_chat_id: msg.chat.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    console.log("[Telegram webhook] Operator reply saved for session:", sessionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Telegram webhook] Error:", err);
    return NextResponse.json({ ok: true });
  }
}

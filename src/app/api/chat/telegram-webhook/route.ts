import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get("x-telegram-bot-api-secret-token");
    if (!webhookSecret || secret !== webhookSecret) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json({ ok: true });
    }

    const update = await request.json();

    // Extract message text from Telegram update
    const msg = update.message;
    if (!msg?.text || !msg.reply_to_message?.text) {
      // Only handle replies (operator replying to an escalation)
      return NextResponse.json({ ok: true });
    }

    // Extract session ID from the original escalation message
    const sessionMatch = msg.reply_to_message.text.match(/Session:\s*([a-f0-9-]+)/i);
    if (!sessionMatch) {
      return NextResponse.json({ ok: true });
    }

    const sessionId = sessionMatch[1];

    // Verify session exists
    const { data: session } = await adminClient
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ ok: true });
    }

    // Save operator message
    await adminClient.from("chat_messages").insert({
      session_id: sessionId,
      role: "operator",
      content: msg.text,
    });

    // Update session
    await adminClient
      .from("chat_sessions")
      .update({
        telegram_chat_id: msg.chat.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook error:", err);
    return NextResponse.json({ ok: true });
  }
}

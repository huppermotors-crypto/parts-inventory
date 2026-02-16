import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askGemini } from "@/lib/chat/gemini";
import { escalateToOperator } from "@/lib/chat/telegram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// Rate limiter: 10 messages/min per visitorId
const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW = 60_000;
const RATE_MAX = 10;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= RATE_MAX) return true;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
}

// Track consecutive AI failures per session for auto-escalation
const failureMap = new Map<string, number>();

// Cleanup every 5 min
setInterval(() => {
  const now = Date.now();
  rateLimitMap.forEach((timestamps, key) => {
    const recent = timestamps.filter((t: number) => now - t < RATE_WINDOW);
    if (recent.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, recent);
  });
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const adminClient = getAdminClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const visitorId =
      typeof body.visitorId === "string" ? body.visitorId.slice(0, 100) : "";
    const message =
      typeof body.message === "string" ? body.message.slice(0, 2000) : "";
    const sessionId =
      typeof body.sessionId === "string" ? body.sessionId : null;
    const partContext = body.partContext || null;

    if (!visitorId || !message) {
      return NextResponse.json(
        { error: "Missing visitorId or message" },
        { status: 400 }
      );
    }

    if (isRateLimited(visitorId)) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429 }
      );
    }

    // Get or create session
    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const { data: session, error: sessionErr } = await adminClient
        .from("chat_sessions")
        .insert({
          visitor_id: visitorId,
          status: "active",
          part_context: partContext,
        })
        .select("id")
        .single();

      if (sessionErr || !session) {
        console.error("Session create error:", sessionErr);
        return NextResponse.json(
          { error: "Could not create session" },
          { status: 500 }
        );
      }
      currentSessionId = session.id;
    }

    // Save user message
    await adminClient.from("chat_messages").insert({
      session_id: currentSessionId,
      role: "user",
      content: message,
    });

    // Load conversation history (last 20 messages)
    const { data: history } = await adminClient
      .from("chat_messages")
      .select("role, content")
      .eq("session_id", currentSessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const messages = (history || []).map((m) => ({
      role: m.role as "user" | "assistant" | "operator",
      content: m.content as string,
    }));

    // Ask Gemini
    let aiReply: string;
    let isAiFailure = false;
    try {
      aiReply = await askGemini(messages, partContext);
    } catch (err) {
      console.error("Gemini error:", err);
      aiReply = "Please hold on, I'm working on your request...";
      isAiFailure = true;
    }

    // Check if Gemini returned a fallback message (API error)
    if (aiReply.startsWith("Please hold on")) {
      isAiFailure = true;
    }

    // Track consecutive failures — auto-escalate after 3
    let needsEscalation = aiReply.includes("[ESCALATE]");
    if (isAiFailure) {
      const failures = (failureMap.get(currentSessionId) || 0) + 1;
      failureMap.set(currentSessionId, failures);
      if (failures >= 3) {
        needsEscalation = true;
        aiReply = "[ESCALATE] AI unable to respond after multiple attempts";
        failureMap.delete(currentSessionId);
      }
    } else {
      failureMap.delete(currentSessionId);
    }

    const cleanReply = needsEscalation
      ? "Connecting you with a manager — they'll jump in shortly! Stay in the chat."
      : aiReply;

    // Save AI reply
    const { data: savedReply } = await adminClient
      .from("chat_messages")
      .insert({
        session_id: currentSessionId,
        role: "assistant",
        content: cleanReply,
      })
      .select("role, content, created_at")
      .single();

    // Handle escalation
    if (needsEscalation) {
      await adminClient
        .from("chat_sessions")
        .update({ status: "escalated", updated_at: new Date().toISOString() })
        .eq("id", currentSessionId);

      // Send to Telegram (non-blocking)
      escalateToOperator({
        sessionId: currentSessionId,
        partContext,
        messages,
        summary: aiReply.replace("[ESCALATE]", "").trim(),
      }).catch((err) => console.error("Escalation error:", err));
    }

    return NextResponse.json({
      sessionId: currentSessionId,
      reply: savedReply || { role: "assistant", content: cleanReply, created_at: new Date().toISOString() },
    });
  } catch (err) {
    console.error("Chat send error:", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

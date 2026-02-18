import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { askGemini } from "@/lib/chat/gemini";
import { escalateToOperator, sendToTelegram } from "@/lib/chat/telegram";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// --- Rate Limiting ---
// Per-visitorId: 10 msg/min, Per-IP: 6 msg/min, Global: 120 msg/min
const rateLimitMap = new Map<string, number[]>();
const ipRateLimitMap = new Map<string, number[]>();
const ipBanMap = new Map<string, number>(); // IP -> ban expiry timestamp
const globalTimestamps: number[] = [];
const RATE_WINDOW = 60_000;
const VISITOR_RATE_MAX = 10;
const IP_RATE_MAX = 6;
const GLOBAL_RATE_MAX = 120;
const BAN_DURATION = 5 * 60_000; // 5 min ban after 3 violations

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= VISITOR_RATE_MAX) return true;
  recent.push(now);
  rateLimitMap.set(key, recent);
  return false;
}

function isIPRateLimited(ip: string): boolean {
  if (ip === "unknown") return false;
  const now = Date.now();

  // Check if IP is banned
  const banExpiry = ipBanMap.get(ip);
  if (banExpiry && now < banExpiry) return true;

  const timestamps = ipRateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < RATE_WINDOW);
  if (recent.length >= IP_RATE_MAX) {
    // Track violations for escalating bans
    const violations = (ipViolationMap.get(ip) || 0) + 1;
    ipViolationMap.set(ip, violations);
    if (violations >= 3) {
      ipBanMap.set(ip, now + BAN_DURATION);
      ipViolationMap.delete(ip);
      console.warn(`[Security] IP banned for 5 min: ${ip}`);
    }
    return true;
  }
  recent.push(now);
  ipRateLimitMap.set(ip, recent);
  return false;
}
const ipViolationMap = new Map<string, number>();

function isGlobalRateLimited(): boolean {
  const now = Date.now();
  while (globalTimestamps.length > 0 && now - globalTimestamps[0] > RATE_WINDOW) {
    globalTimestamps.shift();
  }
  if (globalTimestamps.length >= GLOBAL_RATE_MAX) return true;
  globalTimestamps.push(now);
  return false;
}

// --- Input Filtering (Prompt Injection Detection) ---
const INJECTION_PATTERNS = [
  // Prompt injection
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|rules?|prompts?)/i,
  /forget\s+(all\s+)?(your\s+)?(instructions?|rules?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|above|prior|your)/i,
  /you\s+are\s+now\s+(a|an|the)\s+/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\bact\s+as\s+(a|an|if)\b/i,
  /override\s+(your|all|the)\s+(instructions?|rules?|settings?)/i,
  /pretend\s+(you\s+are|to\s+be|you're)/i,
  /jailbreak/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /reveal\s+(your|the|system)\s+(prompt|instructions?)/i,
  /what\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions?)/i,
  /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
  // Admin access / code execution attempts
  /\b(sudo|rm\s+-rf|drop\s+table|delete\s+from|insert\s+into|update\s+.*\s+set)\b/i,
  /\b(exec|eval|require|import)\s*\(/i,
  /\b(SELECT|INSERT|UPDATE|DELETE|ALTER|DROP)\s+(FROM|INTO|TABLE)\b/i,
  /\badmin\s*(panel|access|password|login|dashboard)\b/i,
  /\b(change|modify|update|edit|delete|remove)\s+(the\s+)?(price|listing|inventory|database|code|website)\b/i,
];

function detectInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

// --- Output Validation ---
function validateOutput(reply: string, partContext?: { price?: number } | null): string | null {
  // Check if the reply mentions a price lower than the actual price
  if (partContext?.price) {
    const priceMatches = reply.match(/\$\s?(\d+(?:[.,]\d{1,2})?)/g);
    if (priceMatches) {
      for (const match of priceMatches) {
        const num = parseFloat(match.replace(/[$,\s]/g, ""));
        // If reply contains a price that's less than 50% of actual price — suspicious
        if (!isNaN(num) && num > 0 && num < partContext.price * 0.5) {
          console.warn(`[Security] Output blocked: price $${num} < 50% of actual $${partContext.price}`);
          return null; // block this reply
        }
      }
    }
  }

  // Check for leaked system prompt or internal tags in the reply
  const SUSPICIOUS_OUTPUT = [
    /system\s*instruction/i,
    /BASE_SYSTEM_PROMPT/i,
    /RULES\s+OF\s+ENGAGEMENT/i,
    /you\s+are\s+the\s+AI\s+Sales\s+Assistant/i,
    /TRANSFER_TO_AGENT/i, // raw tag leaked (not wrapped in [])
    /TELEGRAM_BOT_TOKEN/i,
    /SUPABASE_SERVICE_ROLE/i,
    /api[_\s]?key/i,
    // Bot must not promise admin actions
    /i('ve| have)\s+(changed|updated|modified|deleted|removed|applied)/i,
    /price\s+(has been|is now|changed to|updated to|reduced to|lowered to)/i,
    /i\s+can\s+(change|modify|update|edit|delete|remove)\s+(the\s+)?(price|listing|inventory|database)/i,
    /discount\s+(applied|added|granted|given|approved)/i,
    /i('ll| will)\s+(give|apply|add|grant)\s+(you\s+)?(a\s+)?discount/i,
    /special\s+price\s+(for\s+you|just\s+for)/i,
  ];

  for (const pattern of SUSPICIOUS_OUTPUT) {
    if (pattern.test(reply)) {
      console.warn(`[Security] Output blocked: suspicious content matched ${pattern}`);
      return null;
    }
  }

  return reply;
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
  ipRateLimitMap.forEach((timestamps, key) => {
    const recent = timestamps.filter((t: number) => now - t < RATE_WINDOW);
    if (recent.length === 0) ipRateLimitMap.delete(key);
    else ipRateLimitMap.set(key, recent);
  });
  // Clear expired bans
  ipBanMap.forEach((expiry, ip) => {
    if (now >= expiry) ipBanMap.delete(ip);
  });
  // Clear old violations
  ipViolationMap.forEach((_count, ip) => {
    if (!ipRateLimitMap.has(ip)) ipViolationMap.delete(ip);
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

    // Rate limiting: visitor + IP + global
    const clientIP = getClientIP(request);

    if (isGlobalRateLimited()) {
      return NextResponse.json(
        { error: "Service is busy. Please try again in a moment." },
        { status: 503 }
      );
    }

    if (isIPRateLimited(clientIP)) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429 }
      );
    }

    if (isRateLimited(visitorId)) {
      return NextResponse.json(
        { error: "Too many messages. Please wait a moment." },
        { status: 429 }
      );
    }

    // Input filtering: detect prompt injection attempts
    if (detectInjection(message)) {
      console.warn(`[Security] Prompt injection attempt from IP ${clientIP}: "${message.slice(0, 100)}"`);
      return NextResponse.json({
        sessionId: sessionId,
        reply: {
          role: "assistant",
          content: "I'm here to help you with auto parts! How can I assist you today?",
          created_at: new Date().toISOString(),
        },
      });
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

    // Check if session is already escalated — skip Gemini, forward to operator
    const { data: sessionData } = await adminClient
      .from("chat_sessions")
      .select("status, telegram_chat_id")
      .eq("id", currentSessionId)
      .single();

    if (sessionData?.status === "escalated") {
      // Forward user message to Telegram operator
      const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
      const targetChatId = sessionData.telegram_chat_id || ADMIN_CHAT_ID;
      if (targetChatId && targetChatId !== "placeholder") {
        sendToTelegram(
          targetChatId,
          `💬 Customer:\n${message}\n\n🆔 Session: ${currentSessionId}`
        ).catch((err) => console.error("Telegram forward error:", err));
      }

      // Update session timestamp
      await adminClient
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", currentSessionId);

      // Return without AI reply — operator responses come via polling
      return NextResponse.json({
        sessionId: currentSessionId,
        reply: null,
      });
    }

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

    // Detect escalation tags
    const EXPLICIT_ESCALATION = /\[TRANSFER_TO_(AGENT|MANAGER)\]/i;
    const SILENT_ESCALATION = /\[SILENT_TRANSFER\]/i;
    const ALL_ESCALATION_TAGS = /\[(TRANSFER_TO_AGENT|TRANSFER_TO_MANAGER|SILENT_TRANSFER)\]/gi;

    let needsExplicitEscalation = EXPLICIT_ESCALATION.test(aiReply);
    const needsSilentEscalation = SILENT_ESCALATION.test(aiReply);
    let needsEscalation = needsExplicitEscalation || needsSilentEscalation;

    // Track consecutive failures — auto-escalate after 3
    if (isAiFailure) {
      const failures = (failureMap.get(currentSessionId) || 0) + 1;
      failureMap.set(currentSessionId, failures);
      if (failures >= 3) {
        needsEscalation = true;
        needsExplicitEscalation = true;
        aiReply = "[TRANSFER_TO_AGENT] AI unable to respond after multiple attempts";
        failureMap.delete(currentSessionId);
      }
    } else {
      failureMap.delete(currentSessionId);
    }

    let cleanReply: string;
    if (needsExplicitEscalation) {
      // Explicit escalation — show "connecting you with manager" message
      cleanReply = aiReply.replace(ALL_ESCALATION_TAGS, "").trim() ||
        "Connecting you with a manager — they'll jump in shortly! Stay in the chat.";
    } else if (needsSilentEscalation) {
      // Silent escalation — keep the natural AI reply (just remove the tag)
      cleanReply = aiReply.replace(ALL_ESCALATION_TAGS, "").trim();
    } else {
      cleanReply = aiReply;
    }

    // Output validation — check for suspicious content
    if (!needsEscalation) {
      const validated = validateOutput(cleanReply, partContext);
      if (validated === null) {
        cleanReply = "Let me double-check that for you. Could you rephrase your question?";
      }
    }

    // Save AI reply
    const { data: savedReply } = await adminClient
      .from("chat_messages")
      .insert({
        session_id: currentSessionId,
        role: "assistant",
        content: cleanReply,
      })
      .select("id, role, content, created_at")
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
        summary: aiReply.replace(ALL_ESCALATION_TAGS, "").trim(),
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

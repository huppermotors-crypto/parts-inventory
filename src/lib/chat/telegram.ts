interface EscalationData {
  sessionId: string;
  partContext?: {
    name?: string;
    price?: number;
    make?: string;
    model?: string;
    year?: number | string;
  } | null;
  messages: Array<{ role: string; content: string }>;
  summary: string;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;

export async function sendToTelegram(
  chatId: string | number,
  text: string
): Promise<boolean> {
  if (!BOT_TOKEN || BOT_TOKEN === "placeholder") {
    console.log("[Telegram stub] Would send to", chatId, ":", text);
    return false;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    return res.ok;
  } catch (err) {
    console.error("[Telegram] Send error:", err);
    return false;
  }
}

export async function escalateToOperator(data: EscalationData): Promise<void> {
  if (!ADMIN_CHAT_ID || ADMIN_CHAT_ID === "placeholder") {
    console.log("[Telegram stub] Escalation:", JSON.stringify(data, null, 2));
    return;
  }

  const lines: string[] = ["🔔 <b>New support request!</b>", ""];

  if (data.partContext?.name) {
    const vehicle = [data.partContext.year, data.partContext.make, data.partContext.model]
      .filter(Boolean)
      .join(" ");
    lines.push(`📦 <b>Part:</b> ${data.partContext.name}`);
    if (data.partContext.price) lines.push(`💰 <b>Price:</b> $${data.partContext.price}`);
    if (vehicle) lines.push(`🚗 <b>Vehicle:</b> ${vehicle}`);
    lines.push("");
  }

  lines.push("💬 <b>Conversation:</b>");
  const recent = data.messages.slice(-6);
  for (const msg of recent) {
    const label = msg.role === "user" ? "Customer" : "AI";
    lines.push(`${label}: ${msg.content.slice(0, 200)}`);
  }

  lines.push("");
  lines.push(`📝 <b>Summary:</b> ${data.summary}`);
  lines.push(`🆔 Session: ${data.sessionId}`);

  await sendToTelegram(ADMIN_CHAT_ID, lines.join("\n"));
}

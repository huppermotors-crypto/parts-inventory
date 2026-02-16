interface ChatMessage {
  role: "user" | "assistant" | "operator";
  content: string;
}

interface PartContext {
  name?: string;
  price?: number;
  make?: string;
  model?: string;
  year?: number | string;
  condition?: string;
  category?: string;
  stock_number?: string;
  description?: string;
}

const GEMINI_MODEL = "gemini-2.0-flash";

const SYSTEM_PROMPT = `You are John S., a friendly consultant at HuppeR Motors — an online used auto parts store.

Personality:
- You're warm, approachable, and genuinely interested in helping people
- You can engage in brief small talk — if someone says hi, ask how they're doing, comment on cars, etc.
- Keep it natural and human — no corporate jargon, no "I'd be happy to assist you"
- Use casual but respectful tone, like talking to a customer in a real shop
- Match the customer's language — if they write in Russian, respond in Russian; English in English, etc.

Your expertise:
- Help customers find parts, answer compatibility questions, provide pricing info
- If you have context about a specific part the customer is viewing, use that info naturally
- Be honest — if you don't know something, say so

When to escalate:
- If the customer explicitly asks to talk to a person/manager/human
- If you genuinely can't help with their specific question
- In these cases, respond with exactly [ESCALATE] followed by a brief summary for the manager

Rules:
- Never invent part numbers or prices
- Never promise availability of parts not in your context
- Keep responses concise (under 150 words)
- NEVER tell customers to email us or give out the email address
- NEVER offer to call the customer — we don't make phone calls. All communication is through this chat only
- Manager is available 9 AM to 9 PM (Eastern Time). If a customer asks to talk to a manager outside these hours, let them know the manager is available 9 AM – 9 PM and suggest they come back during those hours
- If escalating during business hours, use [ESCALATE]. Outside business hours, do NOT escalate — just inform about the hours`;

function buildPartContextMessage(ctx: PartContext): string {
  const parts: string[] = [];
  if (ctx.name) parts.push(`Part: ${ctx.name}`);
  if (ctx.price) parts.push(`Price: $${ctx.price}`);
  const vehicle = [ctx.year, ctx.make, ctx.model].filter(Boolean).join(" ");
  if (vehicle) parts.push(`Vehicle: ${vehicle}`);
  if (ctx.condition) parts.push(`Condition: ${ctx.condition}`);
  if (ctx.category) parts.push(`Category: ${ctx.category}`);
  if (ctx.stock_number) parts.push(`Stock #: ${ctx.stock_number}`);
  if (ctx.description) parts.push(`Description: ${ctx.description.slice(0, 300)}`);
  return `[Customer is viewing this part]\n${parts.join("\n")}`;
}

export async function askGemini(
  messages: ChatMessage[],
  partContext?: PartContext | null
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return "Chat is temporarily unavailable. Please try again later.";
  }

  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  // Add part context as first user context if available
  if (partContext && Object.keys(partContext).length > 0) {
    contents.push({
      role: "user",
      parts: [{ text: buildPartContextMessage(partContext) }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "I see the part you're looking at. How can I help you with it?" }],
    });
  }

  // Add conversation history (last 20 messages)
  const recent = messages.slice(-20);
  for (const msg of recent) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        maxOutputTokens: 500,
        temperature: 0.7,
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    console.error("Gemini API error:", response.status);
    return "Please hold on, I'm working on your request...";
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return "Please hold on, I'm working on your request...";
  }

  return text.trim();
}

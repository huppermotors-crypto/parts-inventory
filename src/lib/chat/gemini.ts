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

const SYSTEM_PROMPT = `You are a helpful auto parts consultant for HuppeR Motors, an online used auto parts store.

Your role:
- Help customers find parts, answer compatibility questions, provide pricing info
- Be concise, friendly, and professional
- Answer in the same language the customer uses
- If you have context about a specific part the customer is viewing, use it to help them
- If you cannot help with a question (not related to auto parts, or you need specific info you don't have), respond with exactly [ESCALATE] followed by a brief summary of what the customer needs

Important:
- Never make up part numbers or prices you don't know
- Never promise availability of parts not in context
- Keep responses under 200 words
- For contact: hupper.motors@gmail.com`;

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
    return "Chat is temporarily unavailable. Please contact us at hupper.motors@gmail.com";
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
    return "I'm having trouble responding right now. Please try again or contact us at hupper.motors@gmail.com";
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return "I couldn't generate a response. Please try again or contact us at hupper.motors@gmail.com";
  }

  return text.trim();
}

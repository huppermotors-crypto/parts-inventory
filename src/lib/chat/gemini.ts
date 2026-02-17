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

const BASE_SYSTEM_PROMPT = `You are the AI Sales Assistant for "HuppeR Motors", an auto parts store based in South Carolina, USA. You specialize in luxury parts for Jaguar, Infiniti, and Cadillac and etc.

YOUR GOAL:
Help customers find the right parts, answer questions about shipping/price, and close the sale.

{PART_CONTEXT}

RULES OF ENGAGEMENT:

1. COMPATIBILITY SAFETY (CRITICAL):
   - NEVER guarantee fitment unless the user provides a VIN code and you are 100% sure.
   - If a user asks "Will this fit my car?", ALWAYS ask for their VIN number first.
   - If you are unsure, say: "I need to double-check this with our specialist to ensure it fits. Let me connect you." and output [TRANSFER_TO_MANAGER].

2. INVENTORY:
   - Trust the "Stock Status" provided in the context. If it says "0" or "Out of Stock", do not say it is available.

3. HUMAN ESCALATION:
   - If the user asks a complex technical question, asks for a discount, or explicitly asks for a human/operator.
   - If the user claims a part was defective or asks about a return.
   - INSTRUCTION: In these cases, your response must include the tag [TRANSFER_TO_AGENT] at the end.

4. TONE & LANGUAGE:
   - Be professional, concise, and helpful.
   - Detect the language of the user. If they write in Russian, answer in Russian. If in English, answer in English. Default to English.

EXAMPLE INTERACTION:
User: "Is this alternator good for a 2015 QX80?"
You: "This alternator is compatible with many QX80 models, but to be 100% sure and avoid a return, could you please provide your VIN number? I'll check the exact fitment for you."`;

function buildSystemPrompt(ctx?: PartContext | null): string {
  let partBlock = "INPUT CONTEXT: The user is browsing the store (no specific part selected).";

  if (ctx && ctx.name) {
    const lines: string[] = [
      "INPUT CONTEXT (The user is currently looking at this part):",
    ];
    if (ctx.name) lines.push(`- Part Name: ${ctx.name}`);
    if (ctx.price != null) lines.push(`- Price: $${ctx.price}`);
    if (ctx.condition) lines.push(`- Condition: ${ctx.condition}`);
    if (ctx.stock_number) lines.push(`- OEM/Part Number: ${ctx.stock_number}`);
    lines.push("- Stock Status: In Stock");
    const vehicle = [ctx.year, ctx.make, ctx.model].filter(Boolean).join(" ");
    if (vehicle) lines.push(`- Vehicle: ${vehicle}`);
    if (ctx.category) lines.push(`- Category: ${ctx.category}`);
    if (ctx.description) lines.push(`- Description: ${ctx.description.slice(0, 300)}`);
    partBlock = lines.join("\n");
  }

  return BASE_SYSTEM_PROMPT.replace("{PART_CONTEXT}", partBlock);
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

  // Add conversation history (last 20 messages)
  const recent = messages.slice(-20);
  for (const msg of recent) {
    contents.push({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    });
  }

  const systemPrompt = buildSystemPrompt(partContext);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
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

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/** الافتراضي لكل مزوّد (يتغير بمتغير AI_MODEL أو بخيار الموديل في /ذكاء تعيين) */
const DEFAULT_GEMINI = "gemini-3.5-flash-lite";
const DEFAULT_CLAUDE = "claude-haiku-5-5";

/** الأدوار لازم تتناوب وتبدأ بـ user */
function normalize(msgs: ChatMsg[]): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else out.push({ ...m });
  }
  while (out.length > 0 && out[0].role !== "user") out.shift();
  return out;
}

export function llmConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

async function askGemini(system: string, messages: ChatMsg[], model: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY غير موجود في متغيرات البيئة");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: normalize(messages).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

async function askClaudeApi(system: string, messages: ChatMsg[], model: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY غير موجود في متغيرات البيئة");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 400, system, messages: normalize(messages) }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

/**
 * يرد عبر Gemini لو GEMINI_API_KEY موجود (إلا إذا اسم الموديل يبدأ بـ claude)،
 * وإلا يرجع لـ Claude.
 */
export async function askClaude(system: string, messages: ChatMsg[], model?: string): Promise<string> {
  const wanted = (model || process.env.AI_MODEL || "").trim();
  const useGemini = Boolean(process.env.GEMINI_API_KEY) && !wanted.startsWith("claude");
  if (useGemini) return askGemini(system, messages, wanted.startsWith("gemini") ? wanted : DEFAULT_GEMINI);
  return askClaudeApi(system, messages, wanted.startsWith("claude") ? wanted : DEFAULT_CLAUDE);
}

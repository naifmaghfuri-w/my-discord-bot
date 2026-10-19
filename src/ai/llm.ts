export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/** الموديل الافتراضي (يتغير بمتغير AI_MODEL أو بخيار الموديل في /ذكاء تعيين) */
const DEFAULT_MODEL = "claude-haiku-5-5";

/** Claude يتطلب أدواراً متناوبة تبدأ بـ user */
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
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function askClaude(system: string, messages: ChatMsg[], model?: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY غير موجود في متغيرات البيئة");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || process.env.AI_MODEL || DEFAULT_MODEL,
      max_tokens: 400,
      system,
      messages: normalize(messages),
    }),
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

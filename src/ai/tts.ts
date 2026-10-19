/** الأصوات المتاحة: جمينلي (يكفي نفس GEMINI_API_KEY) وAzure (اختياري) */
export const VOICES = [
  { name: "كور — أنثوية (جمينلي)", value: "Kore" },
  { name: "أويدي — أنثوية ناعمة (جمينلي)", value: "Aoede" },
  { name: "ليدا — أنثوية شابة (جمينلي)", value: "Leda" },
  { name: "زيفير — أنثوية مشرقة (جمينلي)", value: "Zephyr" },
  { name: "باك — ذكوري (جمينلي)", value: "Puck" },
  { name: "شارون — ذكوري هادئ (جمينلي)", value: "Charon" },
  { name: "أماني — سورية (Azure)", value: "ar-SY-AmanyNeural" },
  { name: "ليث — سوري (Azure)", value: "ar-SY-LaithNeural" },
  { name: "حامد — سعودي (Azure)", value: "ar-SA-HamedNeural" },
  { name: "زارية — سعودية (Azure)", value: "ar-SA-ZariyahNeural" },
  { name: "عبدالله — عماني (Azure)", value: "ar-OM-AbdullahNeural" },
  { name: "فهد — كويتي (Azure)", value: "ar-KW-FahedNeural" },
  { name: "حمدان — اماراتي (Azure)", value: "ar-AE-HamdanNeural" },
] as const;

export const DEFAULT_VOICE = "ar-SY-AmanyNeural";
const GEMINI_DEFAULT_VOICE = "Kore";
const GEMINI_TTS_MODEL = process.env.TTS_MODEL || "gemini-3.1-flash-tts-preview";

const azureOk = () => Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
const geminiOk = () => Boolean(process.env.GEMINI_API_KEY);

export function ttsEnabled(): boolean {
  return azureOk() || geminiOk();
}

export interface Speech {
  audio: Buffer;
  ext: "mp3" | "wav";
}

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** ينظف النص للنطق: بدون إيموجي أو منشن أو رموز تنسيق */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/<@[!&]?\d+>|<#\d+>/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_~`>|#]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/** يلف صوت PCM الخام (16-bit mono) بترويسة WAV عشان ديسكورد يشغله */
function pcmToWav(pcm: Buffer, rate: number): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function geminiSpeech(text: string, voiceName: string): Promise<Speech> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY غير موجود");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Say in a warm, friendly Syrian Levantine Arabic accent: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[];
  };
  const inline = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!inline?.data) throw new Error("Gemini TTS ما رجّع صوت");

  const rate = Number(/rate=(\d+)/.exec(inline.mimeType ?? "")?.[1] ?? 24000);
  return { audio: pcmToWav(Buffer.from(inline.data, "base64"), rate), ext: "wav" };
}

async function azureSpeech(text: string, voice: string): Promise<Speech> {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) throw new Error("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION غير موجودة");

  const lang = voice.split("-").slice(0, 2).join("-");
  const ssml =
    `<speak version="1.0" xml:lang="${lang}" xmlns="http://www.w3.org/2001/10/synthesis">` +
    `<voice name="${voice}">${escapeXml(text)}</voice></speak>`;

  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "discord-bot",
    },
    body: ssml,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Azure TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return { audio: Buffer.from(await res.arrayBuffer()), ext: "mp3" };
}

/**
 * يحوّل النص لصوت. صوت Azure (يبدأ بـ ar-) يحتاج مفاتيح Azure،
 * وإلا يستخدم جمينلي تلقائياً بصوت كور.
 */
export async function synthesize(text: string, voice: string): Promise<Speech> {
  const isAzureVoice = voice.startsWith("ar-");
  if (isAzureVoice && azureOk()) return azureSpeech(text, voice);
  if (geminiOk()) return geminiSpeech(text, isAzureVoice ? GEMINI_DEFAULT_VOICE : voice);
  throw new Error("ما فيه مفتاح صوت: أضف GEMINI_API_KEY أو مفاتيح Azure");
}

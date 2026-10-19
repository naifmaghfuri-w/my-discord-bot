/** الأصوات المتاحة (Azure Neural). الأول هو الافتراضي: صوت أنثوي سوري */
export const VOICES = [
  { name: "أماني — سورية", value: "ar-SY-AmanyNeural" },
  { name: "ليث — سوري", value: "ar-SY-LaithNeural" },
  { name: "حامد — سعودي", value: "ar-SA-HamedNeural" },
  { name: "زارية — سعودية", value: "ar-SA-ZariyahNeural" },
  { name: "عبدالله — عماني", value: "ar-OM-AbdullahNeural" },
  { name: "فهد — كويتي", value: "ar-KW-FahedNeural" },
  { name: "حمدان — اماراتي", value: "ar-AE-HamdanNeural" },
] as const;

export const DEFAULT_VOICE = VOICES[0].value;

export function ttsEnabled(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
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

/** يحوّل النص لمقطع mp3 */
export async function synthesize(text: string, voice: string): Promise<Buffer> {
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
  return Buffer.from(await res.arrayBuffer());
}

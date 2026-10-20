import { spawn } from "node:child_process";
import { Routes, type Message } from "discord.js";
import { logger } from "../utils/logger";
import { getVoice } from "./voices";

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
function load<T>(name: string): T | null {
  try {
    return require(name) as T;
  } catch {
    return null;
  }
}
const FFMPEG = load<string>("ffmpeg-static");
const EDGE = load<any>("msedge-tts");

export const ttsAvailable = (): boolean => Boolean(EDGE);

/** ينظف النص للقراءة بصوت عالٍ */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/<a?:\w+:\d+>/g, " ")
    .replace(/<@[!&]?\d+>|<#\d+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[*_~`>|#]/g, " ")
    .replace(/[<>&]/g, " ")
    .replace(/\p{Extended_Pictographic}/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

/** نص → MP3 عبر Edge TTS */
export async function synthesize(text: string, voiceId: string): Promise<Buffer> {
  if (!EDGE) throw new Error("حزمة msedge-tts غير مثبّتة");
  const tts = new EDGE.MsEdgeTTS();
  await tts.setMetadata(getVoice(voiceId).edge, EDGE.OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const res = tts.toStream(text);
  const stream = res?.audioStream ?? res;
  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => reject(new Error("انتهت مهلة توليد الصوت")), 25_000);
    stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on("error", (e: Error) => (clearTimeout(timer), reject(e)));
    stream.on("end", () => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      out.length ? resolve(out) : reject(new Error("صوت فارغ"));
    });
    stream.on("close", () => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      if (out.length) resolve(out);
    });
  });
}

function runFfmpeg(args: string[], input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    if (!FFMPEG) return reject(new Error("ffmpeg-static غير مثبّتة"));
    const p = spawn(FFMPEG, args, { stdio: ["pipe", "pipe", "ignore"] });
    const out: Buffer[] = [];
    p.stdout.on("data", (c: Buffer) => out.push(c));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg ${code}`))));
    p.stdin.on("error", () => undefined);
    p.stdin.end(input);
  });
}

/** MP3 → OGG/Opus + موجة صوتية ومدة (متطلبات الرسائل الصوتية في ديسكورد) */
async function toVoiceMessage(mp3: Buffer): Promise<{ ogg: Buffer; duration: number; waveform: string }> {
  const [ogg, pcm] = await Promise.all([
    runFfmpeg(["-i", "pipe:0", "-vn", "-c:a", "libopus", "-b:a", "32k", "-ar", "48000", "-ac", "1", "-f", "ogg", "pipe:1"], mp3),
    runFfmpeg(["-i", "pipe:0", "-vn", "-f", "s16le", "-ac", "1", "-ar", "8000", "pipe:1"], mp3),
  ]);
  const samples = Math.floor(pcm.length / 2);
  const duration = Math.max(1, samples / 8000);
  const BUCKETS = 128;
  const per = Math.max(1, Math.floor(samples / BUCKETS));
  const bytes = new Uint8Array(BUCKETS);
  let peak = 1;
  const raw: number[] = [];
  for (let b = 0; b < BUCKETS; b++) {
    let max = 0;
    for (let i = b * per; i < Math.min(samples, (b + 1) * per); i++) max = Math.max(max, Math.abs(pcm.readInt16LE(i * 2)));
    raw.push(max);
    peak = Math.max(peak, max);
  }
  raw.forEach((v, i) => (bytes[i] = Math.round((v / peak) * 255)));
  return { ogg, duration, waveform: Buffer.from(bytes).toString("base64") };
}

/** يرسل رد صوتي كرسالة صوتية؛ لو تعذّر يرسله كملف MP3 عادي. يرجع false لو فشل كل شيء */
export async function sendVoiceReply(message: Message, text: string, voiceId: string): Promise<boolean> {
  const speech = cleanForSpeech(text);
  if (!speech) return false;
  let mp3: Buffer;
  try {
    mp3 = await synthesize(speech, voiceId);
  } catch (err) {
    logger.error("فشل توليد الصوت", err);
    return false;
  }
  try {
    const v = await toVoiceMessage(mp3);
    await message.client.rest.post(Routes.channelMessages(message.channelId), {
      body: {
        flags: 1 << 13, // IS_VOICE_MESSAGE
        message_reference: { message_id: message.id, fail_if_not_exists: false },
        allowed_mentions: { parse: [], replied_user: false },
        attachments: [{ id: 0, filename: "voice-message.ogg", duration_secs: v.duration, waveform: v.waveform }],
      },
      files: [{ name: "voice-message.ogg", data: v.ogg, contentType: "audio/ogg" }],
    });
    return true;
  } catch (err) {
    logger.error("فشل إرسال الرسالة الصوتية، نرسل ملف عادي", err);
  }
  try {
    await message.reply({ files: [{ attachment: mp3, name: "reply.mp3" }], allowedMentions: { repliedUser: false } });
    return true;
  } catch {
    return false;
  }
}

import type { Client, TextChannel } from "discord.js";
import { config } from "../config";
import { logger } from "../utils/logger";
import { createBackup, summarize } from "./service";

const DAY = 24 * 60 * 60 * 1000;

/** يرسل نسخة احتياطية: لقناة BACKUP_CHANNEL_ID، وإلا للمالك بالخاص */
export async function sendBackup(client: Client): Promise<boolean> {
  const result = await createBackup();
  const content = summarize(result);

  let target: { send: (o: any) => Promise<unknown> } | null = null;
  if (config.backupChannelId) {
    const ch = await client.channels.fetch(config.backupChannelId).catch(() => null);
    if (ch && ch.isTextBased() && "send" in ch) target = ch as TextChannel;
  }
  if (!target && config.ownerId) target = await client.users.fetch(config.ownerId).catch(() => null);
  if (!target) return false;

  // 10 ملفات كحد أقصى بالرسالة الواحدة
  for (let i = 0; i < result.parts.length; i += 10) {
    const chunk = result.parts.slice(i, i + 10);
    await target.send({
      content: i === 0 ? content : undefined,
      files: chunk.map((p) => ({ attachment: p.data, name: p.name })),
    });
  }
  if (result.parts.length === 0) await target.send({ content });
  return true;
}

export function startBackupScheduler(client: Client): void {
  if (!config.backupChannelId && !config.ownerId) {
    logger.info("النسخ الاحتياطي التلقائي معطّل (حدد BACKUP_CHANNEL_ID أو OWNER_ID)");
    return;
  }
  const run = () => {
    sendBackup(client)
      .then((ok) => ok && logger.info("📦 تم إرسال النسخة الاحتياطية اليومية"))
      .catch((err) => logger.error("فشل النسخ الاحتياطي التلقائي", err));
  };
  setTimeout(run, 10 * 60 * 1000).unref();
  setInterval(run, DAY).unref();
}

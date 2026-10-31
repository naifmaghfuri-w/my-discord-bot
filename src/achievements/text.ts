import { EmbedBuilder, type Message } from "discord.js";
import { ACHIEVEMENTS, NEED, getAchievements } from "./service";

/** !انجازات أو !إنجازات (مع @شخص اختياري) */
export const ACHIEVEMENTS_TRIGGER = /^!\s*[اإأ]نجازات(?:\s+<@!?(\d+)>)?$/;

export async function handleAchievementsMessage(message: Message, targetId?: string): Promise<void> {
  if (!message.inGuild()) return;
  const uid = targetId ?? message.author.id;
  const data = await getAchievements(message.guildId, uid);
  const progress: Record<string, string> = {
    city_guardian: `${Math.min(data.jails, NEED.jails)}/${NEED.jails}`,
    too_fast: `${Math.min(data.firstStreak, NEED.streak)}/${NEED.streak}`,
    too_slow: `${Math.min(data.lastStreak, NEED.streak)}/${NEED.streak}`,
  };
  const lines = ACHIEVEMENTS.map((a) => {
    const at = data.unlocked.get(a.id);
    if (at) return `✅ ${a.icon} **${a.name}** — ${a.desc}\n> انفتح <t:${Math.floor(at.getTime() / 1000)}:R>`;
    return `🔒 ${a.icon} **${a.name}** — ${a.desc}${progress[a.id] ? `\n> التقدم: ${progress[a.id]}` : ""}`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("🏆 الإنجازات")
    .setDescription([`<@${uid}> — فتح **${data.unlocked.size}/${ACHIEVEMENTS.length}**`, "", ...lines].join("\n"));
  await message.channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => undefined);
}

import type { BotClient } from "../client";
import { config } from "../config";
import { UserProfile } from "../database/models/UserProfile";
import { todayDayMonth } from "./birthday";
import { logger } from "../utils/logger";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // كل نص ساعة
const ROLE_DURATION_MS = 24 * 60 * 60 * 1000;

/** يعطي رتبة عيد الميلاد لمن عيده اليوم، ويشيلها عمن مرّت عليه 24 ساعة */
export function startBirthdayRoleChecker(client: BotClient): void {
  if (!config.birthdayRoleId) return;
  setInterval(() => {
    void tick(client).catch((err) => logger.error("خطأ في فحص رتبة عيد الميلاد", err));
  }, CHECK_INTERVAL_MS);
  // فحص أولي بعد دقيقة من الإقلاع
  setTimeout(() => void tick(client).catch((err) => logger.error("خطأ في فحص رتبة عيد الميلاد", err)), 60_000);
}

async function tick(client: BotClient): Promise<void> {
  const roleId = config.birthdayRoleId;
  if (!roleId) return;

  const { day, month, year } = todayDayMonth();
  const now = Date.now();

  for (const guild of client.guilds.cache.values()) {
    const role = guild.roles.cache.get(roleId);
    if (!role) continue;

    // 1) امنح الرتبة لمن عيد ميلاده اليوم ولسه ما أخذها هالسنة
    const birthdayUsers = await UserProfile.find({
      guildId: guild.id,
      birthdayDay: day,
      birthdayMonth: month,
    });

    for (const profile of birthdayUsers) {
      const alreadyThisYear =
        profile.lastBirthdayRoleAt &&
        new Date(profile.lastBirthdayRoleAt).getUTCFullYear() === year &&
        new Date(profile.lastBirthdayRoleAt).getUTCMonth() + 1 === month;
      if (alreadyThisYear) continue;

      const member = await guild.members.fetch(profile.userId).catch(() => null);
      if (!member) continue;

      await member.roles.add(role).catch((err) => logger.error("فشل إعطاء رتبة عيد الميلاد", err));
      await UserProfile.updateOne(
        { userId: profile.userId, guildId: guild.id },
        { $set: { lastBirthdayRoleAt: new Date(now) } },
      );

      if (config.birthdayChannelId) {
        const channel = await client.channels.fetch(config.birthdayChannelId).catch(() => null);
        if (channel && "send" in channel) {
          await (channel as { send: (o: unknown) => Promise<unknown> })
            .send({ content: `🎉🎂 كل عام وأنت بخير يا ${member}!`, allowedMentions: { users: [member.id] } })
            .catch(() => undefined);
        }
      }
    }

    // 2) اسحب الرتبة ممن مرّت عليه 24 ساعة
    for (const member of role.members.values()) {
      const profile = await UserProfile.findOne({ userId: member.id, guildId: guild.id }, { lastBirthdayRoleAt: 1 });
      const givenAt = profile?.lastBirthdayRoleAt ? new Date(profile.lastBirthdayRoleAt).getTime() : 0;
      if (now - givenAt >= ROLE_DURATION_MS) {
        await member.roles.remove(role).catch((err) => logger.error("فشل سحب رتبة عيد الميلاد", err));
      }
    }
  }
}

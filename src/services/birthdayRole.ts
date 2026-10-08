import { ChannelType } from "discord.js";
import { buildAnnouncement } from "../birthday/announce";
import type { BotClient } from "../client";
import { REWARDS } from "../constants";
import { UserProfile } from "../database/models/UserProfile";
import { logger } from "../utils/logger";
import { isLeapYear, todayDayMonth } from "./birthday";
import { getBirthdayConfig } from "./birthdayConfig";
import { grantReward } from "./economy";

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // كل نص ساعة
const ROLE_DURATION_MS = 24 * 60 * 60 * 1000;

/** كل نص ساعة: هدية + رتبة + تهنئة لمن عيده اليوم (لكل سيرفر بإعداداته)، ويشيل الرتبة بعد 24 ساعة */
export function startBirthdayRoleChecker(client: BotClient): void {
  const run = () => void tick(client).catch((err) => logger.error("خطأ في فحص عيد الميلاد", err));
  setInterval(run, CHECK_INTERVAL_MS);
  setTimeout(run, 60_000); // فحص أولي بعد دقيقة من الإقلاع
}

async function tick(client: BotClient): Promise<void> {
  const { day, month, year } = todayDayMonth();
  const now = Date.now();
  // اللي ميلاده 29 فبراير يحتفل فيه يوم 28 في السنة غير الكبيسة
  const days = month === 2 && day === 28 && !isLeapYear(year) ? [28, 29] : [day];

  for (const guild of client.guilds.cache.values()) {
    const { channelId, roleId } = await getBirthdayConfig(guild.id);
    const role = roleId ? guild.roles.cache.get(roleId) : undefined;

    const birthdayUsers = await UserProfile.find({
      guildId: guild.id,
      birthdayMonth: month,
      birthdayDay: { $in: days },
    });

    for (const profile of birthdayUsers) {
      // احتفلنا فيه هالسنة؟ (نقارن بالمنطقة الزمنية للبوت مو UTC)
      if (profile.lastBirthdayRoleAt && todayDayMonth(new Date(profile.lastBirthdayRoleAt)).year === year) continue;

      const member = await guild.members.fetch(profile.userId).catch(() => null);
      if (!member || member.user.bot) continue;

      // نسجّل أول شيء عشان ما تتكرر الهدية لو صار خطأ بالخطوات اللي بعده
      await UserProfile.updateOne(
        { userId: profile.userId, guildId: guild.id },
        { $set: { lastBirthdayRoleAt: new Date(now) } },
      );

      if (role) await member.roles.add(role).catch((err) => logger.error("فشل إعطاء رتبة عيد الميلاد", err));

      await grantReward(profile.userId, guild.id, REWARDS.birthdayJenny, REWARDS.birthdayXp).catch((err) =>
        logger.error("فشل إعطاء هدية عيد الميلاد", err),
      );

      if (channelId) {
        // guild.channels.fetch ما يرجع إلا قنوات هذا السيرفر، فما ينزل إعلان بسيرفر غلط
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (channel && (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement)) {
          const turningAge = profile.birthdayYear && !profile.birthdayHideAge ? year - profile.birthdayYear : null;
          await channel
            .send(buildAnnouncement(member.id, member.displayName, member.displayAvatarURL(), year, turningAge))
            .catch((err) => logger.error("فشل إرسال تهنئة عيد الميلاد", err));
        }
      }
    }

    // اسحب الرتبة ممن مرّت عليه 24 ساعة
    if (role) {
      for (const member of role.members.values()) {
        const profile = await UserProfile.findOne({ userId: member.id, guildId: guild.id }, { lastBirthdayRoleAt: 1 });
        const givenAt = profile?.lastBirthdayRoleAt ? new Date(profile.lastBirthdayRoleAt).getTime() : 0;
        if (now - givenAt >= ROLE_DURATION_MS) {
          await member.roles.remove(role).catch((err) => logger.error("فشل سحب رتبة عيد الميلاد", err));
        }
      }
    }
  }
}

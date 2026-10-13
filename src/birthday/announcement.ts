import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type MessageCreateOptions } from "discord.js";
import { BIRTHDAY_EMOJI, REWARDS, jenny, xp } from "../constants";
import { config } from "../config";
import { BIRTHDAY_WISH_PREFIX } from "./ids";
import { BIRTHDAY_COLOR } from "./views";

/** بطاقة التهنئة التي ينشرها البوت يوم العيد (turningAge = null لو العمر غير معروف أو مخفي) */
export function buildAnnouncement(
  userId: string,
  displayName: string,
  avatarURL: string,
  year: number,
  turningAge: number | null,
): MessageCreateOptions {
  const embed = new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setTitle(`${BIRTHDAY_EMOJI} عيد ميلاد سعيد، ${displayName}!`)
    .setDescription(`هنّوا <@${userId}> وتمنّوا له يوم جميل!`)
    .setThumbnail(avatarURL)
    .addFields(
      ...(turningAge ? [{ name: "العمر", value: `**${turningAge}**`, inline: true }] : []),
      {
        name: "هدية العيد",
        value: `${jenny(REWARDS.birthdayJenny)} + ${xp(REWARDS.birthdayXp)}`,
        inline: true,
      },
    );

  if (config.birthdayBannerUrl) embed.setImage(config.birthdayBannerUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${BIRTHDAY_WISH_PREFIX}${userId}:${year}`)
      .setLabel("أرسل تهنئة")
      .setStyle(ButtonStyle.Primary),
  );

  return {
    content: `${BIRTHDAY_EMOJI} <@${userId}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [userId] },
  };
}

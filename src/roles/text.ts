import {
  ActionRowBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { logger } from "../utils/logger";
import { renderGenderBanner } from "./card";

/** !لوحة الرتب — لمالك البوت/السيرفر فقط */
export const ROLES_TRIGGER = /^!\s*لوحة\s+(?:ال)?رتب$/;

/** رتب الجنس */
export const GENDER_ROLES = {
  he: "1542163697089384468",
  she: "1542163698624364574",
} as const;

const eph = { flags: MessageFlags.Ephemeral } as const;
const COLOR = 0xa78bfa;
const MENU_ID = "rl|gender";

export async function handleRolesPanelMessage(message: Message<true>): Promise<void> {
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);
  const isOwner = message.author.id === message.guild.ownerId || (!!config.ownerId && message.author.id === config.ownerId);
  if (!isOwner) return void (await reply("❌ هذا الأمر لمالك البوت فقط."));
  if (!message.guild.members.me?.permissions.has("ManageRoles")) return void (await reply("❌ البوت يحتاج صلاحية «إدارة الرتب»."));

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("اختر جنسك")
    .setDescription(
      [
        "✥ افتح القائمة تحت واختر رتبتك، وتتغير متى شئت.",
        "",
        `💙 ذكر ← <@&${GENDER_ROLES.he}>`,
        `💗 أنثى ← <@&${GENDER_ROLES.she}>`,
      ].join("\n"),
    )
    .setFooter({ text: "SunRise" });

  const files: AttachmentBuilder[] = [];
  const png = await renderGenderBanner();
  if (png) {
    files.push(new AttachmentBuilder(png, { name: "gender.png" }));
    embed.setImage("attachment://gender.png");
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(MENU_ID)
    .setPlaceholder("اضغط هنا واختر جنسك")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      { label: "ذكر", description: "He / Him", value: "he", emoji: "💙" },
      { label: "أنثى", description: "She / Her", value: "she", emoji: "💗" },
      { label: "إزالة الرتبة", description: "شيل رتبة الجنس عنك", value: "none", emoji: "✖️" },
    );

  await message.channel
    .send({ embeds: [embed], files, components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] })
    .catch((err) => logger.error("فشل إرسال لوحة الرتب", err));
  await message.delete().catch(() => undefined);
}

export async function handleRolesComponent(i: StringSelectMenuInteraction): Promise<boolean> {
  if (i.customId !== MENU_ID) return false;
  const guild = i.guild;
  if (!guild) return true;
  const member = await guild.members.fetch(i.user.id).catch(() => null);
  if (!member) {
    await i.reply({ content: "❌ ما قدرت أجيب حسابك.", ...eph });
    return true;
  }
  const choice = i.values[0];
  const heRole = guild.roles.cache.get(GENDER_ROLES.he) ?? (await guild.roles.fetch(GENDER_ROLES.he).catch(() => null));
  const sheRole = guild.roles.cache.get(GENDER_ROLES.she) ?? (await guild.roles.fetch(GENDER_ROLES.she).catch(() => null));
  if (!heRole || !sheRole) {
    await i.reply({ content: "❌ رتب الجنس غير موجودة في السيرفر، بلّغ الإدارة.", ...eph });
    return true;
  }

  const wanted = choice === "he" ? heRole : choice === "she" ? sheRole : null;
  const other = choice === "he" ? sheRole : choice === "she" ? heRole : null;
  try {
    if (other && member.roles.cache.has(other.id)) await member.roles.remove(other);
    if (wanted) {
      if (!member.roles.cache.has(wanted.id)) await member.roles.add(wanted);
    } else {
      await member.roles.remove([heRole.id, sheRole.id].filter((id) => member.roles.cache.has(id)));
    }
  } catch (err) {
    logger.error("فشل تغيير رتبة الجنس", err);
    await i.reply({ content: "❌ ما قدرت أعدّل رتبتك (رتبة البوت لازم تكون أعلى من رتب الجنس).", ...eph });
    return true;
  }
  await i.reply({ content: wanted ? `✅ صارت رتبتك <@&${wanted.id}>.` : "✅ انشالت رتبة الجنس عنك.", allowedMentions: { parse: [] }, ...eph });
  return true;
}

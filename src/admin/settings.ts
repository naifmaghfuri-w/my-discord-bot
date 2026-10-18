import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type GuildMember,
  type Interaction,
  type Message,
} from "discord.js";
import { config } from "../config";
import { logger } from "../utils/logger";
import { ADMIN_COMMANDS, getDisabled, toggleCommand } from "./commandToggle";

/** "!إعدادات المسؤول": لوحة تشغيل / إيقاف الأوامر الإدارية */
export const ADMIN_SETTINGS_TRIGGER = /^!\s*[اأإ]عدادات\s+المسؤول$/;

const ON = { id: "1560828496048029736", name: "status_on" };
const OFF = { id: "1560828694417641523", name: "status_off" };
const emojiText = (on: boolean) => (on ? `<:${ON.name}:${ON.id}>` : `<:${OFF.name}:${OFF.id}>`);
const SELECT_ID = "adm|toggle";

function allowed(userId: string, member: GuildMember | null | undefined): boolean {
  if (config.ownerId && userId === config.ownerId) return true;
  return !!member?.permissions.has(PermissionFlagsBits.Administrator);
}

async function buildPanel(guildId: string) {
  const disabled = await getDisabled(guildId);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("إعدادات المسؤول")
    .setDescription(
      [
        ...ADMIN_COMMANDS.map((c) => `${emojiText(!disabled.has(c))} \`!${c}\``),
        "",
        "اختر أمراً من القائمة لتشغيله أو إيقافه.",
      ].join("\n"),
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(SELECT_ID)
    .setPlaceholder("تشغيل / إيقاف أمر إداري")
    .addOptions(
      ADMIN_COMMANDS.map((c) => {
        const on = !disabled.has(c);
        return {
          label: c,
          value: c,
          description: on ? "شغّال — اضغط لإيقافه" : "موقوف — اضغط لتشغيله",
          emoji: on ? ON : OFF,
        };
      }),
    );

  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

export async function handleAdminSettingsMessage(message: Message<true>): Promise<boolean> {
  if (!ADMIN_SETTINGS_TRIGGER.test(message.content.trim())) return false;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!allowed(message.author.id, member)) return true; // بدون صلاحية: ما يصير شي
  await message.channel.send(await buildPanel(message.guildId)).catch(() => undefined);
  return true;
}

export async function handleAdminSettingsInteraction(i: Interaction): Promise<boolean> {
  if (!i.isStringSelectMenu() || i.customId !== SELECT_ID) return false;
  try {
    if (!i.inGuild()) return true;
    const ok = (config.ownerId && i.user.id === config.ownerId) || i.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!ok) {
      await i.reply({ content: "🔒 هذا للمسؤولين فقط.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await toggleCommand(i.guildId, i.values[0]);
    await i.update(await buildPanel(i.guildId));
  } catch (err) {
    logger.error("خطأ في إعدادات المسؤول", err);
  }
  return true;
}

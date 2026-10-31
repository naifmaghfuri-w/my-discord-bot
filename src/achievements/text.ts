import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
  type Guild,
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { renderAchievements, type AchTile } from "./card";
import { ACHIEVEMENTS, NEED, getAchievements } from "./service";

/** !انجازات أو !إنجازات (مع @شخص اختياري) */
export const ACHIEVEMENTS_TRIGGER = /^!\s*[اإأ]نجازات(?:\s+<@!?(\d+)>)?$/;

const cid = (owner: string, target: string, act: string, arg = ""): string => `ach|${owner}|${target}|${act}|${arg}`;

async function buildView(guild: Guild, owner: string, target: string, selected?: string): Promise<BaseMessageOptions> {
  const data = await getAchievements(guild.id, target);
  const member = await guild.members.fetch(target).catch(() => null);
  const name = member?.displayName ?? "لاعب";
  const progress: Record<string, { cur: number; need: number }> = {
    city_guardian: { cur: Math.min(data.jails, NEED.jails), need: NEED.jails },
    too_fast: { cur: Math.min(data.firstStreak, NEED.streak), need: NEED.streak },
    too_slow: { cur: Math.min(data.lastStreak, NEED.streak), need: NEED.streak },
  };
  const tiles: AchTile[] = ACHIEVEMENTS.map((a) => {
    const at = data.unlocked.get(a.id);
    return { id: a.id, name: a.name, desc: a.desc, unlocked: Boolean(at), progress: progress[a.id], at: at ? at.toLocaleDateString("en-GB") : undefined };
  });
  const png = await renderAchievements(name, tiles, selected);

  const embed = new EmbedBuilder().setColor(0x2b2d31);
  if (png) embed.setImage("attachment://achievements.png");
  else embed.setDescription(tiles.map((t) => `${t.unlocked ? "[مفتوح]" : "[مقفل]"} ${t.name} — ${t.desc}`).join("\n"));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(owner, target, "sel"))
    .setPlaceholder("اختر إنجاز لعرض تفاصيله")
    .addOptions(tiles.map((t) => ({ label: t.name, description: t.unlocked ? "مفتوح" : t.progress ? `التقدم ${t.progress.cur}/${t.progress.need}` : "مقفل", value: t.id, default: t.id === selected })));
  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(menu)];
  if (selected) components.push(new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(cid(owner, target, "home")).setLabel("عرض الكل").setStyle(ButtonStyle.Secondary)));
  return { content: "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name: "achievements.png" })] : [], components, allowedMentions: { parse: [] } };
}

export async function handleAchievementsMessage(message: Message, targetId?: string): Promise<void> {
  if (!message.inGuild()) return;
  await message.channel.sendTyping().catch(() => undefined);
  await message.channel.send(await buildView(message.guild, message.author.id, targetId ?? message.author.id)).catch(() => undefined);
}

export async function handleAchievementsComponent(i: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  const [prefix, owner = "", target = "", act = ""] = i.customId.split("|");
  if (prefix !== "ach" || !i.inGuild() || !i.guild) return false;
  if (i.user.id !== owner) {
    await i.reply({ content: "هذي مو لوحتك. اكتب `!انجازات` لتفتح لوحتك.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    return true;
  }
  await i.deferUpdate().catch(() => undefined);
  const selected = act === "sel" && i.isStringSelectMenu() ? i.values[0] : undefined;
  const valid = selected && ACHIEVEMENTS.some((a) => a.id === selected) ? selected : undefined;
  const v = await buildView(i.guild, owner, target, valid);
  await i.editReply({ ...v, attachments: [] }).catch(() => undefined);
  return true;
}

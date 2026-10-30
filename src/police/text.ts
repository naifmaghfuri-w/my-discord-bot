import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type BaseMessageOptions,
  type Guild,
  type Message,
  type MessageComponentInteraction,
} from "discord.js";
import { jenny } from "../constants";
import { KIND_LABEL, POLICE, giveWarning, listPolice, listRecords, payBail, policeJail, warnsOf, type CrimeKind } from "./service";

/** !مركز شرطة */
export const POLICE_TRIGGER = /^!\s*مركز\s*(?:ال)?شرطة$/;

const id = (act: string, arg: string): string => `pol|${act}|${arg}`;

/** صف زر التحذير اللي يتحط تحت رسالة السرقة/النهب */
export function policeWarnRow(crimeId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(id("warn", crimeId)).setEmoji("🚔").setStyle(ButtonStyle.Secondary));
}

async function stationView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const [jailed, warns] = await Promise.all([policeJail(owner, guildId), warnsOf(owner, guildId)]);
  const lines = [
    "الشرطة تحذّر الحرامية والنهّابين، والتحذير الثالث = سجن.",
    `كفالة السجن: ${jenny(POLICE.bail)}`,
    "",
    `تحذيراتك الحالية: **${warns}/${POLICE.maxWarns}**`,
  ];
  if (jailed) lines.push("", "🚨 **أنت مسجون بقرار الشرطة.** ادفع الكفالة عشان تطلع.");
  if (note) lines.unshift(note, "");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(id("rec", owner)).setLabel("سجلات").setStyle(ButtonStyle.Primary));
  if (jailed) row.addComponents(new ButtonBuilder().setCustomId(id("bail", owner)).setLabel(`ادفع ${POLICE.bail} واطلع`).setStyle(ButtonStyle.Success));
  return { content: "", embeds: [new EmbedBuilder().setColor(0x1d4ed8).setTitle("🚔 مركز الشرطة").setDescription(lines.join("\n"))], components: [row] };
}

async function recordsView(owner: string, guild: Guild, policeId?: string): Promise<BaseMessageOptions> {
  const police = await listPolice(guild.id);
  const names = await Promise.all(police.map(async (uid) => (await guild.members.fetch(uid).catch(() => null))?.displayName ?? uid));
  const lines: string[] = [];
  if (!police.length) lines.push("ما فيه أي شرطي حالياً.");
  else if (!policeId) lines.push("اختر شرطي من القائمة تحت لعرض سجلاته.");
  else {
    const { rows, total } = await listRecords(guild.id, policeId);
    lines.push(`سجلات <@${policeId}> — إجمالي التحذيرات: **${total}**`, "");
    if (!rows.length) lines.push("ما أعطى أي تحذير للحين.");
    for (const r of rows) {
      const kind = KIND_LABEL[r.kind as CrimeKind] ?? r.kind;
      lines.push(`• <@${r.offenderId}> — تحذير ${r.warnNo}/${POLICE.maxWarns} على ${kind}${r.place ? ` (${r.place})` : ""}${r.jailed ? " 🚨 انسجن" : ""} — <t:${Math.floor(new Date(r.at).getTime() / 1000)}:R>`);
    }
  }
  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  if (police.length) {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(id("sel", owner))
      .setPlaceholder("اختر شرطي")
      .addOptions(police.map((uid, k) => ({ label: (names[k] as string).slice(0, 100), value: uid, default: uid === policeId })));
    components.push(new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(menu));
  }
  components.push(new ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(id("home", owner)).setLabel("رجوع").setStyle(ButtonStyle.Secondary)));
  return { content: "", embeds: [new EmbedBuilder().setColor(0x1d4ed8).setTitle("📋 سجلات الشرطة").setDescription(lines.join("\n"))], components };
}

export async function handlePoliceMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  await message.channel.send(await stationView(message.author.id, message.guildId)).catch(() => undefined);
}

const WARN_ERR: Record<string, string> = {
  not_police: "❌ التحذير للشرطة فقط.",
  unknown: "❌ هذي السرقة انتهت أو ما عادت موجودة.",
  self: "❌ ما تقدر تحذّر نفسك.",
  expired: "⌛ فات أكثر من نص ساعة على الجريمة، ما تقدر تحذّر.",
  done: "❌ أحد حذّر عليها من قبل.",
  already_jailed: "❌ هذا الشخص مسجون أصلاً.",
};

export async function handlePoliceComponent(i: MessageComponentInteraction): Promise<boolean> {
  if (!i.customId.startsWith("pol|")) return false;
  if (!i.inGuild() || !i.guild) return true;
  const [, act = "", arg = ""] = i.customId.split("|");
  const deny = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  try {
    if (act === "warn") {
      const r = await giveWarning(i.guildId, i.user.id, arg);
      if (!r.ok) {
        await deny(WARN_ERR[r.reason] ?? "❌ تعذّر التحذير.");
        return true;
      }
      // نشيل زر التحذير من الرسالة
      const rows = i.message.components
        .map((row) => row.toJSON() as unknown as { components?: { custom_id?: string }[] })
        .filter((row) => !(row.components ?? []).some((c) => String(c.custom_id ?? "").startsWith("pol|")));
      await i.update({ components: rows } as never).catch(() => undefined);
      const text = r.jailed
        ? `🚔 الشرطي <@${i.user.id}> أعطى <@${r.offenderId}> التحذير **${r.warnNo}/${POLICE.maxWarns}** على ${KIND_LABEL[r.kind]}${r.place ? ` (${r.place})` : ""}.\n🚨 **انسجن!** كفالته ${jenny(POLICE.bail)} (يدفعها من \`!مركز شرطة\`).`
        : `🚔 الشرطي <@${i.user.id}> أعطى <@${r.offenderId}> تحذير **${r.warnNo}/${POLICE.maxWarns}** على ${KIND_LABEL[r.kind]}${r.place ? ` (${r.place})` : ""}.`;
      await i.followUp({ content: text, allowedMentions: { users: [r.offenderId, i.user.id] } }).catch(() => undefined);
      return true;
    }

    // باقي الأزرار: خاصة بصاحب اللوحة
    if (arg !== i.user.id) {
      await deny("هذي مو لوحتك. اكتب `!مركز شرطة` لتفتح لوحتك.");
      return true;
    }
    if (act === "home") await i.update(await stationView(i.user.id, i.guildId));
    else if (act === "rec") await i.update(await recordsView(i.user.id, i.guild));
    else if (act === "sel" && i.isStringSelectMenu()) await i.update(await recordsView(i.user.id, i.guild, i.values[0]));
    else if (act === "bail") {
      if (!(await policeJail(i.user.id, i.guildId))) return (await i.update(await stationView(i.user.id, i.guildId, "ما أنت مسجون بقرار شرطة.")), true);
      const r = await payBail(i.user.id, i.guildId, POLICE.bail);
      await i.update(await stationView(i.user.id, i.guildId, r.ok ? `✅ دفعت الكفالة ${jenny(r.cost)} وطلعت من السجن.` : `❌ ما تكفي محفظتك للكفالة (${jenny(r.cost)}).`));
    }
  } catch (e) {
    console.error("[police]", e);
  }
  return true;
}

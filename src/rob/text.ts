import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type Message,
} from "discord.js";
import { jenny } from "../constants";
import { logger } from "../utils/logger";
import { TRAP_FEE, resolveRob, startRob, type Outcome } from "./service";

/** "!نهب @شخص" أو "!نهب 123456789" أو "!نهب اسم_اليوزر" */
export const ROB_TRIGGER = /^!\s*نهب\s+(\S.*)$/;

/** يحوّل منشن / ايدي / يوزر (أو اسم العرض) إلى ايدي عضو في السيرفر */
async function resolveVictimId(message: Message<true>, query: string): Promise<string | null> {
  const q = query.trim();
  const mention = /^<@!?(\d{15,21})>$/.exec(q);
  if (mention) return mention[1];
  if (/^\d{15,21}$/.test(q)) return q;

  const name = q.replace(/^@/, "").trim().toLowerCase();
  if (!name) return null;
  const members = message.guild.members;
  const match = (m: { user: { username: string; globalName?: string | null }; displayName: string }) =>
    m.user.username.toLowerCase() === name || m.displayName.toLowerCase() === name || (m.user.globalName ?? "").toLowerCase() === name;
  const cached = members.cache.find((m) => !m.user.bot && match(m));
  if (cached) return cached.id;
  const found = await members.search({ query: name, limit: 10 }).catch(() => null);
  const hit = found?.find((m) => !m.user.bot && match(m)) ?? (found && found.filter((m) => !m.user.bot).size === 1 ? found.find((m) => !m.user.bot) : undefined);
  return hit?.id ?? null;
}

const PICK_MS = 30 * 1000;
const NO_PINGS = { parse: [] as never[] };

const OUTCOME_UI: Record<Outcome, { emoji: string; style: ButtonStyle }> = {
  loot: { emoji: "💰", style: ButtonStyle.Success },
  trap: { emoji: "💣", style: ButtonStyle.Danger },
  empty: { emoji: "🕳️", style: ButtonStyle.Primary },
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** الأزرار: مخفية قبل الاختيار، وتنكشف كلها بعده (المختار يظهر عليه "اختيارك") */
function buttons(id: string, layout: Outcome[], picked?: number): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>();
  layout.forEach((outcome, i) => {
    const btn = new ButtonBuilder().setCustomId(`rob|${id}|${i}`);
    if (picked === undefined) {
      btn.setEmoji("🎁").setLabel("-").setStyle(ButtonStyle.Secondary);
    } else {
      const ui = OUTCOME_UI[outcome];
      btn.setEmoji(ui.emoji).setStyle(ui.style).setDisabled(true);
      if (i === picked) btn.setLabel("اختيارك");
      else btn.setLabel("-");
    }
    row.addComponents(btn);
  });
  return [row];
}

export async function handleRobMessage(message: Message<true>, query: string): Promise<void> {
  const robberId = message.author.id;
  const guildId = message.guildId;
  const reply = (content: string) =>
    message.reply({ content, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);

  const victimId = await resolveVictimId(message, query);
  const victim = victimId ? await message.client.users.fetch(victimId).catch(() => null) : null;
  const inGuild = victimId ? await message.guild.members.fetch(victimId).then(() => true).catch(() => false) : false;
  if (!victimId || !victim || victim.bot || !inGuild) {
    await reply("❌ ما لقيت هذا العضو. اكتب منشنه أو الايدي أو اليوزر.");
    return;
  }

  const start = await startRob(robberId, victimId, guildId).catch((err) => {
    logger.error("فشل بدء النهب", err);
    return null;
  });
  if (!start) {
    await reply("❌ صار خطأ، حاول لاحقاً.");
    return;
  }
  if (!start.ok) {
    const unix = (ms: number) => Math.floor(ms / 1000);
    const texts = {
      self: "❌ ما تقدر تنهب نفسك.",
      cooldown: start.reason === "cooldown" ? `⏳ تقدر تنهب مرة ثانية <t:${unix(Date.now() + start.msLeft)}:R>` : "",
      robber_too_poor: "❌ محفظتك ما تكفي لتجهيز عملية نهب.",
      victim_immune: start.reason === "victim_immune" ? `🛡️ هذا العضو محمي من النهب، تنتهي حمايته <t:${unix(start.until)}:R>` : "",
      victim_too_poor: "❌ محفظة هذا العضو ما فيها شي يستاهل.",
    } as const;
    await reply(texts[start.reason]);
    return;
  }

  const layout = shuffle<Outcome>(["loot", "trap", "empty"]);
  const id = Math.random().toString(36).slice(2, 8);
  const author = { name: message.member?.displayName ?? message.author.username, iconURL: message.author.displayAvatarURL() };

  const intro = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor(author)
    .setTitle("نهب")
    .setThumbnail(victim.displayAvatarURL())
    .setDescription(
      [
        "يجب عليك تخمين مكان المال وتجنب الفخ لتتم عملية النهب بنجاح.",
        "يوجد ثلاثة أماكن: واحد فيه مال، وثاني فيه فخ، وثالث فارغ.",
        `في حال اخترت الفخ ستفشل عملية النهب وتدفع تعويضاً ${jenny(TRAP_FEE)}.`,
      ].join("\n"),
    )
    .setFooter({ text: "عندك 30 ثانية للاختيار" });

  const sent = await message.channel
    .send({ content: `${message.author}`, embeds: [intro], components: buttons(id, layout), allowedMentions: NO_PINGS })
    .catch((err: unknown) => {
      logger.error("فشل إرسال لعبة النهب", err);
      return null;
    });
  if (!sent) return;

  let done = false;
  const collector = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: PICK_MS });

  collector.on("collect", async (i) => {
    if (i.user.id !== robberId) {
      await i.reply({ content: "❌ هذي العملية مو لك.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
      return;
    }
    if (done) return;
    done = true;
    collector.stop("picked");

    try {
      await i.deferUpdate();
      const index = Number(i.customId.split("|")[2]);
      const outcome = layout[index];
      const result = await resolveRob(robberId, victimId, guildId, outcome);

      const embed = new EmbedBuilder().setAuthor(author).setTitle("نهب").setThumbnail(victim.displayAvatarURL());
      if (result.outcome === "loot") {
        embed
          .setColor(0x22c55e)
          .setDescription(`🤑 تم نهب ${jenny(result.amount)} من رصيد <@${victimId}> بنجاح!\nرصيدك الحالي: ${jenny(result.coins)}`);
      } else if (result.outcome === "trap") {
        embed
          .setColor(0xef4444)
          .setDescription(
            result.fee > 0
              ? `💣 وقعت في الفخ! فشلت عملية النهب ودفعت تعويضاً ${jenny(result.fee)} لـ <@${victimId}>.\nرصيدك الحالي: ${jenny(result.coins)}`
              : "💣 وقعت في الفخ! فشلت عملية النهب.",
          );
      } else {
        embed.setColor(0x64748b).setDescription("🕳️ المكان كان فارغ! فشلت عملية النهب.");
      }

      await i.editReply({ embeds: [embed], components: buttons(id, layout, index), allowedMentions: NO_PINGS });
    } catch (err) {
      logger.error("فشل حل لعبة النهب", err);
    }
  });

  collector.on("end", async (_collected, reason) => {
    if (reason !== "time" || done) return;
    done = true;
    const expired = new EmbedBuilder()
      .setColor(0x64748b)
      .setAuthor(author)
      .setTitle("نهب")
      .setDescription("⏰ انتهى الوقت وانلغت عملية النهب.");
    await sent
      .edit({ embeds: [expired], components: buttons(id, layout, -1), allowedMentions: NO_PINGS })
      .catch(() => undefined);
  });
}

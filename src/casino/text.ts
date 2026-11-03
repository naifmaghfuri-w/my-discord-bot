import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle,
  type ButtonInteraction, type Message, type ModalSubmitInteraction,
} from "discord.js";
import { trackCasinoLoss } from "../achievements/service";
import { jenny } from "../constants";
import { Inventory } from "../database/models/Inventory";
import { UserProfile } from "../database/models/UserProfile";
import { ITEMS } from "../shop/data";
import { logger } from "../utils/logger";

/** !كازينو */
export const CASINO_TRIGGER = /^!\s*كازينو$/;

/** إعدادات الكازينو (عدّلها من هنا) */
export const CASINO = {
  minBet: 50,
  maxBet: 10_000,
  /** نسبة الإرجاع في النرد: 0.95 = أفضلية البيت 5٪ */
  rtp: 0.95,
  /** أعلى مضاعف في النرد */
  maxMult: 10,
  /** سعر لفة عجلة الحظ */
  wheelCost: 1_000,
  /** السيارة اللي في العجلة (لو عنده نفسها ياخذ نص سعرها) */
  wheelCar: "cherry_arrizo" as "cherry_arrizo" | "land_cruiser" | "rolls_royce",
} as const;

type Seg = { label: string; weight: number; kind: "empty" | "loss" | "cash" | "car"; value: number };
/** قطاعات العجلة: المجموع 100. كل المبالغ أقل من سعر اللفة، والسيارة نادرة جدًا */
const WHEEL: Seg[] = [
  { label: "حظ سيء، ما ربحت شيء", weight: 12, kind: "empty", value: 0 },
  { label: "حرامي سرق من محفظتك (خسارة إضافية)", weight: 6, kind: "loss", value: 300 },
  { label: "ربحت", weight: 14, kind: "cash", value: 200 },
  { label: "ربحت", weight: 18, kind: "cash", value: 400 },
  { label: "ربحت", weight: 18, kind: "cash", value: 600 },
  { label: "ربحت", weight: 14, kind: "cash", value: 800 },
  { label: "ربحت", weight: 17.5, kind: "cash", value: 950 },
  { label: "السيارة الكبرى", weight: 0.5, kind: "car", value: 0 },
];

const eph = { flags: MessageFlags.Ephemeral } as const;
const COLOR = 0x9b59b6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const btn = (id: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);
const toNum = (s: string): number => {
  const t = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d]/g, "");
  return t ? Number(t) : NaN;
};

/* ───────── القائمة الرئيسية ───────── */

function hubView() {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("الكازينو")
    .setDescription(
      [
        "**نرد / أعلى أم أقل:** تراهن، يطلع لك رقم، وتخمّن هل الرقم القادم أعلى أو أقل. كل ما كان تخمينك أصعب كان المضاعف أكبر.",
        `**عجلة الحظ:** لفة بـ ${jenny(CASINO.wheelCost)}، والجوائز أقل من سعر اللفة وفيها شيء سيء، ولها سيارة نادرة جدًا.`,
        "",
        `الرهان في النرد من ${CASINO.minBet.toLocaleString("en-US")} إلى ${CASINO.maxBet.toLocaleString("en-US")}.`,
      ].join("\n"),
    );
  return { embeds: [embed], components: [row(btn("cas|dice", "نرد / أعلى أم أقل", ButtonStyle.Primary), btn("cas|wheel", `عجلة الحظ (${CASINO.wheelCost.toLocaleString("en-US")})`, ButtonStyle.Success))] };
}

export async function handleCasinoMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  await message.channel.send(hubView()).catch(() => undefined);
}

/* ───────── مساعدات الفلوس ───────── */

/** يخصم المبلغ بشكل ذري. false لو ما يكفي */
async function take(userId: string, guildId: string, amount: number): Promise<boolean> {
  const r = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: amount } }, { $inc: { coins: -amount } });
  return Boolean(r);
}
async function give(userId: string, guildId: string, amount: number): Promise<void> {
  if (amount > 0) await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: amount } }, { upsert: true });
}
function noteLoss(guildId: string, userId: string, net: number): void {
  if (net < 0) void trackCasinoLoss(guildId, userId, -net).catch((err) => logger.error("فشل تتبع خسارة الكازينو", err));
}

/* ───────── نرد / أعلى أم أقل ───────── */

/** المضاعف حسب احتمال الفوز (p = عدد النتائج الرابحة من 100) */
function mult(p: number): number {
  return Math.min(CASINO.maxMult, Math.floor(((CASINO.rtp * 100) / Math.max(1, p)) * 100) / 100);
}

function diceView(uid: string, bet: number, base: number) {
  const pHi = 100 - base;
  const pLo = base - 1;
  const mHi = mult(pHi);
  const mLo = mult(pLo);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("نرد / أعلى أم أقل")
    .setDescription(
      [
        `الرهان: ${jenny(bet)}`,
        `رقمك الحالي: **${base}** (الأرقام من 1 إلى 100)`,
        "الرقم القادم يطلع من 1 إلى 100، والتعادل = خسارة.",
        "",
        `أعلى: احتمال ${pHi}٪ × **${mHi}**`,
        `أقل: احتمال ${pLo}٪ × **${mLo}**`,
      ].join("\n"),
    );
  return {
    embeds: [embed],
    components: [row(btn(`cas|hi|${uid}|${bet}|${base}`, `أعلى (×${mHi})`, ButtonStyle.Success), btn(`cas|lo|${uid}|${bet}|${base}`, `أقل (×${mLo})`, ButtonStyle.Danger), btn("cas|x", "إلغاء"))],
  };
}

async function playDice(i: ButtonInteraction, dir: "hi" | "lo", uid: string, bet: number, base: number): Promise<void> {
  const guildId = i.guildId as string;
  if (i.user.id !== uid) return void (await i.reply({ content: "هذي مو لعبتك.", ...eph }));
  if (!(bet >= CASINO.minBet && bet <= CASINO.maxBet) || !(base >= 10 && base <= 90)) return void (await i.update({ content: "بيانات غير صالحة.", embeds: [], components: [] }));
  if (!(await take(uid, guildId, bet))) return void (await i.update({ content: `ما تكفي محفظتك للرهان (${jenny(bet)}).`, embeds: [], components: [] }));

  const roll = 1 + Math.floor(Math.random() * 100);
  const win = dir === "hi" ? roll > base : roll < base;
  const m = mult(dir === "hi" ? 100 - base : base - 1);
  const payout = win ? Math.floor(bet * m) : 0;
  await give(uid, guildId, payout);
  noteLoss(guildId, uid, payout - bet);

  const embed = new EmbedBuilder()
    .setColor(win ? 0x2ecc71 : 0xe74c3c)
    .setTitle(win ? "ربحت" : roll === base ? "تعادل (خسارة)" : "خسرت")
    .setDescription(
      [
        `رقمك: **${base}** ← الرقم القادم: **${roll}**`,
        `اخترت: ${dir === "hi" ? "أعلى" : "أقل"}`,
        win ? `الجائزة: ${jenny(payout)} (×${m})` : `خسرت ${jenny(bet)}`,
      ].join("\n"),
    );
  await i.update({ embeds: [embed], components: [row(btn("cas|dice", "العب مرة ثانية", ButtonStyle.Primary))] });
}

/* ───────── عجلة الحظ ───────── */

function pickSeg(): Seg {
  const total = WHEEL.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const s of WHEEL) {
    r -= s.weight;
    if (r < 0) return s;
  }
  return WHEEL[0];
}

async function spinWheel(i: ButtonInteraction): Promise<void> {
  const guildId = i.guildId as string;
  const uid = i.user.id;
  if (!(await take(uid, guildId, CASINO.wheelCost))) return void (await i.reply({ content: `ما تكفي محفظتك (${jenny(CASINO.wheelCost)}).`, ...eph }));
  await i.reply({ content: "العجلة تدور...", ...eph });
  await sleep(2000);

  const seg = pickSeg();
  let payout = 0;
  let extraLoss = 0;
  let text = "";
  if (seg.kind === "cash") {
    payout = seg.value;
    text = `ربحت ${jenny(payout)}`;
  } else if (seg.kind === "empty") {
    text = seg.label;
  } else if (seg.kind === "loss") {
    const p = await UserProfile.findOne({ userId: uid, guildId }, { coins: 1 });
    const t = Math.min(seg.value, p?.coins ?? 0);
    if (t > 0 && (await take(uid, guildId, t))) extraLoss = t;
    text = `${seg.label}: خسرت ${jenny(extraLoss)} زيادة`;
  } else {
    const key = CASINO.wheelCar;
    const reserved = await Inventory.findOneAndUpdate({ userId: uid, guildId, [`items.${key}`]: { $not: { $gte: 1 } } }, { $inc: { [`items.${key}`]: 1 } }, { upsert: true }).then(() => true, () => false);
    if (reserved) {
      text = `**${ITEMS[key].name}**! ربحت السيارة الكبرى، شوفها في !مقتنياتي`;
      if (i.channel && "send" in i.channel) await i.channel.send({ content: `<@${uid}> ربح **${ITEMS[key].name}** من عجلة الحظ!`, allowedMentions: { users: [uid] } }).catch(() => undefined);
    } else {
      payout = Math.floor(ITEMS[key].price / 2);
      text = `طلعت لك ${ITEMS[key].name} وعندك نفسها، فأخذت نص سعرها ${jenny(payout)}`;
    }
  }
  await give(uid, guildId, payout);
  noteLoss(guildId, uid, payout - CASINO.wheelCost - extraLoss);

  const good = payout > CASINO.wheelCost || seg.kind === "car";
  const embed = new EmbedBuilder().setColor(good ? 0x2ecc71 : payout > 0 ? 0xf1c40f : 0xe74c3c).setTitle("عجلة الحظ").setDescription(`${text}\n\nكلفة اللفة: ${jenny(CASINO.wheelCost)}`);
  await i.editReply({ content: "", embeds: [embed], components: [row(btn("cas|wheel", `لفة ثانية (${CASINO.wheelCost.toLocaleString("en-US")})`, ButtonStyle.Success))] });
}

/* ───────── التفاعلات ───────── */

export async function handleCasinoComponent(i: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  if (!i.inGuild()) return;
  const [, act, a, b, c] = i.customId.split("|");

  if (i.isButton()) {
    if (act === "dice") {
      const m = new ModalBuilder()
        .setCustomId("cas|dicem")
        .setTitle("نرد / أعلى أم أقل")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("bet").setLabel(`الرهان (${CASINO.minBet} - ${CASINO.maxBet})`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setPlaceholder("500"),
          ),
        );
      return void (await i.showModal(m));
    }
    if (act === "wheel") return await spinWheel(i);
    if (act === "x") return void (await i.update({ content: "تم الإلغاء.", embeds: [], components: [] }));
    if (act === "hi" || act === "lo") return await playDice(i, act, a, Number(b), Number(c));
    return;
  }

  if (i.isModalSubmit() && act === "dicem") {
    const bet = toNum(i.fields.getTextInputValue("bet"));
    if (!(bet >= CASINO.minBet && bet <= CASINO.maxBet)) return void (await i.reply({ content: `الرهان لازم بين ${CASINO.minBet} و ${CASINO.maxBet}.`, ...eph }));
    const p = await UserProfile.findOne({ userId: i.user.id, guildId: i.guildId as string }, { coins: 1 });
    if ((p?.coins ?? 0) < bet) return void (await i.reply({ content: `ما تكفي محفظتك (${jenny(bet)}).`, ...eph }));
    const base = 10 + Math.floor(Math.random() * 81); // 10..90 عشان كل جهة لها فرصة معقولة
    await i.reply({ ...diceView(i.user.id, bet, base), ...eph });
  }
}

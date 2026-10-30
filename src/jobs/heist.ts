import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type Message,
  type MessageComponentInteraction,
  type MessageEditOptions,
} from "discord.js";
import { HeistState } from "../database/models/HeistState";
import { Inventory } from "../database/models/Inventory";
import { JobProfile } from "../database/models/JobProfile";
import { ThiefState } from "../database/models/ThiefState";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { CAR_IDS, ITEMS, PHONE_IDS, type CarId, type PhoneId } from "../shop/data";
import { renderHeistBoard, renderHeistResult, renderHeistRoster, type RosterRow } from "./heistCard";
import { getJob } from "./service";
import { fmtMs } from "./views";

const MIN = 60_000;

export const HEIST = {
  cooldownMs: 6 * 60 * MIN,
  lobbyMs: 60_000,
  idleMs: 10 * MIN,
  prepMs: 5_000,
  vaultMs: 45_000,
  boxes: 10,
  box: { min: 100, max: 250 },
  camEveryMs: 10_000,
  camWindowMs: 5_000,
  threatEveryMs: 15_000,
  threatWindowMs: 5_000,
  threatPenalty: 0.25,
  jailMs: 90 * MIN,
  minPct: 10,
} as const;

/** وقت الهروب حسب أفضل سيارة يملكها السائق */
const ESCAPE_MS: Record<CarId, number> = { cherry_arrizo: 20_000, land_cruiser: 25_000, rolls_royce: 30_000 };
/** ثواني إضافية لنافذة الكاميرا حسب أفضل هاتف يملكه الهكر */
const PHONE_BONUS_MS: Record<PhoneId, number> = { huawei: 0, galaxy_note_19: 1_000, iphone_18: 2_000 };

type Role = "thief" | "hacker" | "threat" | "driver";
const ROLES: Role[] = ["thief", "hacker", "threat", "driver"];
const ROLE_NAME: Record<Role, string> = { thief: "الحرامي", hacker: "الهكر", threat: "المهدد", driver: "السائق" };
const ROLE_DESC: Record<Role, string> = {
  thief: `يفتح الصناديق بالرموز (${HEIST.boxes} في ${HEIST.vaultMs / 1000} ثانية)`,
  hacker: `يعطّل الكاميرا كل ${HEIST.camEveryMs / 1000} ثواني`,
  threat: `يهدد المواطن كل ${HEIST.threatEveryMs / 1000} ثانية`,
  driver: "يشغّل السيارة ويهربون (لازم عنده سيارة)",
};

type EscKey = "key" | "brake" | "gas";
const ESC_ORDER: EscKey[] = ["key", "brake", "gas"];
const ESC_LABEL: Record<EscKey, string> = { key: "🔑 دوّر المفتاح", brake: "🦶 فك الفرامل", gas: "⛽ دعس البنزين" };
const ESC_PLAIN: Record<EscKey, string> = { key: "المفتاح", brake: "الفرامل", gas: "البنزين" };

interface Member {
  userId: string;
  name: string;
  role: Role | null;
  pct: number;
  status: "wait" | "yes" | "no";
}
interface Box {
  code: string;
  amount: number;
  state: "pending" | "open" | "fail";
}
interface Heist {
  leaderId: string;
  guildId: string;
  phase: "pick" | "config" | "confirm" | "invite" | "prep" | "vault" | "escape" | "done";
  members: Member[];
  cfg: { i: number; role: Role | null; pct: number | null };
  message: Message | null;
  cdBefore: Date | null | undefined;
  lobbyTimer?: NodeJS.Timeout;
  idleTimer?: NodeJS.Timeout;
  ticker?: NodeJS.Timeout;
  ticking: boolean;
  needRender: boolean;
  rendering: boolean;
  lastEditAt: number;
  startAt: number;
  endAt: number;
  boxes: Box[];
  boxIdx: number;
  typed: string;
  loot: number;
  cam: { nextAt: number; until: number | null; windowMs: number };
  thr: { nextAt: number; until: number | null; misses: number };
  esc: { until: number; totalMs: number; step: number; layout: EscKey[]; car: string };
  log: string;
}

const heists = new Map<string, Heist>();
/** userId → leaderId (مين داخل عملية الحين) */
const busy = new Map<string, string>();

type AnyRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder> | ActionRowBuilder<UserSelectMenuBuilder>;

const cid = (leader: string, act: string, arg?: string): string => ["hst", leader, act, arg].filter((x) => x !== undefined).join("|");
const isDone = (h: Heist): boolean => h.phase === "done";
const mem = (h: Heist, idx: number): Member => h.members[idx] as Member;
const roleOf = (h: Heist, userId: string): Role | null => h.members.find((m) => m.userId === userId)?.role ?? null;
const nameOfRole = (h: Heist, r: Role): string => h.members.find((m) => m.role === r)?.name ?? "-";
const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let k = r.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [r[k], r[j]] = [r[j] as T, r[k] as T];
  }
  return r;
};

/* ───────────────── قاعدة البيانات والمخزن ───────────────── */

async function jailLeft(userId: string, guildId: string): Promise<number> {
  const st = await ThiefState.findOne({ userId, guildId }, { jailUntil: 1 });
  return st?.jailUntil ? Math.max(0, new Date(st.jailUntil).getTime() - Date.now()) : 0;
}

export async function heistCooldownLeft(userId: string, guildId: string): Promise<number> {
  const st = await HeistState.findOne({ userId, guildId }, { at: 1 });
  const at = st?.at ? new Date(st.at).getTime() : 0;
  return Math.max(0, HEIST.cooldownMs - (Date.now() - at));
}

async function reserveCooldown(h: Heist): Promise<boolean> {
  const f = { userId: h.leaderId, guildId: h.guildId };
  await HeistState.updateOne(f, { $setOnInsert: { at: null } }, { upsert: true }).catch(() => undefined);
  const now = Date.now();
  const before = await HeistState.findOneAndUpdate({ ...f, $or: [{ at: null }, { at: { $lte: new Date(now - HEIST.cooldownMs) } }] }, { $set: { at: new Date(now) } });
  if (!before) return false;
  h.cdBefore = before.at ?? null;
  return true;
}

async function revertCooldown(h: Heist): Promise<void> {
  if (h.cdBefore === undefined) return;
  const at = h.cdBefore;
  h.cdBefore = undefined;
  await HeistState.updateOne({ userId: h.leaderId, guildId: h.guildId }, { $set: { at } }).catch(() => undefined);
}

async function itemsOf(userId: string, guildId: string): Promise<(k: string) => number> {
  const inv = await Inventory.findOne({ userId, guildId }, { items: 1 });
  const raw = inv?.items as unknown;
  return (k) => Number(raw instanceof Map ? raw.get(k) : (raw as Record<string, number> | undefined)?.[k]) || 0;
}

async function bestCar(userId: string, guildId: string): Promise<{ ms: number; name: string } | null> {
  const have = await itemsOf(userId, guildId);
  let best: { ms: number; name: string } | null = null;
  for (const id of CAR_IDS) if (have(id) > 0 && (!best || ESCAPE_MS[id] > best.ms)) best = { ms: ESCAPE_MS[id], name: ITEMS[id].name };
  return best;
}

async function phoneBonus(userId: string, guildId: string): Promise<number> {
  const have = await itemsOf(userId, guildId);
  let best = 0;
  for (const id of PHONE_IDS) if (have(id) > 0) best = Math.max(best, PHONE_BONUS_MS[id]);
  return best;
}

/* ───────────────── الواجهات ───────────────── */

function cardView(png: Buffer | null, file: string, fallback: string, components: AnyRow[], note?: string): MessageEditOptions {
  const embed = new EmbedBuilder().setColor(0x2c2f33);
  if (png) embed.setImage(`attachment://${file}`);
  if (note) embed.setDescription(note);
  else if (!png) embed.setDescription(fallback);
  return { content: "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name: file })] : [], attachments: [], components };
}

function textView(text: string): MessageEditOptions {
  return { content: "", embeds: [new EmbedBuilder().setColor(0x475569).setDescription(text)], files: [], attachments: [], components: [] };
}

const btn = (id: string, label: string, style: ButtonStyle): ButtonBuilder => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...b: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder> => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);

function pickView(h: Heist, note?: string): MessageEditOptions {
  const lines = [
    "**سطو البنك** — اختر **3 أشخاص** يشاركونك (مو لازم يكونون حرامية).",
    "",
    ...ROLES.map((r) => `• **${ROLE_NAME[r]}:** ${ROLE_DESC[r]}`),
    "",
    `الغنيمة من ${HEIST.boxes} صناديق، كل صندوق من ${HEIST.box.min} إلى ${HEIST.box.max}. وتتوزع بالنسب اللي تحددها.`,
    "إذا الكاميرا ما انعطلت في وقتها أو السيارة ما اشتغلت: كلكم تنسجنون.",
  ];
  if (note) lines.unshift(note, "");
  const sel = new UserSelectMenuBuilder().setCustomId(cid(h.leaderId, "pick")).setPlaceholder("اختر 3 أشخاص").setMinValues(3).setMaxValues(3);
  return {
    content: "",
    embeds: [new EmbedBuilder().setColor(0xb91c1c).setDescription(lines.join("\n"))],
    files: [],
    attachments: [],
    components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(sel), row(btn(cid(h.leaderId, "cancel"), "إلغاء", ButtonStyle.Secondary))],
  };
}

function rosterRows(h: Heist, showStatus: boolean, current = -1): RosterRow[] {
  return h.members.map((m, idx) => ({
    name: m.name,
    role: m.role ? ROLE_NAME[m.role] : null,
    pct: m.role ? m.pct : null,
    status: showStatus ? m.status : "none",
    current: idx === current,
  }));
}

async function cfgView(h: Heist, note?: string): Promise<MessageEditOptions> {
  const i = h.cfg.i;
  const m = mem(h, i);
  const taken = new Set(h.members.slice(0, i).map((x) => x.role));
  const assigned = h.members.slice(0, i).reduce((s, x) => s + x.pct, 0);
  const maxPct = 100 - assigned - HEIST.minPct * (3 - i);
  const pcts: number[] = [];
  for (let p = HEIST.minPct; p <= maxPct; p += 5) pcts.push(p);

  const roleSel = new StringSelectMenuBuilder()
    .setCustomId(cid(h.leaderId, "role"))
    .setPlaceholder(`دور ${m.name}`)
    .addOptions(ROLES.filter((r) => !taken.has(r)).map((r) => ({ label: ROLE_NAME[r], description: ROLE_DESC[r], value: r, default: h.cfg.role === r })));
  const pctSel = new StringSelectMenuBuilder()
    .setCustomId(cid(h.leaderId, "pct"))
    .setPlaceholder(`نسبة ${m.name}`)
    .addOptions(pcts.map((p) => ({ label: `${p}%`, value: String(p), default: h.cfg.pct === p })));

  const png = await renderHeistRoster("سطو البنك", `اختر دور ونسبة ${m.name} (${i + 1}/4)`, rosterRows(h, false, i));
  return cardView(
    png,
    "heist.png",
    `اختر دور ونسبة ${m.name}`,
    [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleSel), new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(pctSel), row(btn(cid(h.leaderId, "cancel"), "إلغاء", ButtonStyle.Secondary))],
    note,
  );
}

async function confirmView(h: Heist, note?: string): Promise<MessageEditOptions> {
  const png = await renderHeistRoster("سطو البنك", "راجع الفريق ثم أرسل الدعوات", rosterRows(h, false));
  return cardView(png, "heist.png", "راجع الفريق", [row(btn(cid(h.leaderId, "send"), "إرسال الدعوات", ButtonStyle.Success), btn(cid(h.leaderId, "redo"), "إعادة الإعداد", ButtonStyle.Primary), btn(cid(h.leaderId, "cancel"), "إلغاء", ButtonStyle.Secondary))], note);
}

async function lobbyView(h: Heist): Promise<MessageEditOptions> {
  const png = await renderHeistRoster("سطو البنك", `الكل لازم يوافق خلال ${HEIST.lobbyMs / 1000} ثانية`, rosterRows(h, true));
  return cardView(png, "heist.png", "بانتظار الموافقة", [row(btn(cid(h.leaderId, "acc"), "موافق", ButtonStyle.Success), btn(cid(h.leaderId, "dec"), "رفض", ButtonStyle.Danger), btn(cid(h.leaderId, "cancel"), "إلغاء (القائد)", ButtonStyle.Secondary))]);
}

function boardRows(h: Heist): AnyRow[] {
  if (h.phase === "vault") {
    const d = (n: number) => btn(cid(h.leaderId, "d", String(n)), String(n), ButtonStyle.Secondary);
    return [
      row(...[1, 2, 3, 4, 5].map(d)),
      row(...[6, 7, 8, 9, 0].map(d)),
      row(btn(cid(h.leaderId, "cam"), "🔌 عطّل الكاميرا", h.cam.until !== null ? ButtonStyle.Danger : ButtonStyle.Secondary), btn(cid(h.leaderId, "thr"), "🗣️ هدّد المواطن", h.thr.until !== null ? ButtonStyle.Danger : ButtonStyle.Secondary)),
    ];
  }
  if (h.phase === "escape") return [row(...h.esc.layout.map((k) => btn(cid(h.leaderId, "esc", k), ESC_LABEL[k], ButtonStyle.Primary)))];
  return [];
}

async function board(h: Heist): Promise<MessageEditOptions> {
  const now = Date.now();
  const phase = h.phase === "escape" ? "escape" : h.phase === "vault" ? "vault" : "prep";
  const leftMs = phase === "prep" ? h.startAt - now : phase === "vault" ? h.endAt - now : h.esc.until - now;
  const totalMs = phase === "prep" ? HEIST.prepMs : phase === "vault" ? HEIST.vaultMs : h.esc.totalMs;
  const png = await renderHeistBoard({
    phase,
    leftMs,
    totalMs,
    boxes: h.boxes.map((b) => ({ state: b.state, amount: b.amount })),
    boxIdx: h.boxIdx,
    code: h.boxes[h.boxIdx]?.code ?? "",
    typed: h.typed,
    loot: h.loot,
    misses: h.thr.misses,
    missPct: Math.min(100, Math.round(h.thr.misses * HEIST.threatPenalty * 100)),
    cam: { alert: h.cam.until !== null, leftMs: (h.cam.until ?? now) - now },
    thr: { alert: h.thr.until !== null, leftMs: (h.thr.until ?? now) - now },
    esc: { step: h.esc.step, order: ESC_ORDER.map((k) => ESC_PLAIN[k]), car: h.esc.car },
    names: { hacker: nameOfRole(h, "hacker"), threat: nameOfRole(h, "threat"), driver: nameOfRole(h, "driver") },
    log: h.log,
  });
  return cardView(png, "heist.png", `سطو البنك — الغنيمة ${h.loot}`, boardRows(h));
}

/* ───────────────── دورة حياة العملية ───────────────── */

function cleanup(h: Heist): void {
  h.phase = "done";
  if (h.lobbyTimer) clearTimeout(h.lobbyTimer);
  if (h.idleTimer) clearTimeout(h.idleTimer);
  if (h.ticker) clearInterval(h.ticker);
  for (const m of h.members) if (busy.get(m.userId) === h.leaderId) busy.delete(m.userId);
  if (heists.get(h.leaderId) === h) heists.delete(h.leaderId);
}

/** يلغي العملية قبل ما تبدأ ويرجّع المهلة */
async function closeHeist(h: Heist, text: string): Promise<MessageEditOptions> {
  cleanup(h);
  await revertCooldown(h);
  return textView(text);
}

async function failHeist(h: Heist, reason: string): Promise<void> {
  if (h.phase === "done") return;
  const members = [...h.members];
  const misses = h.thr.misses;
  cleanup(h);
  const until = new Date(Date.now() + HEIST.jailMs);
  await Promise.all(members.map((m) => ThiefState.updateOne({ userId: m.userId, guildId: h.guildId }, { $set: { jailUntil: until, caught: 0 } }, { upsert: true }).catch(() => undefined)));
  const png = await renderHeistResult("caught", { total: 0, misses, missPct: 0, reason, jail: fmtMs(HEIST.jailMs), rows: [] });
  await h.message?.edit(cardView(png, "heist.png", `🚨 انمسكتوا! ${reason}\nكلكم مسجونين ${fmtMs(HEIST.jailMs)}.`, [])).catch(() => undefined);
}

async function finishSuccess(h: Heist): Promise<void> {
  if (h.phase === "done") return;
  const members = [...h.members];
  const misses = h.thr.misses;
  const missPct = Math.min(100, Math.round(misses * HEIST.threatPenalty * 100));
  const net = Math.floor(h.loot * (1 - missPct / 100));
  cleanup(h);
  const rows = members.map((m) => ({ name: m.name, role: ROLE_NAME[m.role ?? "thief"], pct: m.pct, amount: Math.floor((net * m.pct) / 100) }));
  for (const [idx, r] of rows.entries()) {
    const m = mem({ members } as Heist, idx);
    if (r.amount <= 0) continue;
    await UserProfile.updateOne({ userId: m.userId, guildId: h.guildId }, { $inc: { coins: r.amount } }, { upsert: true }).catch(() => undefined);
    await logTransaction(h.guildId, m.userId, "salary", r.amount).catch(() => undefined);
  }
  await JobProfile.updateOne({ userId: h.leaderId, guildId: h.guildId }, { $set: { lastActiveAt: new Date() }, $inc: { shifts: 1 } }).catch(() => undefined);
  const png = await renderHeistResult("success", { total: net, misses, missPct, reason: "", jail: "", rows });
  await h.message?.edit(cardView(png, "heist.png", `✅ نجح السطو! الغنيمة ${net}\n${rows.map((r) => `${r.name}: +${r.amount}`).join("\n")}`, [])).catch(() => undefined);
}

function finishVault(h: Heist): void {
  h.phase = "escape";
  h.cam.until = null;
  h.thr.until = null;
  h.esc.until = Date.now() + h.esc.totalMs;
  h.esc.step = 0;
  h.esc.layout = shuffle(ESC_ORDER);
  h.log = `خلصت الصناديق! السائق: اضغط ${ESC_ORDER.map((k) => ESC_PLAIN[k]).join(" ثم ")} بالترتيب`;
  h.needRender = true;
}

async function startPrep(h: Heist): Promise<string | null> {
  const hacker = h.members.find((m) => m.role === "hacker") as Member;
  const driver = h.members.find((m) => m.role === "driver") as Member;
  const car = await bestCar(driver.userId, h.guildId);
  if (!car) return `❌ انلغت العملية: السائق **${driver.name}** ما عنده سيارة.`;
  const bonus = await phoneBonus(hacker.userId, h.guildId);
  if (h.lobbyTimer) clearTimeout(h.lobbyTimer);
  const now = Date.now();
  h.phase = "prep";
  h.startAt = now + HEIST.prepMs;
  h.endAt = h.startAt + HEIST.vaultMs;
  h.boxes = Array.from({ length: HEIST.boxes }, () => ({
    code: String(Math.floor(Math.random() * 10000)).padStart(4, "0"),
    amount: HEIST.box.min + Math.floor(Math.random() * (HEIST.box.max - HEIST.box.min + 1)),
    state: "pending" as const,
  }));
  h.cam = { nextAt: 0, until: null, windowMs: HEIST.camWindowMs + bonus };
  h.thr = { nextAt: 0, until: null, misses: 0 };
  h.esc = { until: 0, totalMs: car.ms, step: 0, layout: ESC_ORDER, car: car.name };
  h.log = bonus > 0 ? `هاتف الهكر يعطيه +${bonus / 1000} ثانية للكاميرا` : "";
  h.lastEditAt = now;
  h.ticker = setInterval(() => void tick(h), 400);
  return null;
}

async function tick(h: Heist): Promise<void> {
  if (h.ticking || h.phase === "done") return;
  h.ticking = true;
  try {
    const now = Date.now();
    if (h.phase === "prep" && now >= h.startAt) {
      h.phase = "vault";
      h.cam.nextAt = h.startAt + HEIST.camEveryMs;
      h.thr.nextAt = h.startAt + HEIST.threatEveryMs;
      h.needRender = true;
    }
    if (h.phase === "vault") {
      if (h.cam.until !== null && now > h.cam.until) return await failHeist(h, "الكاميرا شافتكم! الهكر ما عطّلها في وقتها.");
      if (h.thr.until !== null && now > h.thr.until) {
        h.thr.until = null;
        h.thr.misses++;
        h.log = `المواطن اتصل بالشرطة! الغنيمة −${Math.round(HEIST.threatPenalty * 100)}%`;
        h.needRender = true;
      }
      if (now >= h.endAt) {
        finishVault(h);
      } else {
        if (h.cam.until === null && now >= h.cam.nextAt) {
          h.cam.until = now + h.cam.windowMs;
          h.cam.nextAt += HEIST.camEveryMs;
          h.log = "تنبيه! الكاميرا تلتقطكم";
          h.needRender = true;
        }
        if (h.thr.until === null && now >= h.thr.nextAt) {
          h.thr.until = now + HEIST.threatWindowMs;
          h.thr.nextAt += HEIST.threatEveryMs;
          h.log = "المواطن يحاول يتحرك! هدّدوه";
          h.needRender = true;
        }
      }
    } else if (h.phase === "escape" && now > h.esc.until) {
      return await failHeist(h, "السائق ما قدر يشغّل السيارة في وقتها.");
    }
    if (isDone(h)) return;
    if (h.message && !h.rendering && (h.needRender || now - h.lastEditAt >= 2000) && now - h.lastEditAt >= 1100) {
      h.rendering = true;
      h.needRender = false;
      h.lastEditAt = now;
      try {
        if (!isDone(h)) await h.message.edit(await board(h));
      } catch {
        /* ignore */
      } finally {
        h.rendering = false;
      }
    }
  } finally {
    h.ticking = false;
  }
}

/* ───────────────── المعالجات ───────────────── */

async function deny(i: MessageComponentInteraction, content: string): Promise<void> {
  await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
}

async function nameOf(i: MessageComponentInteraction, userId: string): Promise<string> {
  const gm = await i.guild?.members.fetch(userId).catch(() => null);
  return gm?.displayName ?? i.client.users.cache.get(userId)?.username ?? userId;
}

async function onOpen(i: MessageComponentInteraction, leaderId: string, guildId: string): Promise<void> {
  if (i.user.id !== leaderId) return deny(i, "❌ هذا مو زرك.");
  const jp = await getJob(leaderId, guildId);
  if (jp.jobId !== "thief") return deny(i, "❌ السرقة الكبيرة للحرامية فقط.");
  const jail = await jailLeft(leaderId, guildId);
  if (jail > 0) return deny(i, `أنت مسجون! باقي ${fmtMs(Math.max(MIN, jail))}.`);
  const cd = await heistCooldownLeft(leaderId, guildId);
  if (cd > 0) return deny(i, `⏳ السرقة الكبيرة بعد ${fmtMs(Math.max(MIN, cd))}.`);
  const old = heists.get(leaderId);
  if (old && !["pick", "config", "confirm"].includes(old.phase)) return deny(i, "❌ عندك عملية شغالة.");
  if (busy.has(leaderId)) return deny(i, "❌ أنت داخل عملية ثانية.");
  if (old) cleanup(old);
  const h: Heist = {
    leaderId, guildId, phase: "pick", members: [], cfg: { i: 0, role: null, pct: null }, message: null, cdBefore: undefined,
    ticking: false, needRender: false, rendering: false, lastEditAt: 0, startAt: 0, endAt: 0, boxes: [], boxIdx: 0, typed: "", loot: 0,
    cam: { nextAt: 0, until: null, windowMs: HEIST.camWindowMs }, thr: { nextAt: 0, until: null, misses: 0 },
    esc: { until: 0, totalMs: 0, step: 0, layout: ESC_ORDER, car: "" }, log: "",
  };
  heists.set(leaderId, h);
  h.idleTimer = setTimeout(() => {
    if (h.phase === "pick" || h.phase === "config" || h.phase === "confirm") {
      void closeHeist(h, "انتهت جلسة الإعداد.").then((v) => h.message?.edit(v).catch(() => undefined));
    }
  }, HEIST.idleMs);
  h.message = i.message;
  await i.update(pickView(h));
}

async function onPick(i: MessageComponentInteraction, h: Heist): Promise<void> {
  if (!i.isUserSelectMenu() || h.phase !== "pick") return deny(i, "❌ هذي الخطوة انتهت.");
  const ids = i.values;
  const retry = async (note: string) => void (await i.update(pickView(h, note)));
  if (ids.includes(h.leaderId)) return retry("❌ لا تختار نفسك.");
  if (i.users.some((u) => u.bot)) return retry("❌ ما تقدر تختار بوت.");
  for (const id of ids) {
    if (busy.has(id)) return retry(`❌ <@${id}> داخل عملية ثانية.`);
    if ((await jailLeft(id, h.guildId)) > 0) return retry(`❌ <@${id}> مسجون.`);
  }
  const owners = await Promise.all([h.leaderId, ...ids].map((id) => bestCar(id, h.guildId)));
  if (!owners.some(Boolean)) return retry("❌ لازم واحد منكم على الأقل يملك سيارة (للسائق).");
  const names = await Promise.all(ids.map((id) => nameOf(i, id)));
  h.members = [{ userId: h.leaderId, name: await nameOf(i, h.leaderId), role: null, pct: 0, status: "yes" }, ...ids.map((id, k) => ({ userId: id, name: names[k] as string, role: null, pct: 0, status: "wait" as const }))];
  h.cfg = { i: 0, role: null, pct: null };
  h.phase = "config";
  await i.update(await cfgView(h));
}

async function afterSelect(i: MessageComponentInteraction, h: Heist, note?: string): Promise<void> {
  if (h.cfg.role && h.cfg.pct) {
    const m = mem(h, h.cfg.i);
    m.role = h.cfg.role;
    m.pct = h.cfg.pct;
    h.cfg = { i: h.cfg.i + 1, role: null, pct: null };
    if (h.cfg.i === 3) {
      const first = h.members.slice(0, 3);
      const last = mem(h, 3);
      last.role = ROLES.find((r) => !first.some((x) => x.role === r)) ?? null;
      last.pct = 100 - first.reduce((s, x) => s + x.pct, 0);
      const driver = h.members.find((x) => x.role === "driver");
      if (driver && !(await bestCar(driver.userId, h.guildId))) {
        h.members.forEach((x) => { x.role = null; x.pct = 0; });
        h.cfg = { i: 0, role: null, pct: null };
        return void (await i.update(await cfgView(h, `❌ آخر دور (السائق) طلع لـ **${driver.name}** وما عنده سيارة. وزّع الأدوار من جديد وخلّ السائق عند اللي يملك سيارة.`)));
      }
      h.phase = "confirm";
      return void (await i.update(await confirmView(h)));
    }
  }
  await i.update(await cfgView(h, note));
}

async function onSend(i: MessageComponentInteraction, h: Heist): Promise<void> {
  if (h.phase !== "confirm") return deny(i, "❌ هذي الخطوة انتهت.");
  const fail = async (t: string) => void (await i.update(await confirmView(h, t)));
  for (const m of h.members.slice(1)) {
    if (busy.has(m.userId)) return fail(`❌ ${m.name} صار داخل عملية ثانية.`);
    if ((await jailLeft(m.userId, h.guildId)) > 0) return fail(`❌ ${m.name} مسجون.`);
  }
  if (busy.has(h.leaderId) || (await jailLeft(h.leaderId, h.guildId)) > 0) return fail("❌ أنت مسجون أو داخل عملية.");
  if (!(await reserveCooldown(h))) return fail("⏳ السرقة الكبيرة لسا ما خلصت مهلتها.");
  for (const m of h.members) busy.set(m.userId, h.leaderId);
  h.phase = "invite";
  if (h.idleTimer) clearTimeout(h.idleTimer);
  await i.update(await lobbyView(h));
  const ping = h.members.slice(1).map((m) => `<@${m.userId}>`).join(" ");
  const ch = i.channel;
  if (ch && "send" in ch) await ch.send({ content: `${ping} انتم مدعوين لسطو البنك مع <@${h.leaderId}>! دوركم ونسبتكم في الصورة، اضغطوا موافق خلال ${HEIST.lobbyMs / 1000} ثانية.`, allowedMentions: { users: h.members.map((m) => m.userId) } }).catch(() => undefined);
  h.lobbyTimer = setTimeout(() => {
    if (h.phase !== "invite") return;
    void closeHeist(h, "⏰ انتهى وقت الانتظار — ما وافق الكل، انلغت العملية (ما انحسبت مهلة).").then((v) => h.message?.edit(v).catch(() => undefined));
  }, HEIST.lobbyMs);
}

async function onAnswer(i: MessageComponentInteraction, h: Heist, yes: boolean): Promise<void> {
  if (h.phase !== "invite") return deny(i, "❌ الدعوة انتهت.");
  const m = h.members.find((x, idx) => idx > 0 && x.userId === i.user.id);
  if (!m) return deny(i, "❌ هذي الدعوة مو لك.");
  if (m.status !== "wait") return deny(i, "جاوبت من قبل.");
  if (!yes) return void (await i.update(await closeHeist(h, `❌ **${m.name}** رفض العملية. انلغت (ما انحسبت مهلة).`)));
  if (m.role === "driver" && !(await bestCar(m.userId, h.guildId))) return deny(i, "❌ أنت السائق ولازم تملك سيارة.");
  m.status = "yes";
  if (!h.members.every((x) => x.status === "yes")) return void (await i.update(await lobbyView(h)));
  const err = await startPrep(h);
  if (err) return void (await i.update(await closeHeist(h, err)));
  await i.update(await board(h));
}

async function onGame(i: MessageComponentInteraction, h: Heist, act: string, arg: string): Promise<void> {
  const role = roleOf(h, i.user.id);
  if (!role) return deny(i, "❌ أنت مو من العصابة.");
  const now = Date.now();
  if (act === "d") {
    if (role !== "thief") return deny(i, "❌ الصناديق مهمة الحرامي.");
    if (h.phase !== "vault" || now >= h.endAt) return deny(i, h.phase === "prep" ? "لسا ما بدأت العملية." : "انتهى وقت الصناديق.");
    const box = h.boxes[h.boxIdx];
    if (!box) return deny(i, "خلصت الصناديق.");
    h.typed += arg.slice(0, 1);
    if (h.typed.length >= 4) {
      if (h.typed === box.code) {
        box.state = "open";
        h.loot += box.amount;
        h.log = `✅ صندوق ${h.boxIdx + 1}: +${box.amount}`;
      } else {
        box.state = "fail";
        h.log = `❌ رمز غلط! ضاع صندوق ${h.boxIdx + 1}`;
      }
      h.typed = "";
      h.boxIdx++;
      if (h.boxIdx >= h.boxes.length) finishVault(h);
    }
    return void (await i.update(await board(h)));
  }
  if (act === "cam" || act === "thr") {
    const need: Role = act === "cam" ? "hacker" : "threat";
    if (role !== need) return deny(i, act === "cam" ? "❌ الكاميرا مهمة الهكر." : "❌ التهديد مهمة المهدد.");
    const slot = act === "cam" ? h.cam : h.thr;
    if (h.phase !== "vault" || slot.until === null || now > slot.until) return deny(i, "ما فيه تنبيه الحين، انتظر.");
    slot.until = null;
    h.log = act === "cam" ? "🔌 الكاميرا انعطلت" : "🗣️ المواطن خاف وسكت";
    return void (await i.update(await board(h)));
  }
  if (act === "esc") {
    if (role !== "driver") return deny(i, "❌ التشغيل مهمة السائق.");
    if (h.phase !== "escape") return deny(i, "لسا ما وصلتوا للهروب.");
    if (arg === ESC_ORDER[h.esc.step]) h.esc.step++;
    else {
      h.esc.step = 0;
      h.log = "❌ غلط! ابدأ من الأول";
    }
    if (h.esc.step >= ESC_ORDER.length) {
      await i.deferUpdate().catch(() => undefined);
      return await finishSuccess(h);
    }
    return void (await i.update(await board(h)));
  }
}

/** يعالج أي زر أو قائمة تبدأ بـ hst| — يرجع true لو هو لها */
export async function handleHeistComponent(i: MessageComponentInteraction): Promise<boolean> {
  if (!i.customId.startsWith("hst|")) return false;
  const [, leaderId = "", act = "", arg = ""] = i.customId.split("|");
  if (!i.inGuild()) return true;
  try {
    if (act === "open") {
      await onOpen(i, leaderId, i.guildId);
      return true;
    }
    const h = heists.get(leaderId);
    if (!h || h.guildId !== i.guildId || h.phase === "done") {
      await deny(i, "انتهت هذي العملية.");
      return true;
    }
    if (i.message) h.message = i.message;
    const leaderActs = ["pick", "role", "pct", "send", "redo", "cancel"];
    if (leaderActs.includes(act) && i.user.id !== h.leaderId) {
      await deny(i, "❌ هذا مو زرك، بس القائد.");
      return true;
    }
    if (act === "pick") await onPick(i, h);
    else if (act === "role" && i.isStringSelectMenu() && h.phase === "config") {
      const v = i.values[0] as Role;
      const m = mem(h, h.cfg.i);
      if (v === "driver" && !(await bestCar(m.userId, h.guildId))) {
        h.cfg.role = null;
        await afterSelect(i, h, `❌ **${m.name}** ما عنده سيارة، ما يصير سائق.`);
      } else {
        h.cfg.role = v;
        await afterSelect(i, h);
      }
    } else if (act === "pct" && i.isStringSelectMenu() && h.phase === "config") {
      h.cfg.pct = Number(i.values[0]);
      await afterSelect(i, h);
    } else if (act === "send") await onSend(i, h);
    else if (act === "redo" && h.phase === "confirm") {
      h.members.forEach((x) => { x.role = null; x.pct = 0; });
      h.cfg = { i: 0, role: null, pct: null };
      h.phase = "config";
      await i.update(await cfgView(h));
    } else if (act === "cancel") {
      if (!["pick", "config", "confirm", "invite"].includes(h.phase)) await deny(i, "❌ العملية بدأت، ما تنلغي.");
      else await i.update(await closeHeist(h, "🚫 ألغى القائد العملية."));
    } else if (act === "acc") await onAnswer(i, h, true);
    else if (act === "dec") await onAnswer(i, h, false);
    else if (["d", "cam", "thr", "esc"].includes(act)) await onGame(i, h, act, arg);
    else await deny(i, "❌ أمر غير معروف.");
  } catch (e) {
    console.error("[heist]", e);
    if (!i.replied && !i.deferred) await deny(i, "صار خطأ، جرّب مرة ثانية.");
  }
  return true;
}

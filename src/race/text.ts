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
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { trackRace } from "../achievements/service";
import { jenny } from "../constants";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { renderTrack } from "./card";
import { CAR_IDS, RACE, carName, isCar, payouts, simulate, type CarId } from "./data";
import { ownedCars, statsOf } from "./service";

/** !سباق */
export const RACE_TRIGGER = /^!\s*سباق$/;

const COLOR = 0xdc2626;
const eph = { flags: MessageFlags.Ephemeral } as const;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const cid = (host: string, act: string): string => `rac|${host}|${act}`;

interface Racer {
  userId: string;
  name: string;
  car: CarId;
}
interface Lobby {
  hostId: string;
  guildId: string;
  racers: Racer[];
  message: Message | null;
  timer?: NodeJS.Timeout;
  started: boolean;
}

const lobbies = new Map<string, Lobby>();
/** userId → hostId (مين داخل سباق الحين) */
const busy = new Map<string, string>();

function lobbyView(l: Lobby, note?: string): BaseMessageOptions {
  const lines = [
    `🏁 **سباق جديد** — المضيف: <@${l.hostId}>`,
    `رسوم الدخول: ${jenny(RACE.fee)} (الجائزة = مجموع الرسوم)`,
    `لازم ${RACE.minPlayers} لاعبين أو أكثر (حد أقصى ${RACE.maxPlayers}).`,
    "",
    l.racers.length ? l.racers.map((r, k) => `${k + 1}. **${r.name}** — ${carName(r.car)}`).join("\n") : "ما انضم أحد للحين. اختر سيارتك من القائمة تحت.",
  ];
  if (note) lines.push("", note);
  const menu = new StringSelectMenuBuilder().setCustomId(cid(l.hostId, "sel")).setPlaceholder("اختر سيارتك للانضمام").addOptions(CAR_IDS.map((c) => ({ label: carName(c), value: c })));
  return {
    content: "",
    embeds: [new EmbedBuilder().setColor(COLOR).setDescription(lines.join("\n")).setFooter({ text: `ينتهي الانتظار بعد ${RACE.lobbyMs / 60_000} دقيقة` })],
    files: [],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(cid(l.hostId, "go")).setLabel("ابدأ السباق").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(cid(l.hostId, "leave")).setLabel("انسحاب").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(cid(l.hostId, "cancel")).setLabel("إلغاء (المضيف)").setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

function closeLobby(l: Lobby): void {
  if (l.timer) clearTimeout(l.timer);
  for (const r of l.racers) if (busy.get(r.userId) === l.hostId) busy.delete(r.userId);
  if (lobbies.get(l.hostId) === l) lobbies.delete(l.hostId);
}

const endView = (text: string): BaseMessageOptions => ({ content: "", embeds: [new EmbedBuilder().setColor(0x475569).setDescription(text)], files: [], components: [] });

export async function handleRaceMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const uid = message.author.id;
  const reply = (c: string) => message.reply({ content: c, allowedMentions: { repliedUser: false } }).catch(() => undefined);
  if (busy.has(uid) || lobbies.has(uid)) return void (await reply("❌ أنت داخل سباق بالفعل."));
  if (!(await ownedCars(uid, message.guildId)).length) return void (await reply("❌ لازم تملك سيارة عشان تسابق. اشترِ وحدة من `!معرض`."));
  const l: Lobby = { hostId: uid, guildId: message.guildId, racers: [], message: null, started: false };
  lobbies.set(uid, l);
  const sent = await message.channel.send(lobbyView(l)).catch(() => null);
  if (!sent) return closeLobby(l);
  l.message = sent;
  l.timer = setTimeout(() => {
    if (l.started) return;
    closeLobby(l);
    void sent.edit(endView("⏰ انتهى وقت الانتظار وانلغى السباق.")).catch(() => undefined);
  }, RACE.lobbyMs);
}

export async function handleRaceComponent(i: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  const [prefix, hostId = "", act = ""] = i.customId.split("|");
  if (prefix !== "rac" || !i.inGuild()) return false;
  const deny = (c: string) => i.reply({ content: c, ...eph }).catch(() => undefined);
  const l = lobbies.get(hostId);
  if (!l || l.guildId !== i.guildId) {
    await deny("انتهى هذا السباق.");
    return true;
  }
  l.message = i.message;
  const uid = i.user.id;

  if (act === "sel" && i.isStringSelectMenu()) {
    const car = i.values[0] ?? "";
    if (!isCar(car)) return (await deny("❌ سيارة غير معروفة."), true);
    if (l.started) return (await deny("السباق بدأ."), true);
    const other = busy.get(uid);
    if (other && other !== hostId) return (await deny("❌ أنت داخل سباق ثاني."), true);
    if (!(await ownedCars(uid, i.guildId)).includes(car)) return (await deny(`❌ ما تملك ${carName(car)}.`), true);
    const existing = l.racers.find((r) => r.userId === uid);
    if (!existing) {
      if (l.racers.length >= RACE.maxPlayers) return (await deny("❌ السباق ممتلئ."), true);
      const coins = (await UserProfile.findOne({ userId: uid, guildId: i.guildId }, { coins: 1 }))?.coins ?? 0;
      if (coins < RACE.fee) return (await deny(`❌ تحتاج ${jenny(RACE.fee)} رسوم دخول.`), true);
      l.racers.push({ userId: uid, name: i.guild?.members.cache.get(uid)?.displayName ?? i.user.username, car });
      busy.set(uid, hostId);
    } else existing.car = car;
    await i.update(lobbyView(l)).catch(() => undefined);
    return true;
  }

  if (act === "leave") {
    const k = l.racers.findIndex((r) => r.userId === uid);
    if (k < 0) return (await deny("أنت مو منضم."), true);
    if (l.started) return (await deny("السباق بدأ."), true);
    l.racers.splice(k, 1);
    busy.delete(uid);
    await i.update(lobbyView(l)).catch(() => undefined);
    return true;
  }

  if (act === "cancel" || act === "go") {
    if (uid !== hostId) return (await deny("❌ بس المضيف."), true);
    if (l.started) return (await deny("السباق بدأ."), true);
    if (act === "cancel") {
      closeLobby(l);
      await i.update(endView("🚫 ألغى المضيف السباق.")).catch(() => undefined);
      return true;
    }
    if (l.racers.length < RACE.minPlayers) return (await deny(`❌ لازم ${RACE.minPlayers} لاعبين على الأقل.`), true);
    l.started = true;
    if (l.timer) clearTimeout(l.timer);
    await i.deferUpdate().catch(() => undefined);
    await runRace(l).catch((err) => console.error("[race]", err));
    return true;
  }
  return true;
}

async function runRace(l: Lobby): Promise<void> {
  const msg = l.message;
  const edit = (v: BaseMessageOptions) => msg?.edit({ ...v, attachments: [] }).catch(() => undefined);

  // نسحب رسوم الدخول ذريًا (اللي ما تكفي محفظته يطلع)
  const paid: Racer[] = [];
  for (const r of l.racers) {
    const ok = await UserProfile.findOneAndUpdate({ userId: r.userId, guildId: l.guildId, coins: { $gte: RACE.fee } }, { $inc: { coins: -RACE.fee } });
    if (ok) paid.push(r);
    else busy.delete(r.userId);
  }
  if (paid.length < RACE.minPlayers) {
    for (const r of paid) await UserProfile.updateOne({ userId: r.userId, guildId: l.guildId }, { $inc: { coins: RACE.fee } });
    l.racers = paid;
    closeLobby(l);
    await edit(endView("❌ انلغى السباق: ما كفّى عدد اللاعبين اللي معهم رسوم الدخول (انرجعت الرسوم)."));
    return;
  }
  l.racers = paid;

  const stats = await Promise.all(paid.map((r) => statsOf(r.userId, l.guildId, r.car)));
  const { frames, order } = simulate(stats);
  const names = paid.map((r) => r.name);

  const frame = async (t: number, ranks?: number[]) => {
    const png = await renderTrack("🏁 السباق", ranks ? "انتهى السباق!" : t === 0 ? "استعدوا..." : `الجولة ${t}/${frames.length - 1}`, paid.map((r, k) => ({ name: names[k] as string, carId: r.car, pos: (frames[t] as number[])[k] as number, rank: ranks?.[k] })));
    const embed = new EmbedBuilder().setColor(COLOR);
    if (png) embed.setImage("attachment://race.png");
    else embed.setDescription("🏁 السباق شغال...");
    await edit({ content: "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name: "race.png" })] : [], components: [] });
  };

  await frame(0);
  for (let t = 1; t < frames.length; t++) {
    await sleep(RACE.frameMs);
    await frame(t);
  }

  // النتائج
  const rankOf = Array(paid.length).fill(0) as number[];
  order.forEach((idx, pos) => (rankOf[idx] = pos + 1));
  const prizes = payouts(paid.length);
  const lines: string[] = [];
  for (const [pos, idx] of order.entries()) {
    const r = paid[idx] as Racer;
    const prize = prizes[pos] ?? 0;
    if (prize > 0) {
      await UserProfile.updateOne({ userId: r.userId, guildId: l.guildId }, { $inc: { coins: prize } }, { upsert: true }).catch(() => undefined);
      await logTransaction(l.guildId, r.userId, "salary", prize).catch(() => undefined);
    }
    void trackRace(l.guildId, r.userId, pos + 1, paid.length).catch(() => undefined);
    lines.push(`${["🥇", "🥈", "🥉"][pos] ?? `${pos + 1}.`} **${r.name}** — ${carName(r.car)}${prize > 0 ? ` — +${prize.toLocaleString("en-US")}` : ""}`);
  }
  closeLobby(l);
  const png = await renderTrack("🏁 النتيجة النهائية", `الفائز: ${(paid[order[0] as number] as Racer).name}`, paid.map((r, k) => ({ name: names[k] as string, carId: r.car, pos: (frames[frames.length - 1] as number[])[k] as number, rank: rankOf[k] })));
  const embed = new EmbedBuilder().setColor(COLOR).setDescription(lines.join("\n"));
  if (png) embed.setImage("attachment://race.png");
  await edit({ content: "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name: "race.png" })] : [], components: [] });
}

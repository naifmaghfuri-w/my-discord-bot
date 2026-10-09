import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type BaseMessageOptions } from "discord.js";
import { jenny, xp } from "../constants";
import type { IHunterFight } from "../database/models/HunterFight";
import type { IHunterProfile } from "../database/models/HunterProfile";
import { ENEMIES, NEN, STAT_INFO, STAT_KEYS, rankFor, xpNeeded, type EnemyDef, type NenType } from "./data";
import { HX_ACT, HX_APPLY, HX_CARD, HX_DUEL_ACCEPT, HX_DUEL_ACT, HX_DUEL_DECLINE, HX_DUEL_FORFEIT, HX_EXAM, HX_EXAM_GO, HX_FIGHT_MENU, HX_PICK_ENEMY, HX_RETREAT, HX_TRAIN_MENU, HX_TRAIN_PICK, cid } from "./ids";
import { MAX_ROUNDS, NEN_COST, maxAura, maxHp } from "./engine";
import type { IHunterDuel } from "../database/models/HunterDuel";
import type { DuelEnd } from "./duel";
import { EXAM_FEE, EXAM_MIN_LEVEL, EXAM_REWARD, TRAIN_COOLDOWN_MS, TRAIN_COST, DAILY_REWARDED_FIGHTS, type FightEnd } from "./service";

const COLOR = 0x2ecc71;

export const bar = (cur: number, max: number, len = 10): string => {
  const f = Math.max(0, Math.min(len, Math.round((cur / Math.max(1, max)) * len)));
  return "█".repeat(f) + "░".repeat(len - f);
};

export const fmtMs = (ms: number): string => {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

function navRow(owner: string, current: "card" | "fight" | "train" | "exam"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(HX_CARD, owner)).setLabel("Hunter Card").setEmoji("🪪").setStyle(ButtonStyle.Secondary).setDisabled(current === "card"),
    new ButtonBuilder().setCustomId(cid(HX_FIGHT_MENU, owner)).setLabel("Fight").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(current === "fight"),
    new ButtonBuilder().setCustomId(cid(HX_TRAIN_MENU, owner)).setLabel("Train").setEmoji("🏋️").setStyle(ButtonStyle.Primary).setDisabled(current === "train"),
    new ButtonBuilder().setCustomId(cid(HX_EXAM, owner)).setLabel("Exam").setEmoji("🎓").setStyle(ButtonStyle.Success).setDisabled(current === "exam"),
  );
}

export function buildApplyView(owner: string): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🎴 Hunter Association")
    .setDescription(
      "Want to become a Hunter?\nPlace your hand on the glass of water and channel your aura — the water will reveal your **Nen type**.\n\n" +
        "> Your type is random and permanent, so choose the moment wisely.",
    );
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(cid(HX_APPLY, owner)).setLabel("Take the Water Divination Test").setEmoji("💧").setStyle(ButtonStyle.Success),
      ),
    ],
  };
}

export function buildRevealView(owner: string, p: IHunterProfile): BaseMessageOptions {
  const n = NEN[p.nen as NenType];
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`💧 The water reacts... ${n.icon} ${n.name}!`)
    .setDescription(n.desc + "\n\nYour journey as a Hunter begins now.");
  return { embeds: [embed], components: [navRow(owner, "card")] };
}

export function buildCardView(owner: string, p: IHunterProfile, name: string): BaseMessageOptions {
  const n = NEN[p.nen as NenType];
  const rank = rankFor(p.level);
  const need = xpNeeded(p.level);
  const stats = STAT_KEYS.map((k) => `${STAT_INFO[k].icon} ${STAT_INFO[k].name}: **${p[k]}**`).join("\n");
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${rank.icon} ${name} — ${rank.name}${p.license ? " 🎴" : ""}`)
    .addFields(
      { name: "Nen Type", value: `${n.icon} **${n.name}**`, inline: true },
      { name: "Level", value: `**${p.level}**`, inline: true },
      { name: "Record", value: `🏆 ${p.wins}  ·  💀 ${p.losses}`, inline: true },
      { name: "Experience", value: `${bar(p.xp, need)} ${p.xp}/${need}` },
      { name: "Stats", value: stats },
      { name: "Battle Pool", value: `❤️ HP **${maxHp(p.end)}**  ·  🔮 Aura **${maxAura(p.aura)}**` },
    );
  return { embeds: [embed], components: [navRow(owner, "card")] };
}

export function buildEnemyMenu(owner: string, p: IHunterProfile, note?: string): BaseMessageOptions {
  const list = ENEMIES.filter((e) => !e.exam);
  const lockedFor = (e: EnemyDef) => p.level < e.minLevel || (Boolean(e.needsLicense) && !p.license);
  const lines = list.map((e) => {
    const locked = lockedFor(e);
    return `${locked ? "🔒" : e.icon} **${e.name}** — Lv ${e.minLevel}+${e.needsLicense ? " · 🎴 License" : ""}  ·  ${e.nen ? NEN[e.nen].icon + " " + NEN[e.nen].name : "No Nen"}\n> ${e.desc}`;
  }).join("\n");
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("⚔️ Choose your opponent")
    .setDescription((note ? `**${note}**\n\n` : "") + lines + `\n\n_Up to ${DAILY_REWARDED_FIGHTS} rewarded fights per day._`);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(HX_PICK_ENEMY, owner))
    .setPlaceholder("Pick an enemy")
    .addOptions(
      list.map((e) => ({
        label: `${e.name} (Lv ${e.minLevel}+)`,
        value: e.id,
        description: `${e.xp} XP · ${e.coins} Jenny`,
        emoji: lockedFor(e) ? "🔒" : e.icon,
      })),
    );
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), navRow(owner, "fight")] };
}

export function buildFightView(owner: string, p: IHunterProfile, fight: IHunterFight, enemy: EnemyDef, name: string): BaseMessageOptions {
  const pMax = maxHp(p.end);
  const pAura = maxAura(p.aura);
  const eMax = maxHp(enemy.stats.end);
  const eAuraMax = maxAura(enemy.stats.aura);
  const canNen = p.nen !== null && p.aura > 0 && fight.aura >= NEN_COST;
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`⚔️ ${name} vs ${enemy.icon} ${enemy.name}`)
    .setDescription(
      `**You** ❤️ ${bar(fight.hp, pMax)} ${Math.max(0, Math.round(fight.hp))}/${pMax}\n🔮 ${bar(fight.aura, pAura)} ${Math.round(fight.aura)}/${pAura}\n\n` +
        `**${enemy.name}** ❤️ ${bar(fight.eHp, eMax)} ${Math.max(0, Math.round(fight.eHp))}/${eMax}\n🔮 ${bar(fight.eAura, eAuraMax)} ${Math.round(fight.eAura)}/${eAuraMax}` +
        (fight.lastLog.length ? `\n\n${fight.lastLog.join("\n")}` : "\n\nPick your move — both sides act at the same time!"),
    )
    .setFooter({ text: `Round ${fight.round + 1}/${MAX_ROUNDS} · Nen costs ${NEN_COST} aura` });
  const r = fight.round;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(HX_ACT, owner, `attack:${r}`)).setLabel("Attack").setEmoji("👊").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cid(HX_ACT, owner, `guard:${r}`)).setLabel("Guard").setEmoji("🛡️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(HX_ACT, owner, `nen:${r}`)).setLabel("Nen").setEmoji("🔮").setStyle(ButtonStyle.Success).setDisabled(!canNen),
    new ButtonBuilder().setCustomId(cid(HX_ACT, owner, `dodge:${r}`)).setLabel("Dodge").setEmoji("💨").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(cid(HX_RETREAT, owner)).setLabel(enemy.exam ? "Forfeit Exam" : "Retreat").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function buildResultView(owner: string, enemy: EnemyDef, log: string[], end: FightEnd): BaseMessageOptions {
  const title = end.outcome === "win" ? "🏆 Victory!" : end.outcome === "loss" ? "💀 Defeat..." : "🤝 Draw";
  const color = end.outcome === "win" ? 0x2ecc71 : end.outcome === "loss" ? 0xe74c3c : 0x95a5a6;
  const parts = [log.join("\n"), ""];
  if (end.xp > 0) parts.push(`+${xp(end.xp)} Hunter XP`);
  if (end.coins > 0) parts.push(`+${jenny(end.coins)}`);
  if (end.capped) parts.push(`_Daily reward limit reached — rewards reduced._`);
  if (end.leveledUp) parts.push(`\n🎉 **Level up!** You are now level **${end.level}**.`);
  if (end.note) parts.push(`\n${end.note}`);
  const embed = new EmbedBuilder().setColor(color).setTitle(`${title} vs ${enemy.icon} ${enemy.name}`).setDescription(parts.join("\n"));
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (enemy.exam === 2 && end.outcome === "win") rows.push(examGoRow(owner, "Continue to the Final Match"));
  rows.push(navRow(owner, "fight"));
  return { embeds: [embed], components: rows };
}

function examGoRow(owner: string, label: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(HX_EXAM_GO, owner)).setLabel(label).setEmoji("🎓").setStyle(ButtonStyle.Success),
  );
}

export function buildExamView(owner: string, p: IHunterProfile, note?: string): BaseMessageOptions {
  const stage = p.examStage;
  let body: string;
  let label = "Start the Exam";
  if (p.license) body = "🎴 You already hold a **Hunter License**. Strong opponents are unlocked.";
  else if (stage === 2) { body = "**Stage 2 — The Hunt.** A beast blocks your path."; label = "Face the Beast"; }
  else if (stage === 3) { body = "**Stage 3 — The Final Match.** One last rival stands between you and the license."; label = "Begin the Final Match"; }
  else body =
    `Three stages: **Endurance Race** → **The Hunt** → **Final Match**.\n\n` +
    `• Requires level **${EXAM_MIN_LEVEL}**\n• Entry fee: ${jenny(EXAM_FEE)}\n• Reward: ${jenny(EXAM_REWARD.coins)} + ${xp(EXAM_REWARD.xp)} + the **Hunter License**\n` +
    `• Losing or forfeiting means retry after a cooldown (fee not refunded).`;
  const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle("🎓 Hunter Exam").setDescription((note ? `**${note}**\n\n` : "") + body);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (!p.license) rows.push(examGoRow(owner, label));
  rows.push(navRow(owner, "exam"));
  return { embeds: [embed], components: rows };
}

export function buildDuelChallenge(duel: IHunterDuel): BaseMessageOptions {
  const id = String((duel as unknown as { _id: unknown })._id);
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("⚔️ Duel Challenge")
    .setDescription(
      `<@${duel.aId}> challenges <@${duel.bId}> to a duel!` +
        (duel.bet > 0 ? `\nBet: ${jenny(duel.bet)} (loser pays the winner)` : "\nNo bet.") +
        `\n\nBoth fighters pick a move in secret each round.`,
    );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(HX_DUEL_ACCEPT, duel.bId, id)).setLabel("Accept").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cid(HX_DUEL_DECLINE, duel.bId, id)).setLabel("Decline").setEmoji("✖️").setStyle(ButtonStyle.Danger),
  );
  return { content: `<@${duel.bId}>`, embeds: [embed], components: [row], allowedMentions: { users: [duel.bId] } };
}

export function buildDuelView(duel: IHunterDuel, aEnd: number, bEnd: number, aAuraMax: number, bAuraMax: number): BaseMessageOptions {
  const id = String((duel as unknown as { _id: unknown })._id);
  const r = duel.round;
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`⚔️ ${duel.aName} vs ${duel.bName}`)
    .setDescription(
      `**${duel.aName}** ❤️ ${bar(duel.aHp, maxHp(aEnd))} ${Math.round(duel.aHp)}/${maxHp(aEnd)}\n🔮 ${bar(duel.aAura, aAuraMax)} ${Math.round(duel.aAura)}\n\n` +
        `**${duel.bName}** ❤️ ${bar(duel.bHp, maxHp(bEnd))} ${Math.round(duel.bHp)}/${maxHp(bEnd)}\n🔮 ${bar(duel.bAura, bAuraMax)} ${Math.round(duel.bAura)}` +
        (duel.lastLog.length ? `\n\n${duel.lastLog.join("\n")}` : "\n\nBoth players: pick your move. Choices stay hidden until both have chosen!") +
        (duel.bet > 0 ? `\n\n💰 Bet: ${jenny(duel.bet)}` : ""),
    )
    .setFooter({ text: `Round ${r + 1}/${MAX_ROUNDS} · Nen costs ${NEN_COST} aura` });
  // customId: base|ownerId(unused for duel)|duelId:action:round
  const mk = (a: string, label: string, emoji: string, style: ButtonStyle) =>
    new ButtonBuilder().setCustomId(cid(HX_DUEL_ACT, "-", `${id}:${a}:${r}`)).setLabel(label).setEmoji(emoji).setStyle(style);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    mk("attack", "Attack", "👊", ButtonStyle.Danger),
    mk("guard", "Guard", "🛡️", ButtonStyle.Primary),
    mk("nen", "Nen", "🔮", ButtonStyle.Success),
    mk("dodge", "Dodge", "💨", ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(cid(HX_DUEL_FORFEIT, "-", id)).setLabel("Forfeit").setStyle(ButtonStyle.Secondary),
  );
  return { content: "", embeds: [embed], components: [row] };
}

export function buildDuelResult(duel: IHunterDuel, log: string[], end: DuelEnd): BaseMessageOptions {
  const lines = [log.join("\n"), ""];
  if (end.draw) lines.push("🤝 **Draw!** No one wins, no one pays.");
  else {
    lines.push(`🏆 **<@${end.winnerId}> wins!**`);
    if (end.bet > 0) lines.push(`💰 <@${end.winnerId}> takes ${jenny(end.bet)} from <@${end.loserId}>.`);
    if (end.xp > 0) lines.push(`+${xp(end.xp)} Hunter XP for the winner`);
    if (end.capped) lines.push("_Winner hit the daily duel reward limit — no XP._");
  }
  const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle(`⚔️ ${duel.aName} vs ${duel.bName}`).setDescription(lines.join("\n"));
  return { content: "", embeds: [embed], components: [], allowedMentions: { parse: [] } };
}

export function buildTrainView(owner: string, p: IHunterProfile, note?: string): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🏋️ Training Ground")
    .setDescription(
      (note ? `**${note}**\n\n` : "") +
        `Spend ${jenny(TRAIN_COST)} to permanently gain **+1** in a stat.\nCooldown: **${fmtMs(TRAIN_COOLDOWN_MS)}**.`,
    );
  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(HX_TRAIN_PICK, owner))
    .setPlaceholder("Choose a stat to train")
    .addOptions(
      STAT_KEYS.map((k) => ({ label: `${STAT_INFO[k].name} (${p[k]})`, value: k, emoji: STAT_INFO[k].icon })),
    );
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), navRow(owner, "train")] };
}

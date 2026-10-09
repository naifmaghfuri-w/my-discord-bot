import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type BaseMessageOptions } from "discord.js";
import { jenny, xp } from "../constants";
import type { IHunterFight } from "../database/models/HunterFight";
import type { IHunterProfile } from "../database/models/HunterProfile";
import { ENEMIES, NEN, STAT_INFO, STAT_KEYS, rankFor, xpNeeded, type EnemyDef, type NenType } from "./data";
import { HX_ACT, HX_APPLY, HX_CARD, HX_FIGHT_MENU, HX_PICK_ENEMY, HX_RETREAT, HX_TRAIN_MENU, HX_TRAIN_PICK, cid } from "./ids";
import { MAX_ROUNDS, NEN_COST, maxAura, maxHp } from "./engine";
import { TRAIN_COOLDOWN_MS, TRAIN_COST, DAILY_REWARDED_FIGHTS, type FightEnd } from "./service";

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

function navRow(owner: string, current: "card" | "fight" | "train"): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(HX_CARD, owner)).setLabel("Hunter Card").setEmoji("🪪").setStyle(ButtonStyle.Secondary).setDisabled(current === "card"),
    new ButtonBuilder().setCustomId(cid(HX_FIGHT_MENU, owner)).setLabel("Fight").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(current === "fight"),
    new ButtonBuilder().setCustomId(cid(HX_TRAIN_MENU, owner)).setLabel("Train").setEmoji("🏋️").setStyle(ButtonStyle.Primary).setDisabled(current === "train"),
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
    .setTitle(`${rank.icon} ${name} — ${rank.name}`)
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
  const lines = ENEMIES.map((e) => {
    const locked = p.level < e.minLevel;
    return `${locked ? "🔒" : e.icon} **${e.name}** — Lv ${e.minLevel}+  ·  ${e.nen ? NEN[e.nen].icon + " " + NEN[e.nen].name : "No Nen"}\n> ${e.desc}`;
  }).join("\n");
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("⚔️ Choose your opponent")
    .setDescription((note ? `**${note}**\n\n` : "") + lines + `\n\n_Up to ${DAILY_REWARDED_FIGHTS} rewarded fights per day._`);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(HX_PICK_ENEMY, owner))
    .setPlaceholder("Pick an enemy")
    .addOptions(
      ENEMIES.map((e) => ({
        label: `${e.name} (Lv ${e.minLevel}+)`,
        value: e.id,
        description: `${e.xp} XP · ${e.coins} Jenny`,
        emoji: p.level < e.minLevel ? "🔒" : e.icon,
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
    new ButtonBuilder().setCustomId(cid(HX_RETREAT, owner)).setLabel("Retreat").setStyle(ButtonStyle.Secondary),
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
  const embed = new EmbedBuilder().setColor(color).setTitle(`${title} vs ${enemy.icon} ${enemy.name}`).setDescription(parts.join("\n"));
  return { embeds: [embed], components: [navRow(owner, "fight")] };
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

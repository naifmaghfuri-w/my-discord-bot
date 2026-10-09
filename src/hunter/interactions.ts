import { MessageFlags, type ButtonInteraction, type Message, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { ENEMY_MAP, STAT_INFO, type StatKey } from "./data";
import type { Action } from "./engine";
import { HX_DUEL_ACCEPT, HX_DUEL_ACT, HX_DUEL_DECLINE, HX_DUEL_FORFEIT, HX_EXAM, HX_EXAM_GO, HX_ACT, HX_APPLY, HX_CARD, HX_FIGHT_MENU, HX_PICK_ENEMY, HX_RETREAT, HX_TRAIN_MENU, HX_TRAIN_PICK, parseCid } from "./ids";
import { advanceExam, createHunter, getHunter, playRound, retreat, startFight, trainStat } from "./service";
import { acceptDuel, createChallenge, declineDuel, duelChoose, duelForfeit } from "./duel";
import type { IHunterDuel } from "../database/models/HunterDuel";
import { maxAura } from "./engine";
import { buildDuelChallenge, buildDuelResult, buildDuelView, buildExamView, buildApplyView, buildCardView, buildEnemyMenu, buildFightView, buildResultView, buildRevealView, buildTrainView, fmtMs } from "./views";
import { HunterFight } from "../database/models/HunterFight";

export const HUNTER_TRIGGER = /^(hunter|هنتر)$/i;

const BASES = new Set([HX_EXAM, HX_EXAM_GO, HX_APPLY, HX_CARD, HX_FIGHT_MENU, HX_PICK_ENEMY, HX_ACT, HX_RETREAT, HX_TRAIN_MENU, HX_TRAIN_PICK]);

/** "hunter" / "هنتر": يفتح البطاقة أو شاشة التقديم */
export async function handleHunterMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const owner = message.author.id;
  const p = await getHunter(owner, message.guildId);
  const view = p ? buildCardView(owner, p, message.member?.displayName ?? message.author.username) : buildApplyView(owner);
  await message.channel.send(view).catch(() => undefined);
}

const nameOf = (i: ButtonInteraction | StringSelectMenuInteraction): string =>
  (i.inCachedGuild() ? i.member.displayName : i.user.username);

async function noHunter(i: ButtonInteraction | StringSelectMenuInteraction, owner: string) {
  await i.update(buildApplyView(owner));
}

async function duelView(duel: IHunterDuel) {
  const [pa, pb] = await Promise.all([getHunter(duel.aId, duel.guildId), getHunter(duel.bId, duel.guildId)]);
  const ae = pa?.end ?? 10;
  const be = pb?.end ?? 10;
  return buildDuelView(duel, ae, be, maxAura(pa?.aura ?? 10), maxAura(pb?.aura ?? 10));
}

async function handleDuelButton(i: ButtonInteraction, base: string, ownerId: string, extra?: string): Promise<boolean> {
  if (!i.inGuild()) return true;
  const stale = () => i.reply({ content: "That duel is over or outdated.", flags: MessageFlags.Ephemeral });

  if (base === HX_DUEL_ACCEPT || base === HX_DUEL_DECLINE) {
    if (!extra) return true;
    if (base === HX_DUEL_ACCEPT) {
      if (i.user.id !== ownerId) {
        await i.reply({ content: "Only the challenged hunter can accept.", flags: MessageFlags.Ephemeral });
        return true;
      }
      const d = await acceptDuel(extra, i.user.id);
      if (!d) { await stale(); return true; }
      await i.update(await duelView(d));
      return true;
    }
    const d = await declineDuel(extra, i.user.id);
    if (!d) { await stale(); return true; }
    await i.update({ content: "", embeds: [{ description: `✖️ Duel cancelled by <@${i.user.id}>.`, color: 0x95a5a6 }], components: [], allowedMentions: { parse: [] } });
    return true;
  }

  if (base === HX_DUEL_FORFEIT) {
    const step = await duelForfeit(extra ?? "", i.user.id);
    if (step.status !== "ended") { await stale(); return true; }
    await i.update(buildDuelResult(step.duel, step.log, step.end));
    return true;
  }

  // HX_DUEL_ACT: extra = duelId:action:round
  const [duelId, action, roundStr] = (extra ?? "").split(":");
  const step = await duelChoose(duelId, i.user.id, action, Number(roundStr));
  if (step.status === "stale") {
    await i.reply({ content: "You already chose, or this panel is outdated.", flags: MessageFlags.Ephemeral });
  } else if (step.status === "waiting") {
    await i.reply({ content: `🔒 You chose **${action}**. Waiting for your opponent...`, flags: MessageFlags.Ephemeral });
  } else if (step.status === "ongoing") {
    await i.update(await duelView(step.duel));
  } else {
    await i.update(buildDuelResult(step.duel, step.log, step.end));
  }
  return true;
}

const DUEL_BASES = new Set([HX_DUEL_ACCEPT, HX_DUEL_DECLINE, HX_DUEL_ACT, HX_DUEL_FORFEIT]);

/** "قتال @شخص [رهان]" / "duel @user [bet]" */
export const DUEL_TRIGGER = /^(?:قتال|duel|fight)\s+(?:<@!?(\d{15,25})>|(\d{15,25}))(?:\s+(\d{1,9}))?$/i;

export async function handleDuelMessage(message: Message, match: RegExpExecArray): Promise<void> {
  if (!message.inGuild()) return;
  const targetId = match[1] ?? match[2];
  const bet = match[3] ? Number(match[3]) : 0;
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target || target.user.bot) {
    await message.reply("I can't find that player.").catch(() => undefined);
    return;
  }
  const r = await createChallenge(
    message.guildId,
    message.channelId,
    { id: message.author.id, name: message.member?.displayName ?? message.author.username },
    { id: target.id, name: target.displayName },
    bet,
  );
  if (!r.ok) {
    const msg: Record<string, string> = {
      self: "You can't duel yourself.",
      no_hunter_a: "Create your hunter first: type `hunter`.",
      no_hunter_b: "That player hasn't become a hunter yet.",
      busy: "One of you is already in a duel.",
      bet_a: "You don't have enough Jenny for that bet.",
      bet_b: "Your opponent doesn't have enough Jenny for that bet.",
      bad_bet: "Invalid bet amount (max 100,000).",
    };
    await message.reply({ content: msg[r.reason], allowedMentions: { parse: [] } }).catch(() => undefined);
    return;
  }
  await message.channel.send(buildDuelChallenge(r.duel)).catch(() => undefined);
}

export async function handleHunterButton(i: ButtonInteraction): Promise<boolean> {
  const { base, ownerId, extra } = parseCid(i.customId);
  if (DUEL_BASES.has(base)) return handleDuelButton(i, base, ownerId, extra);
  if (!BASES.has(base) || base === HX_PICK_ENEMY || base === HX_TRAIN_PICK) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: "This isn't your hunter. Type `hunter` to open yours.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const guildId = i.guildId;
  const uid = i.user.id;

  if (base === HX_APPLY) {
    const existing = await getHunter(uid, guildId);
    if (existing) return (await i.update(buildCardView(uid, existing, nameOf(i))), true);
    const p = await createHunter(uid, guildId);
    await i.update(buildRevealView(uid, p));
    return true;
  }

  const p = await getHunter(uid, guildId);
  if (!p) return (await noHunter(i, uid), true);

  if (base === HX_EXAM) await i.update(buildExamView(uid, p));
  else if (base === HX_EXAM_GO) {
    const r = await advanceExam(uid, guildId);
    if (!r.ok) {
      const note =
        r.reason === "licensed" ? "You already hold a license." :
        r.reason === "level" ? "You need level 5 to enter the exam." :
        r.reason === "coins" ? "You can't afford the entry fee." :
        r.reason === "cooldown" ? `Too tired — retry in ${fmtMs(r.msLeft ?? 0)}.` : "Can't start that stage right now.";
      await i.update(buildExamView(uid, (await getHunter(uid, guildId)) ?? p, note));
    } else if (r.kind === "endurance") {
      const fresh = (await getHunter(uid, guildId)) ?? p;
      await i.update(buildExamView(uid, fresh, r.passed
        ? `🏃 Endurance Race passed! (score ${r.score}/${r.need}) On to the Hunt.`
        : `🏃 You collapsed before the finish... (score ${r.score}/${r.need}). Train and retry later.`));
    } else {
      await i.update(buildFightView(uid, p, r.fight, r.enemy, nameOf(i)));
    }
  } else if (base === HX_CARD) await i.update(buildCardView(uid, p, nameOf(i)));
  else if (base === HX_FIGHT_MENU) {
    const ongoing = await HunterFight.findOne({ userId: uid, guildId });
    if (ongoing && ENEMY_MAP[ongoing.enemyId]) await i.update(buildFightView(uid, p, ongoing, ENEMY_MAP[ongoing.enemyId], nameOf(i)));
    else await i.update(buildEnemyMenu(uid, p));
  } else if (base === HX_TRAIN_MENU) await i.update(buildTrainView(uid, p));
  else if (base === HX_RETREAT) {
    await retreat(uid, guildId);
    await i.update(buildEnemyMenu(uid, p, "You retreated. No rewards, no penalty."));
  } else if (base === HX_ACT) {
    const [act, roundStr] = (extra ?? "").split(":");
    if (!["attack", "guard", "nen", "dodge"].includes(act)) return true;
    const res = await playRound(uid, guildId, act as Action, Number(roundStr));
    if (res.status === "stale") {
      await i.reply({ content: "That fight panel is outdated. Open `hunter` again.", flags: MessageFlags.Ephemeral });
    } else if (res.status === "ongoing") {
      await i.update(buildFightView(uid, p, res.fight, res.enemy, nameOf(i)));
    } else {
      await i.update(buildResultView(uid, res.enemy, res.log, res.end));
    }
  }
  return true;
}

export async function handleHunterSelect(i: StringSelectMenuInteraction): Promise<boolean> {
  const { base, ownerId } = parseCid(i.customId);
  if (base !== HX_PICK_ENEMY && base !== HX_TRAIN_PICK) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: "This isn't your hunter. Type `hunter` to open yours.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const uid = i.user.id;
  const guildId = i.guildId;
  const p = await getHunter(uid, guildId);
  if (!p) return (await noHunter(i, uid), true);
  const value = i.values[0];

  if (base === HX_PICK_ENEMY) {
    const r = await startFight(uid, guildId, value);
    if (!r.ok) {
      const msg =
        r.reason === "locked" ? (r.license ? "🔒 That opponent requires a Hunter License (pass the exam)." : `🔒 You need level ${r.minLevel} for that opponent.`) :
        r.reason === "cooldown" ? `⏳ Catch your breath — wait ${fmtMs(r.msLeft ?? 0)}.` : "Unknown opponent.";
      await i.update(buildEnemyMenu(uid, p, msg));
      return true;
    }
    await i.update(buildFightView(uid, p, r.fight, r.enemy, nameOf(i)));
    return true;
  }

  const r = await trainStat(uid, guildId, value as StatKey);
  let note: string;
  if (r.ok) note = `${STAT_INFO[r.stat].icon} ${STAT_INFO[r.stat].name} increased to **${r.value}**!`;
  else if (r.reason === "cooldown") note = `⏳ You're still tired. Train again in ${fmtMs(r.msLeft ?? 0)}.`;
  else if (r.reason === "coins") note = `You need ${jenny(100)} to train.`;
  else note = "Create your hunter first.";
  const fresh = (await getHunter(uid, guildId)) ?? p;
  await i.update(buildTrainView(uid, fresh, note));
  return true;
}

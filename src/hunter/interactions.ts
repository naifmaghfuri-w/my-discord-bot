import { MessageFlags, type ButtonInteraction, type Message, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { ENEMY_MAP, STAT_INFO, type StatKey } from "./data";
import type { Action } from "./engine";
import { HX_ACT, HX_APPLY, HX_CARD, HX_FIGHT_MENU, HX_PICK_ENEMY, HX_RETREAT, HX_TRAIN_MENU, HX_TRAIN_PICK, parseCid } from "./ids";
import { createHunter, getHunter, playRound, retreat, startFight, trainStat } from "./service";
import { buildApplyView, buildCardView, buildEnemyMenu, buildFightView, buildResultView, buildRevealView, buildTrainView, fmtMs } from "./views";
import { HunterFight } from "../database/models/HunterFight";

export const HUNTER_TRIGGER = /^(hunter|هنتر)$/i;

const BASES = new Set([HX_APPLY, HX_CARD, HX_FIGHT_MENU, HX_PICK_ENEMY, HX_ACT, HX_RETREAT, HX_TRAIN_MENU, HX_TRAIN_PICK]);

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

export async function handleHunterButton(i: ButtonInteraction): Promise<boolean> {
  const { base, ownerId, extra } = parseCid(i.customId);
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

  if (base === HX_CARD) await i.update(buildCardView(uid, p, nameOf(i)));
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
        r.reason === "locked" ? `🔒 You need level ${r.minLevel} for that opponent.` :
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

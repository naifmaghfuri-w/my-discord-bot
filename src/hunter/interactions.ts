import {
  MessageFlags,
  type ButtonInteraction,
  type Message,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";
import { HunterFight } from "../database/models/HunterFight";
import type { IHunterDuel } from "../database/models/HunterDuel";
import { CHAPTERS, CHAR_MAP, ENEMY_MAP, charStats, type Lang, type UpgKey } from "./data";
import { acceptDuel, createChallenge, declineDuel, duelChoose, duelForfeit } from "./duel";
import type { Action } from "./engine";
import {
  HX_ACT, HX_FISH, HX_BOT_MENU, HX_BUY, HX_CHARS, HX_DUEL_ACCEPT, HX_DUEL_ACT, HX_DUEL_DECLINE, HX_DUEL_FORFEIT,
  HX_FIGHT_MENU, HX_GREED, HX_HUB, HX_LANG, HX_OPTIONS, HX_PICK_ENEMY, HX_PVP_MENU, HX_PVP_PICK,
  HX_RETREAT, HX_SELECT_CHAR, HX_SHOP, HX_STORY, HX_STORY_GO, HX_UPG, parseCid,
} from "./ids";
import { renderFishing } from "./fishingImage";
import type { FishAction } from "./fishing";
import { tr, type Key } from "./i18n";
import {
  activeCharId, buyChar, ensureHunter, fishRound, startFishing, getHunter, langOf, playRound, retreat, setActive, setLang, startFight, startStory, upgOf, upgradeChar,
} from "./service";
import {
  buildBotMenu, buildChapterEnd, buildCharsView, buildFishingFail, buildFishingView, buildDuelChallenge, buildDuelResult, buildDuelView, buildFightMenu, buildFightView, buildHub,
  buildOptions, buildPvpMenu, buildResultView, buildShopView, buildStory, fmtMs, type View,
} from "./views";

export const HUNTER_TRIGGER = /^(hunter|هنتر)$/i;
/** "قتال @شخص [رهان]" / "duel @user [bet]" */
export const DUEL_TRIGGER = /^(?:قتال|duel|fight)\s+(?:<@!?(\d{15,25})>|(\d{15,25}))(?:\s+(\d{1,9}))?$/i;

const BASES = new Set([
  HX_HUB, HX_STORY, HX_STORY_GO, HX_GREED, HX_FIGHT_MENU, HX_BOT_MENU, HX_PVP_MENU, HX_CHARS, HX_SHOP, HX_SELECT_CHAR,
  HX_UPG, HX_BUY, HX_OPTIONS, HX_LANG, HX_ACT, HX_RETREAT, HX_FISH,
]);
const DUEL_BASES = new Set([HX_DUEL_ACCEPT, HX_DUEL_DECLINE, HX_DUEL_ACT, HX_DUEL_FORFEIT]);

type Comp = ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction;

/** تعديل الرسالة الحالية: نستبدل المرفقات القديمة بصور الواجهة الجديدة */
const edit = (i: Comp, view: View) => i.update({ ...view, attachments: [] });
const nameOf = (i: Comp): string => (i.inCachedGuild() ? i.member.displayName : i.user.username);

/** "hunter" / "هنتر": يفتح القائمة الرئيسية */
export async function handleHunterMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const p = await getHunter(message.author.id, message.guildId);
  await message.channel.send(buildHub(message.author.id, p, langOf(p))).catch(() => undefined);
}

/* ───────────── المبارزات ───────────── */

async function duelView(d: IHunterDuel): Promise<View> {
  const [pa, pb] = await Promise.all([getHunter(d.aId, d.guildId), getHunter(d.bId, d.guildId)]);
  const sa = charStats(CHAR_MAP[d.aChar], pa?.level ?? 1, pa ? upgOf(pa, d.aChar) : {});
  const sb = charStats(CHAR_MAP[d.bChar], pb?.level ?? 1, pb ? upgOf(pb, d.bChar) : {});
  return buildDuelView(d, sa, sb);
}

async function handleDuelButton(i: ButtonInteraction, base: string, ownerId: string, extra?: string): Promise<boolean> {
  if (!i.inGuild()) return true;
  const stale = (lang: Lang = "en") => i.reply({ content: tr(lang, "d_over"), flags: MessageFlags.Ephemeral });

  if (base === HX_DUEL_ACCEPT || base === HX_DUEL_DECLINE) {
    if (!extra) return true;
    if (base === HX_DUEL_ACCEPT) {
      if (i.user.id !== ownerId) {
        await i.reply({ content: tr("en", "d_only_target"), flags: MessageFlags.Ephemeral });
        return true;
      }
      const d = await acceptDuel(extra, i.user.id);
      if (!d) return (await stale(), true);
      await edit(i, await duelView(d));
      return true;
    }
    const d = await declineDuel(extra, i.user.id);
    if (!d) return (await stale(), true);
    await i.update({ content: "", embeds: [{ description: tr(d.lang, "d_cancelled", { u: `<@${i.user.id}>` }), color: 0x95a5a6 }], components: [], attachments: [], allowedMentions: { parse: [] } });
    return true;
  }

  if (base === HX_DUEL_FORFEIT) {
    const step = await duelForfeit(extra ?? "", i.user.id);
    if (step.status !== "ended") return (await stale(), true);
    await edit(i, buildDuelResult(step.duel, step.log, step.end));
    return true;
  }

  const [duelId, action, roundStr] = (extra ?? "").split(":");
  const step = await duelChoose(duelId, i.user.id, action, Number(roundStr));
  if (step.status === "stale") await i.reply({ content: tr("en", "d_already"), flags: MessageFlags.Ephemeral });
  else if (step.status === "waiting") {
    const p = await getHunter(i.user.id, i.guildId);
    await i.reply({ content: tr(langOf(p), "d_chosen", { a: action }), flags: MessageFlags.Ephemeral });
  } else if (step.status === "ongoing") await edit(i, await duelView(step.duel));
  else await edit(i, buildDuelResult(step.duel, step.log, step.end));
  return true;
}

const DUEL_ERR: Record<string, Key> = {
  self: "pvp_err_self",
  no_char_a: "pvp_err_nochar_a",
  no_char_b: "pvp_err_nochar_b",
  busy: "pvp_err_busy",
  bet_a: "pvp_err_bet_a",
  bet_b: "pvp_err_bet_b",
  bad_bet: "pvp_err_bad_bet",
};

export async function handleDuelMessage(message: Message, match: RegExpExecArray): Promise<void> {
  if (!message.inGuild()) return;
  const mine = await getHunter(message.author.id, message.guildId);
  const lang = langOf(mine);
  const targetId = match[1] ?? match[2];
  const bet = match[3] ? Number(match[3]) : 0;
  const target = await message.guild.members.fetch(targetId).catch(() => null);
  if (!target || target.user.bot) {
    await message.reply(tr(lang, "pvp_not_found")).catch(() => undefined);
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
    await message.reply({ content: tr(lang, DUEL_ERR[r.reason]), allowedMentions: { parse: [] } }).catch(() => undefined);
    return;
  }
  await message.channel.send(buildDuelChallenge(r.duel)).catch(() => undefined);
}

/* ───────────── الأزرار ───────────── */

export async function handleHunterButton(i: ButtonInteraction): Promise<boolean> {
  const { base, ownerId, extra } = parseCid(i.customId);
  if (DUEL_BASES.has(base)) return handleDuelButton(i, base, ownerId, extra);
  if (!BASES.has(base)) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: tr("en", "not_yours"), flags: MessageFlags.Ephemeral });
    return true;
  }
  const uid = i.user.id;
  const guildId = i.guildId;
  let p = await ensureHunter(uid, guildId);
  const lang = langOf(p);
  const name = nameOf(i);
  const idxOf = (s?: string) => Number(/(\d+)$/.exec(s ?? "")?.[1] ?? 0) || 0;

  switch (base) {
    case HX_HUB:
      await edit(i, buildHub(uid, p, lang));
      break;
    case HX_STORY:
      await edit(i, buildStory(uid, p, lang));
      break;
    case HX_GREED:
      await i.reply({ content: tr(lang, "greed_locked"), flags: MessageFlags.Ephemeral });
      break;
    case HX_STORY_GO: {
      const chId = Number(extra);
      const ch = CHAPTERS.find((c) => c.id === chId);
      if (ch?.type === "fishing") {
        const r = await startFishing(uid, guildId, chId);
        if (!r.ok) {
          const note = r.reason === "locked" ? tr(lang, "story_locked_lvl", { level: r.minLevel ?? 1 }) : tr(lang, "outdated");
          await edit(i, buildStory(uid, p, lang, note));
          break;
        }
        await edit(i, buildFishingView(uid, ch, lang, r.state, await renderFishing(r.state.tension, r.state.progress)));
        break;
      }
      const r = await startStory(uid, guildId, chId);
      if (!r.ok) {
        const note =
          r.reason === "locked" ? tr(lang, "story_locked_lvl", { level: r.minLevel ?? 1 }) :
          r.reason === "cooldown" ? tr(lang, "bot_cooldown", { t: fmtMs(r.msLeft ?? 0) }) : tr(lang, "outdated");
        await edit(i, buildStory(uid, p, lang, note));
        break;
      }
      await edit(i, buildFightView(uid, p, r.fight, r.enemy, lang, name));
      break;
    }
    case HX_FISH: {
      const [act, roundStr] = (extra ?? "").split(":");
      if (!["pull", "balance", "relax"].includes(act)) break;
      const res = await fishRound(uid, guildId, act as FishAction, Number(roundStr));
      if (res.status === "stale") {
        await i.reply({ content: tr(lang, "fish_stale"), flags: MessageFlags.Ephemeral });
      } else if (res.status === "ongoing") {
        const ch = CHAPTERS.find((c) => c.id === res.state.chapter)!;
        await edit(i, buildFishingView(uid, ch, lang, res.state, await renderFishing(res.state.tension, res.state.progress)));
      } else if (res.status === "failed") {
        await edit(i, buildFishingFail(uid, CHAPTERS.find((c) => c.id === res.chapter)!, lang, res.reason));
      } else {
        const ch = res.end.chapter!;
        await edit(i, buildChapterEnd(uid, ch, res.end, lang, [], ch.image ?? "logo.jpg"));
      }
      break;
    }
    case HX_FIGHT_MENU: {
      const ongoing = await HunterFight.findOne({ userId: uid, guildId });
      if (ongoing && ENEMY_MAP[ongoing.enemyId] && CHAR_MAP[ongoing.charId]) {
        await edit(i, buildFightView(uid, p, ongoing, ENEMY_MAP[ongoing.enemyId], lang, name));
        break;
      }
      await edit(i, buildFightMenu(uid, lang));
      break;
    }
    case HX_BOT_MENU:
      if (!activeCharId(p)) await edit(i, buildFightMenu(uid, lang, tr(lang, "need_char")));
      else await edit(i, buildBotMenu(uid, p, lang));
      break;
    case HX_PVP_MENU:
      if (!activeCharId(p)) await edit(i, buildFightMenu(uid, lang, tr(lang, "need_char")));
      else await edit(i, buildPvpMenu(uid, lang));
      break;
    case HX_CHARS:
      await edit(i, buildCharsView(uid, p, lang, idxOf(extra)));
      break;
    case HX_SHOP:
      await edit(i, buildShopView(uid, p, lang, idxOf(extra)));
      break;
    case HX_SELECT_CHAR: {
      const [charId] = (extra ?? "").split(":");
      const ok = await setActive(uid, guildId, charId);
      p = (await getHunter(uid, guildId)) ?? p;
      await edit(i, buildCharsView(uid, p, lang, idxOf(extra), ok ? tr(lang, "selected", { name: CHAR_MAP[charId]?.name[lang] ?? charId }) : undefined));
      break;
    }
    case HX_UPG: {
      const [charId, key] = (extra ?? "").split(":");
      const r = await upgradeChar(uid, guildId, charId, key as UpgKey);
      p = (await getHunter(uid, guildId)) ?? p;
      const label = tr(lang, `upg_${key}` as Key);
      const note = r.ok ? tr(lang, "upg_done", { name: label, lv: r.level }) : r.reason === "coins" ? tr(lang, "upg_coins", { cost: r.cost ?? 0 }) : tr(lang, "upg_fail");
      await edit(i, buildCharsView(uid, p, lang, idxOf(extra), note));
      break;
    }
    case HX_BUY: {
      const [charId] = (extra ?? "").split(":");
      const r = await buyChar(uid, guildId, charId);
      p = (await getHunter(uid, guildId)) ?? p;
      const note = r.ok
        ? tr(lang, "bought", { name: CHAR_MAP[charId].name[lang] })
        : r.reason === "coins" ? tr(lang, "buy_coins", { price: r.price ?? 0 }) : tr(lang, "buy_owned");
      await edit(i, buildShopView(uid, p, lang, idxOf(extra), note));
      break;
    }
    case HX_OPTIONS:
      await edit(i, buildOptions(uid, lang));
      break;
    case HX_LANG: {
      const next: Lang = extra === "ar" ? "ar" : "en";
      await setLang(uid, guildId, next);
      await edit(i, buildOptions(uid, next, tr(next, "opt_lang_set")));
      break;
    }
    case HX_RETREAT:
      await retreat(uid, guildId);
      await edit(i, buildBotMenu(uid, p, lang, tr(lang, "retreated")));
      break;
    case HX_ACT: {
      const [act, roundStr] = (extra ?? "").split(":");
      if (!["attack", "guard", "nen", "dodge"].includes(act)) break;
      const res = await playRound(uid, guildId, act as Action, Number(roundStr));
      if (res.status === "stale") {
        await i.reply({ content: tr(lang, "stale_fight"), flags: MessageFlags.Ephemeral });
      } else if (res.status === "ongoing") {
        await edit(i, buildFightView(uid, p, res.fight, res.enemy, lang, name));
      } else {
        if (res.end.chapter) await edit(i, buildChapterEnd(uid, res.end.chapter, res.end, lang, res.log, CHAR_MAP[res.charId].image));
        else await edit(i, buildResultView(uid, res.enemy, res.charId, res.log, res.end, lang));
      }
      break;
    }
  }
  return true;
}

/* ───────────── القوائم المنسدلة ───────────── */

export async function handleHunterSelect(i: StringSelectMenuInteraction | UserSelectMenuInteraction): Promise<boolean> {
  const { base, ownerId } = parseCid(i.customId);
  if (base !== HX_PICK_ENEMY && base !== HX_PVP_PICK) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: tr("en", "not_yours"), flags: MessageFlags.Ephemeral });
    return true;
  }
  const uid = i.user.id;
  const guildId = i.guildId;
  const p = await ensureHunter(uid, guildId);
  const lang = langOf(p);
  const value = i.values[0];

  if (base === HX_PICK_ENEMY) {
    const r = await startFight(uid, guildId, value);
    if (!r.ok) {
      const msg =
        r.reason === "no_char" ? tr(lang, "need_char") :
        r.reason === "locked" ? (r.license ? tr(lang, "bot_locked_license") : tr(lang, "bot_locked_level", { level: r.minLevel ?? 1 })) :
        r.reason === "cooldown" ? tr(lang, "bot_cooldown", { t: fmtMs(r.msLeft ?? 0) }) : tr(lang, "bot_unknown");
      await edit(i, buildBotMenu(uid, p, lang, msg));
      return true;
    }
    await edit(i, buildFightView(uid, p, r.fight, r.enemy, lang, nameOf(i)));
    return true;
  }

  // تحدي لاعب من القائمة
  const target = await i.guild?.members.fetch(value).catch(() => null);
  if (!target || target.user.bot) {
    await edit(i, buildPvpMenu(uid, lang, tr(lang, target ? "pvp_err_bot" : "pvp_not_found")));
    return true;
  }
  const r = await createChallenge(guildId, i.channelId ?? "", { id: uid, name: nameOf(i) }, { id: target.id, name: target.displayName }, 0);
  if (!r.ok) {
    await edit(i, buildPvpMenu(uid, lang, tr(lang, DUEL_ERR[r.reason])));
    return true;
  }
  const ch = i.channel;
  if (ch && "send" in ch) await ch.send(buildDuelChallenge(r.duel)).catch(() => undefined);
  await edit(i, buildPvpMenu(uid, lang, tr(lang, "pvp_sent")));
  return true;
}


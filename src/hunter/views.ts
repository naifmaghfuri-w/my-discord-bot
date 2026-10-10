import { join } from "node:path";
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type BaseMessageOptions,
} from "discord.js";
import { jenny } from "../constants";
import type { IHunterDuel } from "../database/models/HunterDuel";
import type { IHunterFight } from "../database/models/HunterFight";
import type { IHunterProfile } from "../database/models/HunterProfile";
import {
  CHAPTERS,
  type Chapter,
  CHARS,
  CHAR_MAP,
  ENEMIES,
  NEN,
  SHOP_CHARS,
  STAT_INFO,
  STAT_KEYS,
  UPG_KEYS,
  UPG_MAX,
  charStats,
  rankFor,
  upgCost,
  type CharDef,
  type EnemyDef,
  type Lang,
  type UpgKey,
} from "./data";
import { MAX_ROUNDS, NEN_COST, maxAura, maxHp } from "./engine";
import {
  HX_ACT, HX_FISH, HX_BOT_MENU, HX_BUY, HX_CHARS, HX_DUEL_ACCEPT, HX_DUEL_ACT, HX_DUEL_DECLINE, HX_DUEL_FORFEIT,
  HX_FIGHT_MENU, HX_GREED, HX_HUB, HX_LANG, HX_OPTIONS, HX_PICK_ENEMY, HX_PVP_MENU, HX_PVP_PICK,
  HX_RETREAT, HX_SELECT_CHAR, HX_SHOP, HX_STORY, HX_STORY_GO, HX_UPG, cid,
} from "./ids";
import { enemyName, rankName, tr, type Key } from "./i18n";
import type { FishMood } from "./fishing";
import { FISH_MAX_ROUNDS } from "./fishing";
import { DAILY_REWARDED_FIGHTS, activeCharId, upgOf, type FightEnd } from "./service";
import type { DuelEnd } from "./duel";

export type View = BaseMessageOptions;

const COLOR = 0x2ecc71;
const ASSET_DIR = join(__dirname, "..", "assets", "hunter");

const file = (name: string) => new AttachmentBuilder(join(ASSET_DIR, name), { name });
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
const cName = (c: CharDef, lang: Lang) => c.name[lang];
const btn = (id: string, label: string, style: ButtonStyle, emoji?: string, disabled = false) => {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style).setDisabled(disabled);
  if (emoji) b.setEmoji(emoji);
  return b;
};
const row = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);
const backRow = (owner: string, lang: Lang, to: string = HX_HUB) =>
  row(btn(cid(to, owner), tr(lang, "btn_back"), ButtonStyle.Secondary, "↩️"));

/* ───────────── القائمة الرئيسية ───────────── */

export function buildHub(owner: string, p: IHunterProfile | null, lang: Lang): View {
  const lines = [tr(lang, "hub_desc")];
  if (p) {
    const rank = rankFor(p.level);
    lines.push("", tr(lang, "hub_stats", { rank: `${rank.icon} ${rankName(lang, rank.name)}`, level: p.level, wins: p.wins, losses: p.losses }));
    const a = activeCharId(p);
    lines.push(a ? tr(lang, "hub_active", { name: `${CHAR_MAP[a].icon} ${cName(CHAR_MAP[a], lang)}` }) : tr(lang, "hub_no_char"));
  } else lines.push("", tr(lang, "hub_no_char"));
  const embed = new EmbedBuilder().setColor(0xc0392b).setTitle(tr(lang, "hub_title")).setDescription(lines.join("\n")).setImage("attachment://logo.jpg");
  return {
    embeds: [embed],
    files: [file("logo.jpg")],
    components: [
      row(
        btn(cid(HX_STORY, owner), tr(lang, "btn_story"), ButtonStyle.Success, "📖"),
        btn(cid(HX_GREED, owner), tr(lang, "btn_greed"), ButtonStyle.Secondary, "🔒", true),
        btn(cid(HX_FIGHT_MENU, owner), tr(lang, "btn_fight"), ButtonStyle.Danger, "⚔️"),
      ),
      row(
        btn(cid(HX_SHOP, owner, "R0"), tr(lang, "btn_shop"), ButtonStyle.Primary, "🛒"),
        btn(cid(HX_OPTIONS, owner), tr(lang, "btn_options"), ButtonStyle.Secondary, "⚙️"),
      ),
    ],
  };
}

/* ───────────── القصة ───────────── */

export const GON_EMOJI = "<:Gon:1558228812414722159>";

export function buildStory(owner: string, p: IHunterProfile, lang: Lang, note?: string): View {
  const next = CHAPTERS.find((c) => c.id === p.story + 1);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const lines: string[] = [];
  if (note) lines.push(note, "");
  let image = "logo.jpg";
  if (next) {
    lines.push(`**${tr(lang, "story_chapter", { n: next.id, title: next.title[lang] })}**`, tr(lang, "story_mission", { m: next.mission[lang] }));
    const locked = p.level < next.minLevel;
    if (locked) lines.push("", tr(lang, "story_locked_lvl", { level: next.minLevel }));
    image = next.image ?? (next.unlock ? CHAR_MAP[next.unlock].image : "logo.jpg");
    const go = next.type === "fishing"
      ? btn(cid(HX_STORY_GO, owner, next.id), tr(lang, "btn_fish"), ButtonStyle.Success, GON_EMOJI, locked)
      : btn(cid(HX_STORY_GO, owner, next.id), tr(lang, "btn_fight"), ButtonStyle.Danger, "⚔️", locked);
    rows.push(row(go));
  } else lines.push(tr(lang, "story_done"));
  rows.push(backRow(owner, lang));
  const embed = new EmbedBuilder().setColor(0x9b59b6).setDescription(lines.join("\n")).setImage(`attachment://${image}`);
  return { embeds: [embed], files: [file(image)], components: rows };
}

/* ───────────── صيد السمكة ───────────── */

const MOOD_KEY: Record<FishMood, Key> = { thrash: "fish_thrash", steady: "fish_steady", tired: "fish_tired" };

export function buildFishingView(
  owner: string,
  ch: Chapter,
  lang: Lang,
  s: { tension: number; progress: number; round: number; mood: FishMood },
  image: Buffer | null,
): View {
  const embed = new EmbedBuilder()
    .setColor(0x1abc9c)
    .setTitle(`🎣 ${ch.mission[lang]}`)
    .setDescription(`${tr(lang, MOOD_KEY[s.mood])}\n\n${tr(lang, "fish_status", { t: Math.round(s.tension), p: Math.round(s.progress) })}`)
    .setFooter({ text: tr(lang, "fish_footer", { r: s.round + 1, max: FISH_MAX_ROUNDS }) });
  const files = [];
  if (image) {
    files.push(new AttachmentBuilder(image, { name: "fishing.png" }));
    embed.setImage("attachment://fishing.png");
  }
  const r = s.round;
  return {
    embeds: [embed],
    files,
    components: [
      row(
        btn(cid(HX_FISH, owner, `pull:${r}`), tr(lang, "fish_pull"), ButtonStyle.Danger, "🔴"),
        btn(cid(HX_FISH, owner, `balance:${r}`), tr(lang, "fish_balance"), ButtonStyle.Primary, "🟡"),
        btn(cid(HX_FISH, owner, `relax:${r}`), tr(lang, "fish_relax"), ButtonStyle.Success, "🟢"),
      ),
    ],
  };
}

export function buildFishingFail(owner: string, ch: Chapter, lang: Lang, reason: "snapped" | "escaped"): View {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🎣 ${ch.mission[lang]}`)
    .setDescription(tr(lang, reason === "snapped" ? "fish_snapped" : "fish_escaped"))
    .setImage(`attachment://${ch.image ?? "logo.jpg"}`);
  return {
    embeds: [embed],
    files: [file(ch.image ?? "logo.jpg")],
    components: [row(btn(cid(HX_STORY, owner), tr(lang, "btn_retry"), ButtonStyle.Success, "🔁"), btn(cid(HX_HUB, owner), tr(lang, "btn_back"), ButtonStyle.Secondary, "↩️"))],
  };
}

/** نهاية فصل (نجاح/فشل): ماذا حصل، الجوائز، الشخصية المفتوحة، ثم زر التالي */
export function buildChapterEnd(owner: string, ch: Chapter, end: FightEnd, lang: Lang, log: string[], image: string): View {
  const win = end.outcome === "win";
  const parts: string[] = [];
  if (log.length) parts.push(log.join("\n"), "");
  if (win) {
    parts.push(`${tr(lang, "story_cleared", { n: ch.id })}`, ch.outro[lang], "");
    if (end.cleared) {
      parts.push(tr(lang, "story_reward", { xp: end.xp, coins: end.coins, extra: "" }));
      if (end.leveledUp) parts.push(tr(lang, "r_level", { lv: end.level }));
      if (end.unlocked) parts.push(tr(lang, "story_unlocked", { name: cName(CHAR_MAP[end.unlocked], lang) }));
      if (end.license) parts.push(tr(lang, "story_license_got"));
    }
  } else parts.push(end.outcome === "loss" ? tr(lang, "r_loss") : tr(lang, "r_draw"));
  const unlockedImg = end.unlocked ? CHAR_MAP[end.unlocked].image : image;
  const embed = new EmbedBuilder()
    .setColor(win ? 0x2ecc71 : 0xe74c3c)
    .setDescription(parts.join("\n"))
    .setImage(`attachment://${unlockedImg}`);
  const nextRow = win
    ? row(btn(cid(HX_STORY, owner), tr(lang, "btn_next"), ButtonStyle.Success, "➡️"))
    : row(btn(cid(HX_STORY, owner), tr(lang, "btn_retry"), ButtonStyle.Success, "🔁"), btn(cid(HX_HUB, owner), tr(lang, "btn_back"), ButtonStyle.Secondary, "↩️"));
  return { embeds: [embed], files: [file(unlockedImg)], components: [nextRow] };
}

/* ───────────── قائمة القتال ───────────── */

export function buildFightMenu(owner: string, lang: Lang, note?: string): View {
  const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle(tr(lang, "fight_title")).setDescription((note ? `${note}\n\n` : "") + tr(lang, "fight_desc"));
  return {
    embeds: [embed],
    files: [],
    components: [
      row(
        btn(cid(HX_BOT_MENU, owner), tr(lang, "btn_bot"), ButtonStyle.Danger, "🤖"),
        btn(cid(HX_PVP_MENU, owner), tr(lang, "btn_pvp"), ButtonStyle.Danger, "🥊"),
        btn(cid(HX_CHARS, owner, "R0"), tr(lang, "btn_chars"), ButtonStyle.Primary, "🧑‍🤝‍🧑"),
      ),
      backRow(owner, lang),
    ],
  };
}

export function buildBotMenu(owner: string, p: IHunterProfile, lang: Lang, note?: string): View {
  const list = ENEMIES.filter((e) => !e.exam && !e.storyOnly);
  const lockedFor = (e: EnemyDef) => p.level < e.minLevel || (Boolean(e.needsLicense) && !p.license);
  const lines = list
    .map((e) => {
      const nen = e.nen ? `${NEN[e.nen].icon} ${NEN[e.nen].name}` : tr(lang, "bot_no_nen");
      return `${lockedFor(e) ? "🔒" : e.icon} **${enemyName(lang, e.id, e.name)}** — Lv ${e.minLevel}+${e.needsLicense ? ` · 🎴 ${tr(lang, "bot_license")}` : ""} · ${nen}`;
    })
    .join("\n");
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(tr(lang, "bot_title"))
    .setDescription((note ? `**${note}**\n\n` : "") + lines + `\n\n_${tr(lang, "bot_limit", { n: DAILY_REWARDED_FIGHTS })}_`);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(HX_PICK_ENEMY, owner))
    .setPlaceholder(tr(lang, "bot_pick"))
    .addOptions(
      list.map((e) => ({
        label: `${enemyName(lang, e.id, e.name)} (Lv ${e.minLevel}+)`,
        value: e.id,
        description: `${e.xp} XP · ${e.coins} Jenny`,
        emoji: lockedFor(e) ? "🔒" : e.icon,
      })),
    );
  return {
    embeds: [embed],
    files: [],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), backRow(owner, lang, HX_FIGHT_MENU)],
  };
}

export function buildPvpMenu(owner: string, lang: Lang, note?: string): View {
  const embed = new EmbedBuilder().setColor(0xe67e22).setTitle(tr(lang, "pvp_title")).setDescription((note ? `**${note}**\n\n` : "") + tr(lang, "pvp_desc"));
  const menu = new UserSelectMenuBuilder().setCustomId(cid(HX_PVP_PICK, owner)).setPlaceholder(tr(lang, "pvp_pick")).setMinValues(1).setMaxValues(1);
  return {
    embeds: [embed],
    files: [],
    components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(menu), backRow(owner, lang, HX_FIGHT_MENU)],
  };
}

/* ───────────── الشخصيات والمتجر ───────────── */

function charStatsText(c: CharDef, p: IHunterProfile, lang: Lang): string {
  const s = charStats(c, p.level, upgOf(p, c.id));
  const lines = STAT_KEYS.map((k) => `${STAT_INFO[k].icon} ${tr(lang, `stat_${k}` as Key)}: **${s[k]}**`);
  lines.push(tr(lang, "hpool", { hp: maxHp(s.end), aura: maxAura(s.aura) }));
  return lines.join("\n");
}

function nenText(c: CharDef, lang: Lang): string {
  if (c.special) return tr(lang, "nen_none_skill", { icon: c.special.icon, skill: c.special.name[lang] });
  return c.nen ? `${NEN[c.nen].icon} ${NEN[c.nen].name}` : tr(lang, "nen_none");
}

const wrap = (i: number, n: number) => (n <= 0 ? 0 : ((i % n) + n) % n);

/** تصفح الشخصيات المملوكة: تطوير + اختيار */
export function buildCharsView(owner: string, p: IHunterProfile, lang: Lang, idx: number, note?: string): View {
  const owned = CHARS.filter((c) => p.chars.includes(c.id));
  if (owned.length === 0) {
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(tr(lang, "chars_title")).setDescription(tr(lang, "chars_empty"));
    return { embeds: [embed], files: [], components: [backRow(owner, lang, HX_FIGHT_MENU)] };
  }
  const i = wrap(idx, owned.length);
  const c = owned[i];
  const isActive = activeCharId(p) === c.id;
  const upg = upgOf(p, c.id);
  const upgLines = UPG_KEYS.map((k) => `${tr(lang, `upg_${k}` as Key)}: **${upg[k] ?? 0}/${UPG_MAX}**`).join("  ·  ");
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`${c.icon} ${cName(c, lang)}${isActive ? `  ${tr(lang, "chars_active")}` : ""}`)
    .setDescription(
      (note ? `**${note}**\n\n` : "") + `${c.desc[lang]}\n\n${nenText(c, lang)}\n\n${charStatsText(c, p, lang)}\n\n**${tr(lang, "upg_title")}**\n${upgLines}`,
    )
    .setImage(`attachment://${c.image}`)
    .setFooter({ text: tr(lang, "chars_count", { i: i + 1, n: owned.length }) });
  const upgRow = row(
    ...UPG_KEYS.map((k: UpgKey) => {
      const lv = upg[k] ?? 0;
      const maxed = lv >= UPG_MAX;
      const label = maxed ? tr(lang, "upg_max", { name: tr(lang, `upg_${k}` as Key) }) : tr(lang, "upg_btn", { name: tr(lang, `upg_${k}` as Key), cost: upgCost(lv) });
      return btn(cid(HX_UPG, owner, `${c.id}:${k}:${i}`), label, ButtonStyle.Primary, k === "atk" ? "⚔️" : k === "def" ? "🛡️" : "💨", maxed);
    }),
  );
  return {
    embeds: [embed],
    files: [file(c.image)],
    components: [
      row(
        btn(cid(HX_CHARS, owner, `L${wrap(i - 1, owned.length)}`), "◀", ButtonStyle.Secondary),
        btn(cid(HX_SELECT_CHAR, owner, `${c.id}:${i}`), tr(lang, "btn_select"), ButtonStyle.Success, "✅", isActive),
        btn(cid(HX_CHARS, owner, `R${wrap(i + 1, owned.length)}`), "▶", ButtonStyle.Secondary),
      ),
      upgRow,
      backRow(owner, lang, HX_FIGHT_MENU),
    ],
  };
}

/** تصفح شخصيات المتجر مع صورها */
export function buildShopView(owner: string, p: IHunterProfile, lang: Lang, idx: number, note?: string): View {
  if (SHOP_CHARS.length === 0) {
    return { embeds: [new EmbedBuilder().setColor(COLOR).setTitle(tr(lang, "shop_title")).setDescription(tr(lang, "shop_empty"))], files: [], components: [backRow(owner, lang)] };
  }
  const i = wrap(idx, SHOP_CHARS.length);
  const c = SHOP_CHARS[i];
  const owned = p.chars.includes(c.id);
  const price = c.unlock.type === "shop" ? c.unlock.price : 0;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`${c.icon} ${cName(c, lang)}`)
    .setDescription(
      (note ? `**${note}**\n\n` : "") +
        `${c.desc[lang]}\n\n${nenText(c, lang)}\n\n${charStatsText(c, p, lang)}\n\n${owned ? tr(lang, "shop_owned") : tr(lang, "shop_price", { price: jenny(price) })}`,
    )
    .setImage(`attachment://${c.image}`)
    .setFooter({ text: tr(lang, "shop_item", { i: i + 1, n: SHOP_CHARS.length }) });
  return {
    embeds: [embed],
    files: [file(c.image)],
    components: [
      row(
        btn(cid(HX_SHOP, owner, `L${wrap(i - 1, SHOP_CHARS.length)}`), "◀", ButtonStyle.Secondary),
        btn(cid(HX_BUY, owner, `${c.id}:${i}`), owned ? tr(lang, "shop_owned") : tr(lang, "btn_buy", { price }), ButtonStyle.Success, "🛒", owned),
        btn(cid(HX_SHOP, owner, `R${wrap(i + 1, SHOP_CHARS.length)}`), "▶", ButtonStyle.Secondary),
      ),
      backRow(owner, lang),
    ],
  };
}

/* ───────────── الخيارات ───────────── */

export function buildOptions(owner: string, lang: Lang, note?: string): View {
  const embed = new EmbedBuilder().setColor(0x95a5a6).setTitle(tr(lang, "opt_title")).setDescription((note ? `**${note}**\n\n` : "") + tr(lang, "opt_desc"));
  return {
    embeds: [embed],
    files: [],
    components: [
      row(
        btn(cid(HX_LANG, owner, "en"), "English", lang === "en" ? ButtonStyle.Success : ButtonStyle.Secondary, "🇬🇧", lang === "en"),
        btn(cid(HX_LANG, owner, "ar"), "العربية", lang === "ar" ? ButtonStyle.Success : ButtonStyle.Secondary, "🇸🇦", lang === "ar"),
      ),
      backRow(owner, lang),
    ],
  };
}

/* ───────────── القتال ───────────── */

export function buildFightView(owner: string, p: IHunterProfile, fight: IHunterFight, enemy: EnemyDef, lang: Lang, name: string): View {
  const c = CHAR_MAP[fight.charId];
  const s = charStats(c, p.level, upgOf(p, c.id));
  const pMax = maxHp(s.end);
  const pAura = maxAura(s.aura);
  const eMax = maxHp(enemy.stats.end);
  const eAuraMax = maxAura(enemy.stats.aura);
  const canNen = (c.nen !== null || Boolean(c.special)) && s.aura > 0 && fight.aura >= NEN_COST;
  const eName = enemyName(lang, enemy.id, enemy.name);
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(tr(lang, "f_title", { me: `${c.icon} ${cName(c, lang)}`, icon: enemy.icon, enemy: eName }))
    .setDescription(
      `**${name}** ❤️ ${bar(fight.hp, pMax)} ${Math.max(0, Math.round(fight.hp))}/${pMax}\n🔮 ${bar(fight.aura, pAura)} ${Math.round(fight.aura)}/${pAura}\n\n` +
        `**${eName}** ❤️ ${bar(fight.eHp, eMax)} ${Math.max(0, Math.round(fight.eHp))}/${eMax}\n🔮 ${bar(fight.eAura, eAuraMax)} ${Math.round(fight.eAura)}/${eAuraMax}` +
        (fight.lastLog.length ? `\n\n${fight.lastLog.join("\n")}` : `\n\n${tr(lang, "f_first")}`),
    )
    .setThumbnail(`attachment://${c.image}`)
    .setFooter({ text: tr(lang, "f_footer", { r: fight.round + 1, max: MAX_ROUNDS, cost: NEN_COST }) });
  const r = fight.round;
  return {
    embeds: [embed],
    files: [file(c.image)],
    components: [
      row(
        btn(cid(HX_ACT, owner, `attack:${r}`), tr(lang, "btn_attack"), ButtonStyle.Danger, "👊"),
        btn(cid(HX_ACT, owner, `guard:${r}`), tr(lang, "btn_guard"), ButtonStyle.Primary, "🛡️"),
        btn(cid(HX_ACT, owner, `nen:${r}`), c.special ? c.special.name[lang] : tr(lang, "btn_nen"), ButtonStyle.Success, c.special ? c.special.icon : "🔮", !canNen),
        btn(cid(HX_ACT, owner, `dodge:${r}`), tr(lang, "btn_dodge"), ButtonStyle.Secondary, "💨"),
        btn(cid(HX_RETREAT, owner), tr(lang, "btn_retreat"), ButtonStyle.Secondary),
      ),
    ],
  };
}

export function buildResultView(owner: string, enemy: EnemyDef, charId: string, log: string[], end: FightEnd, lang: Lang): View {
  const title = end.outcome === "win" ? tr(lang, "r_win") : end.outcome === "loss" ? tr(lang, "r_loss") : tr(lang, "r_draw");
  const color = end.outcome === "win" ? 0x2ecc71 : end.outcome === "loss" ? 0xe74c3c : 0x95a5a6;
  const parts = [log.join("\n"), ""];
  if (end.xp > 0) parts.push(tr(lang, "r_xp", { x: end.xp }));
  if (end.coins > 0) parts.push(`+${jenny(end.coins)}`);
  if (end.capped) parts.push(tr(lang, "r_capped"));
  if (end.leveledUp) parts.push("", tr(lang, "r_level", { lv: end.level }));
  if (end.cleared && end.chapter) parts.push("", tr(lang, "story_cleared", { n: end.chapter.id }));
  if (end.unlocked) parts.push(tr(lang, "story_unlocked", { name: cName(CHAR_MAP[end.unlocked], lang) }));
  if (end.license) parts.push(tr(lang, "story_license_got"));
  const c = CHAR_MAP[charId];
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${title} — ${enemy.icon} ${enemyName(lang, enemy.id, enemy.name)}`)
    .setDescription(parts.join("\n"))
    .setThumbnail(`attachment://${c.image}`);
  return {
    embeds: [embed],
    files: [file(c.image)],
    components: [row(btn(cid(end.chapter ? HX_STORY : HX_BOT_MENU, owner), tr(lang, "btn_back"), ButtonStyle.Secondary, "↩️"), btn(cid(HX_HUB, owner), "🎴", ButtonStyle.Secondary))],
  };
}

/* ───────────── المبارزات ───────────── */

export function buildDuelChallenge(duel: IHunterDuel): View {
  const lang = duel.lang;
  const id = String((duel as unknown as { _id: unknown })._id);
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(tr(lang, "d_challenge"))
    .setDescription(
      `${tr(lang, "d_challenges", { a: `<@${duel.aId}>`, b: `<@${duel.bId}>` })}\n${duel.bet > 0 ? tr(lang, "d_bet", { bet: jenny(duel.bet) }) : tr(lang, "d_nobet")}\n\n${tr(lang, "d_secret")}`,
    );
  return {
    content: `<@${duel.bId}>`,
    embeds: [embed],
    components: [
      row(
        btn(cid(HX_DUEL_ACCEPT, duel.bId, id), tr(lang, "d_accept"), ButtonStyle.Success, "✅"),
        btn(cid(HX_DUEL_DECLINE, duel.bId, id), tr(lang, "d_decline"), ButtonStyle.Danger, "✖️"),
      ),
    ],
    allowedMentions: { users: [duel.bId] },
  };
}

export function buildDuelView(duel: IHunterDuel, aStats: { end: number; aura: number }, bStats: { end: number; aura: number }): View {
  const lang = duel.lang;
  const id = String((duel as unknown as { _id: unknown })._id);
  const r = duel.round;
  const ca = CHAR_MAP[duel.aChar];
  const cb = CHAR_MAP[duel.bChar];
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle(`⚔️ ${duel.aName} (${ca.icon} ${cName(ca, lang)}) vs ${duel.bName} (${cb.icon} ${cName(cb, lang)})`)
    .setDescription(
      `**${duel.aName}** ❤️ ${bar(duel.aHp, maxHp(aStats.end))} ${Math.round(duel.aHp)}/${maxHp(aStats.end)}\n🔮 ${bar(duel.aAura, maxAura(aStats.aura))} ${Math.round(duel.aAura)}\n\n` +
        `**${duel.bName}** ❤️ ${bar(duel.bHp, maxHp(bStats.end))} ${Math.round(duel.bHp)}/${maxHp(bStats.end)}\n🔮 ${bar(duel.bAura, maxAura(bStats.aura))} ${Math.round(duel.bAura)}` +
        (duel.lastLog.length ? `\n\n${duel.lastLog.join("\n")}` : `\n\n${tr(lang, "d_pick")}`) +
        (duel.bet > 0 ? `\n\n💰 ${jenny(duel.bet)}` : ""),
    )
    .setThumbnail(`attachment://${ca.image}`)
    .setImage(`attachment://${cb.image}`)
    .setFooter({ text: tr(lang, "f_footer", { r: r + 1, max: MAX_ROUNDS, cost: NEN_COST }) });
  const mk = (a: string, key: Key, emoji: string, style: ButtonStyle) => btn(cid(HX_DUEL_ACT, "-", `${id}:${a}:${r}`), tr(lang, key), style, emoji);
  const files = ca.image === cb.image ? [file(ca.image)] : [file(ca.image), file(cb.image)];
  return {
    content: "",
    embeds: [embed],
    files,
    components: [
      row(
        mk("attack", "btn_attack", "👊", ButtonStyle.Danger),
        mk("guard", "btn_guard", "🛡️", ButtonStyle.Primary),
        mk("nen", "btn_skill", "✨", ButtonStyle.Success),
        mk("dodge", "btn_dodge", "💨", ButtonStyle.Secondary),
        btn(cid(HX_DUEL_FORFEIT, "-", id), tr(lang, "d_forfeit"), ButtonStyle.Secondary),
      ),
    ],
  };
}

export function buildDuelResult(duel: IHunterDuel, log: string[], end: DuelEnd): View {
  const lang = duel.lang;
  const lines = [log.join("\n"), ""];
  if (end.draw) lines.push(tr(lang, "d_draw"));
  else {
    lines.push(tr(lang, "d_wins", { u: `<@${end.winnerId}>` }));
    if (end.bet > 0) lines.push(tr(lang, "d_takes", { w: `<@${end.winnerId}>`, bet: jenny(end.bet), l: `<@${end.loserId}>` }));
    if (end.xp > 0) lines.push(tr(lang, "d_xp", { x: end.xp }));
    if (end.capped) lines.push(tr(lang, "d_capped"));
  }
  const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle(`⚔️ ${duel.aName} vs ${duel.bName}`).setDescription(lines.join("\n"));
  return { content: "", embeds: [embed], files: [], components: [], allowedMentions: { parse: [] } };
}

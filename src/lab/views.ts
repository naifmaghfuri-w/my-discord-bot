import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { CURRENCY, jenny } from "../constants";
import { nextResetUnix, todayKey } from "../quests/time";
import { COMPOUND_MAP, COMPOUNDS, RARITY_INFO, type Rarity } from "./compounds";
import { ELEMENT_MAP, ELEMENTS } from "./elements";
import {
  BACK,
  CODEX_PAGE,
  HINT_BUY_SELECT,
  HINT_PAGE,
  NOOP,
  OPEN_ACH,
  OPEN_HINTS,
  OPEN_QUESTS,
  OPEN_TRADE_HELP,
  OPEN_EXTRA,
  OPEN_LAB,
  LEVELS_UNLOCK_SELECT,
  MARKET_SELL_SELECT,
  MARKET_SELLALL_SELECT,
  OPEN_CODEX,
  OPEN_LEVELS,
  OPEN_MARKET,
  OPEN_SHOP,
  OPEN_WAREHOUSE,
  PRESSURE_DOWN,
  PRESSURE_UP,
  PUBLISH,
  REACT,
  RESET,
  SELECT_COMPOUND,
  SELECT_ELEMENT,
  SHOP_BUY_SELECT,
  SHOP_QTY,
  STEP_TOGGLE,
  TEMP_DOWN,
  TEMP_UP,
  cid,
} from "./ids";
import { getMarketQuote, trendIcon } from "./market";
import { ACHIEVEMENTS, questsForDay, titleFor } from "./progress";
import { renderFlask, renderResult } from "./render";
import { ARTICLE_REPUTATION, HINT_PRICE, hintClues, reputationBonus, xpNeeded } from "./service";
import type { ILabProfile } from "../database/models/LabProfile";
import type { ILabSession } from "../database/models/LabSession";

type Row = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

export interface PanelResult {
  content?: string;
  embeds: EmbedBuilder[];
  components: Row[];
  files: { attachment: Buffer; name: string }[];
}

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

function itemLabel(id: string): string {
  const e = ELEMENT_MAP[id];
  if (e) return `${e.icon} ${e.name}`;
  const c = COMPOUND_MAP[id];
  return c ? `${c.icon} ${c.name}` : id;
}

function bar(value: number, max: number, size = 12): string {
  const filled = Math.max(0, Math.min(size, Math.round((value / Math.max(1, max)) * size)));
  return "▰".repeat(filled) + "▱".repeat(size - filled);
}

export async function buildMainPanel(profile: ILabProfile, session: ILabSession, note?: string): Promise<PanelResult> {
  const owner = profile.userId;
  const buffer = await renderFlask(session.mix, session.temp, session.pressure);
  const files = buffer ? [{ attachment: buffer, name: "flask.png" }] : [];
  const mult = session.stepMult || 1;

  const mixLines = Object.entries(session.mix)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${itemLabel(id)} ×${qty}`);

  const need = xpNeeded(profile.labLevel);
  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("🧪 المختبر")
    .setDescription(
      [
        `**المستوى ${profile.labLevel}** \`${bar(profile.labXp, need)}\` ${profile.labXp}/${need}`,
        `🔬 رموز: **${profile.labTokens}** • ✨ سمعة: **${profile.reputation}**`,
        `🌡️ **${session.temp}°** • 💨 **${session.pressure}** • الخطوة: **${mult === 1 ? "عادية" : "سريعة ×" + mult}**`,
        "",
        `**الخليط:** ${mixLines.length ? mixLines.join("، ") : "فاضي، أضف مكونات من القوائم بالأسفل"}`,
      ].join("\n"),
    );
  if (buffer) embed.setImage("attachment://flask.png");

  const rows: Row[] = [];

  const ownedElements = ELEMENTS.filter((e) => (profile.inventory[e.id] ?? 0) > 0);
  if (ownedElements.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(SELECT_ELEMENT, owner))
          .setPlaceholder("➕ أضف عنصراً للخليط")
          .addOptions(
            ownedElements.slice(0, 25).map((e) => ({
              label: `${e.name} (متاح ${(profile.inventory[e.id] ?? 0) - (session.mix[e.id] ?? 0)})`,
              value: e.id,
              emoji: e.icon,
            })),
          ),
      ),
    );
  }

  const ownedCompounds = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0);
  if (ownedCompounds.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(SELECT_COMPOUND, owner))
          .setPlaceholder("🧬 أضف مركباً مصنّعاً للخليط")
          .addOptions(
            ownedCompounds.slice(0, 25).map((c) => ({
              label: `${c.name} (متاح ${(profile.compounds[c.id] ?? 0) - (session.mix[c.id] ?? 0)})`,
              value: c.id,
              emoji: c.icon,
            })),
          ),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(cid(TEMP_DOWN, owner)).setLabel("حرارة").setEmoji("➖").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cid(TEMP_UP, owner)).setLabel("حرارة").setEmoji("➕").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(cid(PRESSURE_DOWN, owner)).setLabel("ضغط").setEmoji("➖").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(cid(PRESSURE_UP, owner)).setLabel("ضغط").setEmoji("➕").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(cid(REACT, owner)).setLabel("تفاعل").setEmoji("⚗️").setStyle(ButtonStyle.Success),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(cid(RESET, owner)).setLabel("تصفير").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(cid(STEP_TOGGLE, owner)).setLabel(mult === 1 ? "خطوة سريعة" : "خطوة عادية").setEmoji("⚡").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(cid(BACK, owner)).setLabel("القائمة الرئيسية").setEmoji("🏠").setStyle(ButtonStyle.Secondary),
    ),
  );

  return { content: note, embeds: [embed], components: rows, files };
}

export type BackTarget = "hub" | "extra" | "lab";

export function backRow(owner: string, to: BackTarget = "hub"): ActionRowBuilder<ButtonBuilder> {
  const map: Record<BackTarget, { id: string; label: string; emoji: string }> = {
    hub: { id: BACK, label: "القائمة الرئيسية", emoji: "🏠" },
    extra: { id: OPEN_EXTRA, label: "رجوع للقائمة الإضافية", emoji: "🔙" },
    lab: { id: OPEN_LAB, label: "رجوع للمعمل", emoji: "🧪" },
  };
  const t = map[to];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(t.id, owner)).setLabel(t.label).setEmoji(t.emoji).setStyle(ButtonStyle.Secondary),
  );
}

export function buildHubPanel(profile: ILabProfile, coins: number, name: string, avatarUrl: string): PanelResult {
  const owner = profile.userId;
  const need = xpNeeded(profile.labLevel);
  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("🧪 Lab")
    .setThumbnail(avatarUrl)
    .setDescription(
      [
        `أهلاً **${name}** 👋`,
        "",
        `\`المستوى ${profile.labLevel}\``,
        `\`${profile.labXp} / ${need} XP\` ${bar(profile.labXp, need, 10)}`,
        `\`${profile.labTokens} 🔬 رمز\``,
        jenny(coins),
        "",
        "**🎓 اللقب العلمي**",
        `\`${titleFor(profile.reputation).icon} ${titleFor(profile.reputation).name}\``,
        "**📜 السمعة العلمية**",
        `\`${profile.reputation} pts\``,
        "**📘 الموسوعة**",
        `\`${profile.discovered.length} / ${COMPOUNDS.length}\``,
        "",
        "اختر إجراءً سريعاً أو افتح القائمة الإضافية",
      ].join("\n"),
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_LAB, owner)).setLabel("معمل").setEmoji("🧪").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(OPEN_SHOP, owner)).setLabel("المتجر").setEmoji("🛒").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cid(OPEN_MARKET, owner)).setLabel("بيع النواتج").setEmoji("💵").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cid(OPEN_EXTRA, owner)).setLabel("القائمة الإضافية").setEmoji("📂").setStyle(ButtonStyle.Secondary),
  );
  return sub(embed, [row]);
}

export function buildExtraPanel(owner: string): PanelResult {
  const embed = new EmbedBuilder()
    .setColor(0x64748b)
    .setTitle("📂 القائمة الإضافية")
    .setDescription(
      [
        "📦 **المستودع** — عناصرك ومركباتك",
        "📖 **المكتبة** — وصفات ما اكتشفته",
        "🎚️ **المستويات** — افتح عناصر جديدة",
        "🎯 **المهام** — مهام اليوم ومكافآتها",
        "🏅 **الإنجازات** — أهداف طويلة المدى",
        "💡 **تلميح** — اكشف جزءاً من وصفة مجهولة",
        "🤝 **تبادل** — بع مركباً للاعب آخر",
      ].join("\n"),
    );
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_WAREHOUSE, owner)).setLabel("المستودع").setEmoji("📦").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(cid(OPEN_CODEX, owner, 0)).setLabel("المكتبة").setEmoji("📖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(cid(OPEN_LEVELS, owner)).setLabel("المستويات").setEmoji("🎚️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(cid(OPEN_QUESTS, owner)).setLabel("المهام").setEmoji("🎯").setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_ACH, owner)).setLabel("الإنجازات").setEmoji("🏅").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(OPEN_HINTS, owner, 0)).setLabel("تلميح").setEmoji("💡").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cid(OPEN_TRADE_HELP, owner)).setLabel("تبادل").setEmoji("🤝").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cid(BACK, owner)).setLabel("الرئيسية").setEmoji("🏠").setStyle(ButtonStyle.Secondary),
  );
  return sub(embed, [row1, row2]);
}

/** كل العروض الفرعية تمسح صورة القارورة وتحدّث الرسالة بدون ملفات */
function sub(embed: EmbedBuilder, components: Row[], note?: string): PanelResult {
  return { content: note, embeds: [embed], components, files: [] };
}

export function buildWarehouseView(profile: ILabProfile, coins: number, note?: string): PanelResult {
  const elementLines = ELEMENTS.filter((e) => (profile.inventory[e.id] ?? 0) > 0).map(
    (e) => `${e.icon} ${e.name} ×**${profile.inventory[e.id]}**`,
  );
  const compoundLines = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0).map(
    (c) => `${c.icon} ${c.name} ×**${profile.compounds[c.id]}** — ${RARITY_INFO[c.rarity].name}`,
  );

  const embed = new EmbedBuilder()
    .setColor(0x64748b)
    .setTitle("📦 المستودع")
    .addFields(
      { name: "🧱 العناصر", value: elementLines.join("\n") || "فاضي — اشتر من المتجر 🏪" },
      { name: "🧬 المركبات المصنّعة", value: compoundLines.join("\n") || "ما صنعت شيء بعد — جرّب تفاعلاً!" },
      {
        name: "💼 الرصيد",
        value: `${jenny(coins)} • 🔬 ${profile.labTokens} رمز • ✨ ${profile.reputation} سمعة`,
      },
    );
  return sub(embed, [backRow(profile.userId, "extra")], note);
}

export function buildCodexView(profile: ILabProfile, page = 0): PanelResult {
  const owner = profile.userId;
  const last = RARITY_ORDER.length - 1;
  const p = Math.max(0, Math.min(last, page));
  const rarity = RARITY_ORDER[p];
  const items = COMPOUNDS.filter((c) => c.rarity === rarity);
  const found = items.filter((c) => profile.discovered.includes(c.id)).length;

  const lines = items.map((c) => {
    if (!profile.discovered.includes(c.id)) {
      const bought = profile.hinted?.[c.id] ?? 0;
      const clues = hintClues(c).slice(0, bought);
      return `❔ **???** — ${Object.keys(c.recipe).length} مكونات${clues.length ? `\n┗ 💡 ${clues.join(" • ")}` : ""}`;
    }
    const recipe = Object.entries(c.recipe)
      .map(([id, q]) => `${ELEMENT_MAP[id]?.name ?? COMPOUND_MAP[id]?.name ?? id}×${q}`)
      .join(" + ");
    return `${c.icon} **${c.name}**\n┗ ${recipe}\n┗ 🌡️ ${c.tempRange[0]}-${c.tempRange[1]} • 💨 ${c.pressureRange[0]}-${c.pressureRange[1]}`;
  });

  const embed = new EmbedBuilder()
    .setColor(RARITY_INFO[rarity].color)
    .setTitle(`📖 المكتبة — ${RARITY_INFO[rarity].name} (${found}/${items.length})`)
    .setDescription(
      `الإجمالي: **${profile.discovered.length}/${COMPOUNDS.length}** \`${bar(profile.discovered.length, COMPOUNDS.length)}\`\n\n${lines.join("\n\n")}`.slice(0, 4000),
    )
    .setFooter({ text: `صفحة ${p + 1} من ${RARITY_ORDER.length}` });

  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(CODEX_PAGE, owner, p - 1)).setLabel("السابق").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(cid(NOOP, owner)).setLabel(`${p + 1}/${RARITY_ORDER.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(cid(CODEX_PAGE, owner, p + 1)).setLabel("التالي").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(p === last),
  );
  return sub(embed, [nav, backRow(owner, "extra")]);
}

export async function buildMarketView(guildId: string, profile: ILabProfile, note?: string): Promise<PanelResult> {
  const owned = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0);
  const bonus = reputationBonus(profile.reputation);

  const lines: string[] = [];
  for (const c of owned) {
    const q = await getMarketQuote(guildId, c.id);
    lines.push(`${c.icon} **${c.name}** ×${profile.compounds[c.id]} — ${jenny(q.price)} ${trendIcon(q)}`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💹 سوق المركبات")
    .setDescription(
      [
        owned.length ? lines.join("\n") : "ما عندك مركبات تبيعها بعد.",
        "",
        `✨ مكافأة سمعتك على البيع: **+${Math.round(bonus * 100)}%**`,
        "📉 كل بيع ينزّل السعر شوي، والسوق يتغير كل ساعتين.",
      ].join("\n"),
    );

  const rows: Row[] = [];
  if (owned.length > 0) {
    const opts = owned.slice(0, 25).map((c) => ({ label: `${c.name} (معك ${profile.compounds[c.id]})`, value: c.id, emoji: c.icon }));
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(cid(MARKET_SELL_SELECT, profile.userId)).setPlaceholder("💰 بيع وحدة واحدة").addOptions(opts),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(cid(MARKET_SELLALL_SELECT, profile.userId)).setPlaceholder("💸 بيع كل الكمية").addOptions(opts),
      ),
    );
  }
  rows.push(backRow(profile.userId));
  return sub(embed, rows, note);
}

export function buildShopView(profile: ILabProfile, coins: number, qty = 1, note?: string): PanelResult {
  const available = ELEMENTS.filter((e) => e.tier === 1 || profile.unlockedElements.includes(e.id));
  const lines = available.map((e) => `${e.icon} **${e.name}** — ${jenny(e.price)} (معك ${profile.inventory[e.id] ?? 0})`);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("🏪 متجر المختبر")
    .setDescription(
      `${lines.join("\n")}\n\n💼 رصيدك: ${jenny(coins)}\n🛒 الكمية لكل شراء: **${qty}**\n_المتجر يبيع العناصر الأولية فقط، المركبات لازم تكتشفها بنفسك._`,
    );

  const select = new StringSelectMenuBuilder()
    .setCustomId(cid(SHOP_BUY_SELECT, profile.userId, qty))
    .setPlaceholder(`🛒 اختر عنصراً تشتريه (×${qty})`)
    .addOptions(available.map((e) => ({ label: `${e.name} — ${e.price * qty} ${CURRENCY.name}`, value: e.id, emoji: e.icon })));

  const qtyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[1, 5, 10, 25].map((n) =>
      new ButtonBuilder()
        .setCustomId(cid(SHOP_QTY, profile.userId, n))
        .setLabel(`×${n}`)
        .setStyle(n === qty ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );

  return sub(embed, [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select), qtyRow, backRow(profile.userId)], note);
}

export function buildLevelsView(profile: ILabProfile, note?: string): PanelResult {
  const locked = ELEMENTS.filter((e) => e.tier === 2 && !profile.unlockedElements.includes(e.id));
  const unlocked = ELEMENTS.filter((e) => e.tier === 2 && profile.unlockedElements.includes(e.id));
  const need = xpNeeded(profile.labLevel);

  const lines = [
    `**المستوى:** ${profile.labLevel}`,
    `\`${bar(profile.labXp, need)}\` ${profile.labXp}/${need} XP`,
    `**رموز المختبر 🔬:** ${profile.labTokens} _(تحصل رمز عند كل مستوى جديد)_`,
    "",
    unlocked.length ? `**مفتوح:** ${unlocked.map((e) => `${e.icon} ${e.name}`).join("، ")}` : "",
    locked.length
      ? `**مقفل:**\n${locked.map((e) => `${e.icon} ${e.name} — يحتاج 🔬 ${e.unlockCost}`).join("\n")}`
      : "✅ فتحت كل عناصر الدرجة الثانية!",
  ].filter((l) => l !== "");

  const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle("🎚️ المستويات والفتح").setDescription(lines.join("\n"));

  const rows: Row[] = [];
  if (locked.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(LEVELS_UNLOCK_SELECT, profile.userId))
          .setPlaceholder("🔓 اختر عنصراً تفتحه")
          .addOptions(locked.map((e) => ({ label: `${e.name} (${e.unlockCost} 🔬)`, value: e.id, emoji: e.icon }))),
      ),
    );
  }
  rows.push(backRow(profile.userId, "extra"));
  return sub(embed, rows, note);
}

export async function buildReactSuccessView(
  owner: string,
  compoundId: string,
  discoveredNow: boolean,
  level: number,
  leveledUp: boolean,
  tokensGained: number,
  gif: Buffer | null,
  extraLines: string[] = [],
): Promise<PanelResult> {
  const compound = COMPOUND_MAP[compoundId];
  const rarity = RARITY_INFO[compound.rarity];

  const lines = [
    `${compound.icon} **${compound.name}** (${rarity.name})`,
    discoveredNow ? "🆕 أول مرة تكتشفه!" : "✅ صنعته بنجاح",
    `+${compound.xp} XP${leveledUp ? `  🆙 المستوى **${level}** (+${tokensGained} 🔬)` : ""}`,
  ];
  if (compound.rarity === "legendary" && discoveredNow) {
    lines.push("", `📰 مركب نادر جداً! انشر مقالاً علمياً لرفع سمعتك (+${ARTICLE_REPUTATION} ✨).`);
  }
  if (extraLines.length) lines.push("", ...extraLines);

  let files: { attachment: Buffer; name: string }[] = [];
  let imageName: string | null = null;
  if (gif) {
    files = [{ attachment: gif, name: "react.gif" }];
    imageName = "react.gif";
  } else {
    const png = await renderResult(compoundId, rarity.color).catch(() => null);
    if (png) {
      files = [{ attachment: png, name: "result.png" }];
      imageName = "result.png";
    }
  }

  const embed = new EmbedBuilder().setColor(rarity.color).setTitle("⚗️ نجح التفاعل!").setDescription(lines.join("\n"));
  if (imageName) embed.setImage(`attachment://${imageName}`);

  const actionRow = new ActionRowBuilder<ButtonBuilder>();
  if (compound.rarity === "legendary" && discoveredNow) {
    actionRow.addComponents(
      new ButtonBuilder().setCustomId(cid(PUBLISH, owner, compoundId)).setLabel("انشر مقالاً علمياً").setEmoji("📰").setStyle(ButtonStyle.Success),
    );
  }
  actionRow.addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_LAB, owner)).setLabel("رجوع للمعمل").setEmoji("🧪").setStyle(ButtonStyle.Secondary),
  );

  return { content: undefined, embeds: [embed], components: [actionRow], files };
}

export function buildReactFailView(owner: string, gif: Buffer | null, xp: number, waste: number, extraLines: string[] = []): PanelResult {
  const lines = [
    "💨 ما طابق أي تفاعل معروف، والمكونات تبخّرت.",
    `+${xp} XP • +${waste} ☣️ نفايات كيميائية`,
    "_النفايات تدخل في وصفات خاصة، شوف المكتبة 😉_",
  ];
  if (extraLines.length) lines.push("", ...extraLines);

  const embed = new EmbedBuilder().setColor(0x64748b).setTitle("💥 فشلت التجربة").setDescription(lines.join("\n"));
  if (gif) embed.setImage("attachment://react.gif");

  return {
    content: undefined,
    embeds: [embed],
    components: [backRow(owner, "lab")],
    files: gif ? [{ attachment: gif, name: "react.gif" }] : [],
  };
}

/* ───────────── المهام / الإنجازات / التلميحات / التبادل ───────────── */

export function buildQuestsView(profile: ILabProfile): PanelResult {
  const day = todayKey();
  const sameDay = profile.questDay === day;
  const progress = sameDay ? (profile.questProgress ?? {}) : {};
  const done = sameDay ? (profile.questDone ?? []) : [];

  const lines = questsForDay(day).map((q) => {
    const isDone = done.includes(q.id);
    const cur = Math.min(progress[q.id] ?? 0, q.target);
    return `${isDone ? "✅" : "⬜"} ${q.icon} **${q.title}**\n┗ \`${bar(cur, q.target, 8)}\` ${cur}/${q.target} • ${jenny(q.coins)} • ${q.xp} XP`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle("🎯 مهام المختبر اليومية")
    .setDescription(`⏰ تتجدد <t:${nextResetUnix()}:R>\n\n${lines.join("\n\n")}`);
  return sub(embed, [backRow(profile.userId, "extra")]);
}

export function buildAchievementsView(profile: ILabProfile): PanelResult {
  const have = profile.achievements ?? [];
  const lines = ACHIEVEMENTS.map((a) => {
    const ok = have.includes(a.id);
    const bits = [
      a.reward.coins ? jenny(a.reward.coins) : "",
      a.reward.tokens ? `${a.reward.tokens} 🔬` : "",
      a.reward.reputation ? `${a.reward.reputation} ✨` : "",
    ].filter(Boolean);
    return `${ok ? "✅" : "🔒"} ${a.icon} **${a.title}** — ${a.desc}\n┗ ${bits.join(" • ")}`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle(`🏅 الإنجازات (${have.length}/${ACHIEVEMENTS.length})`)
    .setDescription(lines.join("\n").slice(0, 4000));
  return sub(embed, [backRow(profile.userId, "extra")]);
}

export function buildHintsView(profile: ILabProfile, coins: number, page = 0, note?: string): PanelResult {
  const owner = profile.userId;
  const last = RARITY_ORDER.length - 1;
  const p = Math.max(0, Math.min(last, page));
  const rarity = RARITY_ORDER[p];
  const price = HINT_PRICE[rarity];

  const items = COMPOUNDS.filter((c) => c.rarity === rarity);
  const open = items
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !profile.discovered.includes(c.id));

  const lines = open.map(({ c, i }) => {
    const total = hintClues(c).length;
    const bought = profile.hinted?.[c.id] ?? 0;
    return `❔ مركب #${i + 1} — 💡 ${bought}/${total} تلميحات`;
  });

  const embed = new EmbedBuilder()
    .setColor(RARITY_INFO[rarity].color)
    .setTitle(`💡 التلميحات — ${RARITY_INFO[rarity].name}`)
    .setDescription(
      [
        `سعر التلميح: ${jenny(price)} • رصيدك: ${jenny(coins)}`,
        "كل تلميح يكشف مكوّناً من الوصفة، ثم الحرارة، ثم الضغط. التلميحات تظهر لك في المكتبة.",
        "",
        lines.length ? lines.join("\n") : "✅ اكتشفت كل مركبات هذي الفئة!",
      ].join("\n"),
    )
    .setFooter({ text: `صفحة ${p + 1} من ${RARITY_ORDER.length}` });

  const rows: Row[] = [];
  const buyable = open.filter(({ c }) => (profile.hinted?.[c.id] ?? 0) < hintClues(c).length);
  if (buyable.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(HINT_BUY_SELECT, owner, p))
          .setPlaceholder(`💡 اشتر تلميحاً (${price} ${CURRENCY.name})`)
          .addOptions(
            buyable.slice(0, 25).map(({ c, i }) => ({
              label: `مركب #${i + 1} (${profile.hinted?.[c.id] ?? 0}/${hintClues(c).length})`,
              value: c.id,
              emoji: "💡",
            })),
          ),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(cid(HINT_PAGE, owner, p - 1)).setLabel("السابق").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(p === 0),
      new ButtonBuilder().setCustomId(cid(NOOP, owner)).setLabel(`${p + 1}/${RARITY_ORDER.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId(cid(HINT_PAGE, owner, p + 1)).setLabel("التالي").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(p === last),
    ),
    backRow(owner, "extra"),
  );
  return sub(embed, rows, note);
}

export function buildTradeHelpView(owner: string): PanelResult {
  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("🤝 تبادل المركبات")
    .setDescription(
      [
        "بع مركباً من مستودعك للاعب آخر بالسعر اللي تحدده.",
        "",
        "اكتب بالشات (بدون سلاش):",
        "`عرض @الشخص السعر`",
        "`عرض @الشخص السعر الكمية`",
        "",
        "مثال: `عرض @ماجد 500` أو `عرض @ماجد 1200 3`",
        "",
        "بعدها تختار المركب من قائمة، ويصله عرض فيه زر قبول/رفض (ينتهي بعد 10 دقائق).",
        "المركب المشترى يقدر يستخدمه بالتفاعلات أو يبيعه بالسوق.",
      ].join("\n"),
    );
  return sub(embed, [backRow(owner, "extra")]);
}

/** بطاقة مختبر لاعب (أمر: lab @شخص) */
export function buildLabCard(profile: ILabProfile, name: string, avatarUrl: string): PanelResult {
  const title = titleFor(profile.reputation);
  const best = COMPOUNDS.filter((c) => profile.discovered.includes(c.id))
    .sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.basePrice - a.basePrice)
    .slice(0, 5)
    .map((c) => `${c.icon} ${c.name} _(${RARITY_INFO[c.rarity].name})_`);

  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle(`🧪 مختبر ${name}`)
    .setThumbnail(avatarUrl)
    .setDescription(
      [
        `${title.icon} **${title.name}**${title.next ? ` _(التالي: ${title.next.name} عند ${title.next.min} ✨)_` : ""}`,
        `المستوى **${profile.labLevel}** • ✨ **${profile.reputation}** سمعة`,
        `📘 الموسوعة: **${profile.discovered.length}/${COMPOUNDS.length}** \`${bar(profile.discovered.length, COMPOUNDS.length, 10)}\``,
        `🏅 الإنجازات: **${(profile.achievements ?? []).length}/${ACHIEVEMENTS.length}**`,
        `⚗️ مركبات مصنّعة: **${profile.stats?.crafts ?? 0}** • 📰 مقالات: **${(profile.published ?? []).length}**`,
      ].join("\n"),
    )
    .addFields({ name: "🌟 أندر اكتشافاته", value: best.join("\n") || "ما اكتشف شيئاً بعد" });
  return { content: undefined, embeds: [embed], components: [], files: [] };
}

export function buildArticleEmbed(userId: string, compoundId: string, reputationGained: number, total: number): EmbedBuilder {
  const compound = COMPOUND_MAP[compoundId];
  return new EmbedBuilder()
    .setColor(RARITY_INFO.legendary.color)
    .setTitle(`📰 اكتشاف علمي: ${compound.icon} ${compound.name}`)
    .setDescription(
      [
        `أعلن العالِم <@${userId}> عن تصنيع **${compound.name}**، أحد أندر المركبات المعروفة!`,
        "",
        `✨ سمعته ارتفعت **+${reputationGained}** (المجموع: ${total})`,
      ].join("\n"),
    );
}



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
import { CATEGORIES, categoryProgress } from "./categories";
import { ELEMENT_MAP, ELEMENTS } from "./elements";
import { ENGRAMS, KIND_LABEL, engramName, engramState, type EngramKind } from "./engrams";
import { COMPOUND_INFO, ELEMENT_INFO, REALISM_LABEL } from "./info";
import {
  CONSUMABLES,
  DEVICES,
  GEAR,
  MAX_LEVEL,
  ROBOT_MINUTES_PER_UNIT,
  consumableCount,
  robotBatch,
  robotEligible,
  robotState,
  isDevice,
  UPGRADE_COST,
  currentRadiation,
  doneOrders,
  expeditionState,
  hasGear,
  level as equipLevel,
  ordersForDay,
  sickMinutesLeft,
  tolerance,
  EXPEDITION_HOURS,
} from "./workshop";
import {
  BACK,
  CENTRIFUGE_RUN,
  ENGRAM_TAB,
  MARKET_PAGE,
  OPEN_ROBOT,
  PAGE_CYCLE,
  ROBOT_COLLECT,
  ROBOT_START,
  USE_ANTIRAD,
  CODEX_PAGE,
  HINT_BUY_SELECT,
  HINT_PAGE,
  NOOP,
  OPEN_ACH,
  OPEN_HINTS,
  OPEN_QUESTS,
  OPEN_TRADE_HELP,
  OPEN_EQUIP,
  EQUIP_BUY_SELECT,
  OPEN_ORDERS,
  ORDER_DELIVER_SELECT,
  OPEN_EXPED,
  EXPED_START,
  EXPED_COLLECT,
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

const PAGE_SIZE = 25;

function pageSlice<T>(items: T[], page: number): T[] {
  return items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

/** يقسّم أسطراً طويلة لحقول embed (الحد 1024 حرف للحقل) */
function chunkLines(lines: string[], max = 1000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const l of lines) {
    if (cur && cur.length + l.length + 1 > max) {
      out.push(cur);
      cur = "";
    }
    cur += (cur ? "\n" : "") + l;
  }
  if (cur) out.push(cur);
  return out;
}

/** حالة الإشعاع والإصابة تظهر بالمعمل لما تكون موجودة */
function statusLine(profile: ILabProfile): string {
  const sick = sickMinutesLeft(profile);
  if (sick > 0) return `🤒 مصاب بالإشعاع — المختبر معطّل **${sick}** دقيقة`;
  const rad = currentRadiation(profile);
  if (rad <= 0) return "";
  if (!hasGear(profile, "geiger")) return "☢️ فيك إشعاع (اشترِ عدّاد جايغر 📟 لقياسه)";
  return `☢️ الإشعاع: **${rad}/100** ${hasGear(profile, "hazmat") ? "(محمي بالبدلة)" : ""}`.trim();
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
        `🔬 نقاط الفتح: **${profile.labTokens}** • ✨ سمعة: **${profile.reputation}**`,
        `🌡️ **${session.temp}°** • 💨 **${session.pressure}** • الخطوة: **${mult === 1 ? "عادية" : "سريعة ×" + mult}**`,
        statusLine(profile),
        "",
        `**الخليط:** ${mixLines.length ? mixLines.join("، ") : "فاضي، أضف مكونات من القوائم بالأسفل"}`,
      ].join("\n"),
    );
  if (buffer) embed.setImage("attachment://flask.png");

  const rows: Row[] = [];

  const allElements = ELEMENTS.filter((e) => (profile.inventory[e.id] ?? 0) > 0);
  const allCompounds = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0);
  const pages = Math.max(1, Math.ceil(allElements.length / PAGE_SIZE), Math.ceil(allCompounds.length / PAGE_SIZE));
  const page = Math.min(Math.max(0, session.page ?? 0), pages - 1);
  const ownedElements = pageSlice(allElements, page);
  if (ownedElements.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(SELECT_ELEMENT, owner))
          .setPlaceholder("➕ أضف عنصراً للخليط")
          .addOptions(
            ownedElements.map((e) => ({
              label: `${e.name} (متاح ${(profile.inventory[e.id] ?? 0) - (session.mix[e.id] ?? 0)})`,
              value: e.id,
              emoji: e.icon,
            })),
          ),
      ),
    );
  }

  const ownedCompounds = pageSlice(allCompounds, page);
  if (ownedCompounds.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(SELECT_COMPOUND, owner))
          .setPlaceholder("🧬 أضف مركباً مصنّعاً للخليط")
          .addOptions(
            ownedCompounds.map((c) => ({
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
      ...(pages > 1
        ? [new ButtonBuilder().setCustomId(cid(PAGE_CYCLE, owner)).setLabel(`صفحة ${page + 1}/${pages}`).setEmoji("📑").setStyle(ButtonStyle.Secondary)]
        : []),
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
        `\`${profile.labTokens} 🔬 نقطة فتح\``,
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
        "🏅 **الإنجازات** — أهداف طويلة المدى",
        "💡 **تلميح** — اكشف جزءاً من وصفة مجهولة",
        "🛠️ **الأجهزة** — طوّر الفرن والمضخة واشترِ معدات السلامة",
        "📋 **الطلبات** — طلبات العملاء اليومية بمكافآت أعلى",
        "🧭 **الاستكشاف** — أرسل مساعداً يجيب لك عناصر",
      ].join("\n"),
    );
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_ACH, owner)).setLabel("الإنجازات").setEmoji("🏅").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(OPEN_HINTS, owner, 0)).setLabel("تلميح").setEmoji("💡").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cid(BACK, owner)).setLabel("الرئيسية").setEmoji("🏠").setStyle(ButtonStyle.Secondary),
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_EQUIP, owner)).setLabel("الأجهزة").setEmoji("🛠️").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(OPEN_ORDERS, owner)).setLabel("الطلبات").setEmoji("📋").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(OPEN_EXPED, owner)).setLabel("الاستكشاف").setEmoji("🧭").setStyle(ButtonStyle.Primary),
  );
  return sub(embed, [row1, row2, row3]);
}

/** كل العروض الفرعية تمسح صورة القارورة وتحدّث الرسالة بدون ملفات */
function sub(embed: EmbedBuilder, components: Row[], note?: string): PanelResult {
  return { content: note, embeds: [embed], components, files: [] };
}

const STOCK_PER_PAGE = 8;

/** المخزون ($LS): تبويب للعناصر وتبويب للمركبات، وأسهم للتنقل بين الصفحات */
export function buildWarehouseView(profile: ILabProfile, coins: number, note?: string, tab: "e" | "c" = "e", page = 0): PanelResult {
  const owner = profile.userId;
  const isEl = tab === "e";
  const lines = isEl
    ? ELEMENTS.filter((e) => (profile.inventory[e.id] ?? 0) > 0).map(
        (e) => `${e.icon} **${e.name}**${ELEMENT_INFO[e.id] ? ` \`${ELEMENT_INFO[e.id].symbol}\`` : ""} — ×**${profile.inventory[e.id]}**`,
      )
    : COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0).map(
        (c) => `${c.icon} **${c.name}** — ×**${profile.compounds[c.id]}** _(${RARITY_INFO[c.rarity].name})_`,
      );
  const pages = Math.max(1, Math.ceil(lines.length / STOCK_PER_PAGE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const shown = lines.slice(p * STOCK_PER_PAGE, (p + 1) * STOCK_PER_PAGE);

  const embed = new EmbedBuilder()
    .setColor(isEl ? 0x38bdf8 : 0xa855f7)
    .setTitle(`📦 المخزون — ${isEl ? "🧱 العناصر" : "🧬 المركبات"}`)
    .setDescription(
      [
        shown.length ? shown.join("\n") : isEl ? "ما عندك عناصر — اشترِ من المتجر 🏪" : "ما صنعت شيء بعد — جرّب تفاعلاً!",
      ].join("\n"),
    )
    .setFooter({ text: `صفحة ${p + 1} من ${pages} • ${lines.length} صنف` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(OPEN_WAREHOUSE, owner, "e:0")).setLabel("العناصر").setEmoji("🧱").setStyle(isEl ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(cid(OPEN_WAREHOUSE, owner, "c:0")).setLabel("المركبات").setEmoji("🧬").setStyle(isEl ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(cid(OPEN_WAREHOUSE, owner, `${tab}:${p - 1}`)).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(cid(OPEN_WAREHOUSE, owner, `${tab}:${p + 1}`)).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(p >= pages - 1),
  );
  return sub(embed, [row], note);
}

const CODEX_PER_PAGE = 7;

/** صفحات المكتبة: كل ندرة تُقسم لصفحات صغيرة (7 مركبات) عشان ما تتجاوز حد الرسالة */
function codexPages(): { rarity: Rarity; items: typeof COMPOUNDS }[] {
  const pages: { rarity: Rarity; items: typeof COMPOUNDS }[] = [];
  for (const rarity of RARITY_ORDER) {
    const items = COMPOUNDS.filter((c) => c.rarity === rarity);
    for (let i = 0; i < items.length; i += CODEX_PER_PAGE) pages.push({ rarity, items: items.slice(i, i + CODEX_PER_PAGE) });
  }
  return pages;
}

export function buildCodexView(profile: ILabProfile, page = 0): PanelResult {
  const owner = profile.userId;
  const all = codexPages();
  const last = all.length - 1;
  const p = Math.max(0, Math.min(last, page));
  const { rarity, items } = all[p];
  const total = COMPOUNDS.filter((c) => c.rarity === rarity);
  const found = total.filter((c) => profile.discovered.includes(c.id)).length;

  const lines = items.map((c) => {
    const tags = `${c.byproduct ? " 🧪ناتج جانبي" : ""}${c.engram ? ` 🔐${engramName(c.engram)}` : ""}`;
    if (!profile.discovered.includes(c.id)) {
      const bought = profile.hinted?.[c.id] ?? 0;
      const clues = hintClues(c).slice(0, bought);
      return `❔ **???** — ${Object.keys(c.recipe).length} مكونات${tags}${clues.length ? `\n┗ 💡 ${clues.join(" • ")}` : ""}`;
    }
    const recipe = Object.entries(c.recipe)
      .map(([id, q]) => `${ELEMENT_MAP[id]?.name ?? COMPOUND_MAP[id]?.name ?? id}×${q}`)
      .join(" + ");
    const info = COMPOUND_INFO[c.id];
    const infoLine = info ? `\n┗ 🧬 ${info.formula !== "—" ? `\`${info.formula}\` • ` : ""}${info.type} • ${REALISM_LABEL[info.real]}` : "";
    return `${c.icon} **${c.name}**${tags}\n┗ ${recipe}\n┗ 🌡️ ${c.tempRange[0]}-${c.tempRange[1]} • 💨 ${c.pressureRange[0]}-${c.pressureRange[1]}${infoLine}`;
  });

  const embed = new EmbedBuilder()
    .setColor(RARITY_INFO[rarity].color)
    .setTitle(`📖 المكتبة — ${RARITY_INFO[rarity].name} (${found}/${total.length})`)
    .setDescription(
      `الإجمالي: **${profile.discovered.length}/${COMPOUNDS.length}** \`${bar(profile.discovered.length, COMPOUNDS.length)}\`\n\n${lines.join("\n\n")}`.slice(0, 4000),
    )
    .setFooter({ text: `صفحة ${p + 1} من ${all.length}` });

  const nav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(CODEX_PAGE, owner, p - 1)).setLabel("السابق").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(p === 0),
    new ButtonBuilder().setCustomId(cid(NOOP, owner)).setLabel(`${p + 1}/${all.length}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(cid(CODEX_PAGE, owner, p + 1)).setLabel("التالي").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(p === last),
  );
  return sub(embed, [nav]);
}

export async function buildMarketView(guildId: string, profile: ILabProfile, note?: string, page = 0): Promise<PanelResult> {
  const allOwned = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0);
  const pages = Math.max(1, Math.ceil(allOwned.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, page), pages - 1);
  const owned = pageSlice(allOwned, p);
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
        ...(pages > 1 ? [`📑 صفحة ${p + 1}/${pages}`] : []),
      ].join("\n"),
    );

  const rows: Row[] = [];
  if (owned.length > 0) {
    const opts = owned.map((c) => ({ label: `${c.name} (معك ${profile.compounds[c.id]})`, value: c.id, emoji: c.icon }));
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(cid(MARKET_SELL_SELECT, profile.userId, p)).setPlaceholder("💰 بيع وحدة واحدة").addOptions(opts),
      ),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(cid(MARKET_SELLALL_SELECT, profile.userId, p)).setPlaceholder("💸 بيع كل الكمية").addOptions(opts),
      ),
    );
  }
  if (pages > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(cid(MARKET_PAGE, profile.userId, p - 1)).setLabel("السابق").setEmoji("◀️").setStyle(ButtonStyle.Primary).setDisabled(p === 0),
        new ButtonBuilder().setCustomId(cid(MARKET_PAGE, profile.userId, p + 1)).setLabel("التالي").setEmoji("▶️").setStyle(ButtonStyle.Primary).setDisabled(p >= pages - 1),
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

  const selects: Row[] = [];
  for (let i = 0; i < available.length; i += PAGE_SIZE) {
    const part = available.slice(i, i + PAGE_SIZE);
    selects.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(SHOP_BUY_SELECT, profile.userId, qty) + (i > 0 ? `|${i}` : ""))
          .setPlaceholder(`🛒 اختر عنصراً تشتريه (×${qty})${available.length > PAGE_SIZE ? ` — ${i / PAGE_SIZE + 1}` : ""}`)
          .addOptions(part.map((e) => ({ label: `${e.name} — ${e.price * qty} ${CURRENCY.name}`, value: e.id, emoji: e.icon }))),
      ),
    );
  }

  const qtyRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...[1, 5, 10, 25].map((n) =>
      new ButtonBuilder()
        .setCustomId(cid(SHOP_QTY, profile.userId, n))
        .setLabel(`×${n}`)
        .setStyle(n === qty ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );

  return sub(embed, [...selects, qtyRow, backRow(profile.userId)], note);
}

const STATE_ICON = { unlocked: "✅", ready: "🔓", need_points: "💰", need_level: "🔒", need_prereq: "⛓️" } as const;

export function buildLevelsView(profile: ILabProfile, note?: string, tab: EngramKind = "element"): PanelResult {
  const owner = profile.userId;
  const need = xpNeeded(profile.labLevel);
  const list = ENGRAMS.filter((e) => e.kind === tab);
  const open = list.filter((e) => engramState(profile, e) === "unlocked").length;

  const lines = list.map((e) => {
    const st = engramState(profile, e);
    let tail = "";
    if (st === "need_level") tail = `يحتاج مستوى ${e.level}`;
    else if (st === "need_prereq") tail = `يتطلب: ${e.requires.filter((r) => !list.concat(ENGRAMS).some((x) => x.id === r && engramState(profile, x) === "unlocked")).map(engramName).join("، ")}`;
    else if (st === "need_points") tail = `يحتاج ${e.cost} نقاط`;
    else if (st === "ready") tail = `جاهز للفتح (${e.cost} 🔬)`;
    else tail = "مفتوح";
    return `${STATE_ICON[st]} ${e.icon} **${e.name}** — ${tail}${tab !== "element" ? `\n┗ ${e.desc}` : ""}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(`🎚️ شجرة الفتح — ${KIND_LABEL[tab].icon} ${KIND_LABEL[tab].name} (${open}/${list.length})`)
    .setDescription(
      [
        `**المستوى ${profile.labLevel}** \`${bar(profile.labXp, need)}\` ${profile.labXp}/${need} XP`,
        `**🔬 نقاط الفتح:** ${profile.labTokens}`,
        "_كل مستوى جديد يعطيك نقاط (1 حتى مستوى 9، 2 حتى 19، 3 بعدها) تصرفها على فتح عناصر وأجهزة وتقنيات._",
        "✅ مفتوح • 🔓 جاهز • 💰 نقاط ناقصة • 🔒 مستوى ناقص • ⛓️ يحتاج متطلبات",
        "",
        lines.join("\n"),
      ].join("\n").slice(0, 4000),
    );

  const tabs = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...(Object.keys(KIND_LABEL) as EngramKind[]).map((k) =>
      new ButtonBuilder()
        .setCustomId(cid(ENGRAM_TAB, owner, k))
        .setLabel(KIND_LABEL[k].name)
        .setEmoji(KIND_LABEL[k].icon)
        .setStyle(k === tab ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  );

  const rows: Row[] = [tabs];
  const ready = list.filter((e) => engramState(profile, e) === "ready");
  if (ready.length > 0) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(cid(LEVELS_UNLOCK_SELECT, owner, tab))
          .setPlaceholder("🔓 اختر ما تفتحه")
          .addOptions(ready.slice(0, 25).map((e) => ({ label: `${e.name} (${e.cost} 🔬)`, value: e.id, emoji: e.icon }))),
      ),
    );
  }
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
  const info = COMPOUND_INFO[compoundId];
  if (info) {
    lines.push(
      "",
      `🧬 ${info.formula !== "—" ? `**${info.formula}** • ` : ""}${info.type} • ${REALISM_LABEL[info.real]}`,
      `📚 ${info.fact}`,
    );
  }
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

export function buildAccidentView(owner: string, gif: Buffer | null, compoundId: string, xp: number, waste: number, extraLines: string[] = []): PanelResult {
  const c = COMPOUND_MAP[compoundId];
  const lines = [
    `💥 انفجر الخليط أثناء تحضير **${c?.name ?? "المركب"}**! الظروف صحيحة لكن التفاعل خطير.`,
    `+${xp} XP • +${waste} ☣️ نفايات`,
    "_معدات السلامة (نظارات، قفازات، بدلة) تقلل احتمال الحوادث. شوف **الأجهزة**._",
  ];
  if (extraLines.length) lines.push("", ...extraLines);
  const embed = new EmbedBuilder().setColor(0xef4444).setTitle("🚨 حادث مختبر").setDescription(lines.join("\n"));
  if (gif) embed.setImage("attachment://react.gif");
  return {
    content: undefined,
    embeds: [embed],
    components: [backRow(owner, "lab")],
    files: gif ? [{ attachment: gif, name: "react.gif" }] : [],
  };
}

/* ───────────── الأجهزة / الطلبات / الاستكشاف ───────────── */

const unixIn = (ms: number) => Math.floor(ms / 1000);

export function buildEquipView(profile: ILabProfile, coins: number, note?: string): PanelResult {
  const owner = profile.userId;
  const f = equipLevel(profile, "furnace");
  const p = equipLevel(profile, "pump");
  const tol = tolerance(profile);
  const upCost = (lv: number) => (lv >= MAX_LEVEL ? "أعلى مستوى" : jenny(UPGRADE_COST[lv - 1]));

  const gearLines = (Object.keys(GEAR) as (keyof typeof GEAR)[]).map((k) => {
    const g = GEAR[k];
    return `${g.icon} **${g.name}** — ${hasGear(profile, k) ? "✅ مملوكة" : jenny(g.price)}\n┗ ${g.desc}`;
  });
  const deviceKeys = Object.keys(DEVICES).filter((k) => k !== "robot") as (keyof typeof DEVICES)[];
  const deviceLines = deviceKeys.map((k) => {
    const d = DEVICES[k];
    const owned = hasGear(profile, k);
    const unlocked = ENGRAMS.some((e) => e.id === k && engramState(profile, e) === "unlocked");
    return `${d.icon} **${d.name}** — ${owned ? "✅ مملوك" : unlocked ? jenny(d.price) : "🔒 افتحه من شجرة الفتح"}\n┗ ${d.desc}`;
  });
  const robotLv = profile.equipment?.robot ?? 0;
  const robotLine = `🤖 **الروبوت الآلي** — ${robotLv > 0 ? `✅ مستوى ${robotLv}/${MAX_LEVEL} (ترقية: ${upCost(robotLv)})` : ENGRAMS.some((e) => e.id === "robot" && engramState(profile, e) === "unlocked") ? jenny(DEVICES.robot.price) : "🔒 افتحه من شجرة الفتح"}\n┗ ${DEVICES.robot.desc}`;
  const consLines = Object.entries(CONSUMABLES).map(([k, c]) => `${c.icon} **${c.name}** (معك ${consumableCount(profile, k)}) — ${jenny(c.price)}\n┗ ${c.desc}`);

  const embed = new EmbedBuilder()
    .setColor(0x64748b)
    .setTitle("🛠️ الأجهزة ومعدات السلامة")
    .setDescription(
      [
        `🔥 **الفرن** مستوى **${f}/${MAX_LEVEL}** — يوسّع هامش الحرارة ±${tol.temp}°\n┗ الترقية: ${upCost(f)}`,
        `💨 **مضخة الضغط** مستوى **${p}/${MAX_LEVEL}** — ${tol.pressure > 0 ? `يوسّع هامش الضغط ±${tol.pressure}` : "تبدأ تفيد من المستوى 3"}\n┗ الترقية: ${upCost(p)}`,
        "",
        "**🦺 معدات السلامة**",
        ...gearLines,
        "",
        "**🧰 أجهزة متقدمة** _(تحتاج فتح من شجرة الفتح أول)_",
        ...deviceLines,
        robotLine,
        "",
        "**🧪 مستهلكات**",
        ...consLines,
        "",
        "_التفاعلات الخطرة (مثل وقود الصواريخ والثيرمايت) قد تنفجر. المواد المشعة تتطلب بدلة الحماية._",
        `💼 رصيدك: ${jenny(coins)}`,
      ].join("\n").slice(0, 4000),
    );

  const options: { label: string; value: string; emoji: string; description: string }[] = [];
  if (f < MAX_LEVEL) options.push({ label: `ترقية الفرن → ${f + 1}`, value: "furnace", emoji: "🔥", description: `${UPGRADE_COST[f - 1]} ${CURRENCY.name}` });
  if (p < MAX_LEVEL) options.push({ label: `ترقية المضخة → ${p + 1}`, value: "pump", emoji: "💨", description: `${UPGRADE_COST[p - 1]} ${CURRENCY.name}` });
  for (const k of Object.keys(GEAR) as (keyof typeof GEAR)[]) {
    if (!hasGear(profile, k)) options.push({ label: GEAR[k].name, value: k, emoji: GEAR[k].icon, description: `${GEAR[k].price} ${CURRENCY.name}` });
  }
  for (const k of deviceKeys) {
    if (!hasGear(profile, k) && ENGRAMS.some((e) => e.id === k && engramState(profile, e) === "unlocked")) {
      options.push({ label: DEVICES[k].name, value: k, emoji: DEVICES[k].icon, description: `${DEVICES[k].price} ${CURRENCY.name}` });
    }
  }
  const robotUnlocked = ENGRAMS.some((e) => e.id === "robot" && engramState(profile, e) === "unlocked");
  if (robotLv === 0 && robotUnlocked) options.push({ label: "الروبوت الآلي", value: "robot", emoji: "🤖", description: `${DEVICES.robot.price} ${CURRENCY.name}` });
  if (robotLv > 0 && robotLv < MAX_LEVEL) options.push({ label: `ترقية الروبوت → ${robotLv + 1}`, value: "robot", emoji: "🤖", description: `${UPGRADE_COST[robotLv - 1]} ${CURRENCY.name}` });

  const rows: Row[] = [];
  if (options.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(cid(EQUIP_BUY_SELECT, owner)).setPlaceholder("🛒 اشترِ أو طوّر").addOptions(options.slice(0, 25)),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(cid(EQUIP_BUY_SELECT, owner, "c"))
        .setPlaceholder("🧪 اشترِ مستهلكاً")
        .addOptions(Object.entries(CONSUMABLES).map(([k, c]) => ({ label: c.name, value: `c_${k}`, emoji: c.icon, description: `${c.price} ${CURRENCY.name}` }))),
    ),
  );

  const actions = new ActionRowBuilder<ButtonBuilder>();
  if (hasGear(profile, "centrifuge")) {
    actions.addComponents(
      new ButtonBuilder()
        .setCustomId(cid(CENTRIFUGE_RUN, owner))
        .setLabel(`طرد مركزي (نفايات: ${profile.inventory?.waste ?? 0})`)
        .setEmoji("🌀")
        .setStyle(ButtonStyle.Primary),
    );
  }
  if (robotLv > 0) {
    actions.addComponents(new ButtonBuilder().setCustomId(cid(OPEN_ROBOT, owner)).setLabel("الروبوت").setEmoji("🤖").setStyle(ButtonStyle.Primary));
  }
  if (consumableCount(profile, "antirad") > 0) {
    actions.addComponents(new ButtonBuilder().setCustomId(cid(USE_ANTIRAD, owner)).setLabel("استخدم مضاد إشعاع").setEmoji("💊").setStyle(ButtonStyle.Danger));
  }
  if (actions.components.length > 0) rows.push(actions);
  rows.push(backRow(owner, "extra"));
  return sub(embed, rows, note);
}

export function buildRobotView(profile: ILabProfile, note?: string): PanelResult {
  const owner = profile.userId;
  const st = robotState(profile);
  const batch = robotBatch(profile);
  const lines = [
    `🤖 الروبوت مستوى **${profile.equipment?.robot ?? 1}** — يصنّع حتى **${batch}** وحدات بالدفعة (${ROBOT_MINUTES_PER_UNIT} دقيقة للوحدة).`,
    "يصنّع مركبات **اكتشفتها** بنفسك (مو مشعة ولا نادرة جداً)، ويخصم المكونات من مستودعك أول ما تبدأ، وخبرته نص خبرتك.",
    "",
  ];
  const rows: Row[] = [];
  if (st.status === "running") {
    const c = COMPOUND_MAP[st.compoundId];
    lines.push(`⚙️ يصنّع ${c?.icon ?? ""} **${c?.name ?? st.compoundId}** ×${st.qty} — ينتهي <t:${unixIn(st.endsAt)}:R>`);
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(cid(OPEN_ROBOT, owner)).setLabel("تحديث").setEmoji("🔄").setStyle(ButtonStyle.Secondary)),
    );
  } else if (st.status === "ready") {
    const c = COMPOUND_MAP[st.compoundId];
    lines.push(`✅ جهّز ${c?.icon ?? ""} **${c?.name ?? st.compoundId}** ×${st.qty}!`);
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(cid(ROBOT_COLLECT, owner)).setLabel("استلام").setEmoji("🎁").setStyle(ButtonStyle.Success)),
    );
  } else {
    const eligible = robotEligible(profile);
    lines.push(eligible.length ? "اختر مركباً يصنّعه لك:" : "ما اكتشفت مركبات مناسبة بعد. اصنع بنفسك أول مرة!");
    if (eligible.length) {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(cid(ROBOT_START, owner))
            .setPlaceholder("🤖 اختر المركب")
            .addOptions(eligible.slice(0, 25).map((c) => ({ label: c.name, value: c.id, emoji: c.icon, description: RARITY_INFO[c.rarity].name }))),
        ),
      );
    }
  }
  const embed = new EmbedBuilder().setColor(0x0ea5e9).setTitle("🤖 الروبوت الآلي").setDescription(lines.join("\n"));
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(cid(OPEN_EQUIP, owner)).setLabel("الأجهزة").setEmoji("🛠️").setStyle(ButtonStyle.Secondary)),
  );
  return sub(embed, rows, note);
}

export function buildOrdersView(profile: ILabProfile, note?: string): PanelResult {
  const day = todayKey();
  const orders = ordersForDay(day, profile.userId);
  const done = doneOrders(profile, day);

  const lines = orders.map((o) => {
    const c = COMPOUND_MAP[o.compoundId];
    const have = profile.compounds[o.compoundId] ?? 0;
    const status = done.includes(o.compoundId) ? "✅ تم التسليم" : `معك ${have}/${o.qty}`;
    return `${c.icon} **${c.name}** ×${o.qty}\n┗ ${jenny(o.coins)} • +${o.xp} XP • ${status}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("📋 طلبات العملاء")
    .setDescription(
      [
        "عملاء اليوم يطلبون مركبات بسعر أعلى من السوق بنحو 40%.",
        "",
        ...lines,
        "",
        `🔄 تتجدد <t:${nextResetUnix()}:R>`,
      ].join("\n"),
    );

  const options = orders
    .filter((o) => !done.includes(o.compoundId))
    .map((o) => {
      const c = COMPOUND_MAP[o.compoundId];
      return { label: `سلّم ${c.name} ×${o.qty}`, value: o.compoundId, emoji: c.icon, description: `${o.coins} ${CURRENCY.name}` };
    });

  const rows: Row[] = [];
  if (options.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(cid(ORDER_DELIVER_SELECT, profile.userId)).setPlaceholder("📦 سلّم طلباً").addOptions(options),
      ),
    );
  }
  rows.push(backRow(profile.userId, "extra"));
  return sub(embed, rows, note);
}

export function buildExpeditionView(profile: ILabProfile, note?: string): PanelResult {
  const owner = profile.userId;
  const st = expeditionState(profile);

  const lines: string[] = [
    "أرسل مساعداً يجمع لك عناصر أولية. ما تحتاج تبقى متصل، تعال واستلمها لما ينتهي الوقت.",
    "",
    "• **ساعة**: عنصران عشوائيان + 50 Jenny",
    "• **ساعتان**: 4 عناصر + 100 Jenny، وفرصة نادرة لإيجاد **يورانيوم ☢️** من مستوى 8، و**راديوم/بلوتونيوم** لو فتحت الكيمياء النووية (مستوى 12 و16)",
  ];
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (st.status === "running") {
    lines.push("", `🧭 المساعد في رحلة (${st.hours} ساعة) — يرجع <t:${unixIn(st.endsAt)}:R>`);
    row.addComponents(new ButtonBuilder().setCustomId(cid(OPEN_EXPED, owner)).setLabel("تحديث").setEmoji("🔄").setStyle(ButtonStyle.Secondary));
  } else if (st.status === "ready") {
    lines.push("", "✅ رجع المساعد! استلم غنائمك.");
    row.addComponents(new ButtonBuilder().setCustomId(cid(EXPED_COLLECT, owner)).setLabel("استلام الغنائم").setEmoji("🎁").setStyle(ButtonStyle.Success));
  } else {
    for (const h of EXPEDITION_HOURS) {
      row.addComponents(
        new ButtonBuilder().setCustomId(cid(EXPED_START, owner, h)).setLabel(h === 1 ? "رحلة ساعة" : "رحلة ساعتين").setEmoji("🧭").setStyle(h === 1 ? ButtonStyle.Primary : ButtonStyle.Success),
      );
    }
  }

  const embed = new EmbedBuilder().setColor(0x0ea5e9).setTitle("🧭 رحلات الاستكشاف").setDescription(lines.join("\n"));
  return sub(embed, [row, backRow(owner, "extra")], note);
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
    .setDescription(lines.join("\n").slice(0, 4000))
    .addFields({
      name: "🗂️ تصنيفات المركبات (أكملها لمكافأة)",
      value: CATEGORIES.map((c) => `${c.icon} ${c.name}: **${categoryProgress(c, profile.discovered)}/${c.members.length}**`).join("\n"),
    });
  return sub(embed, [backRow(profile.userId, "extra")]);
}

export function buildHintsView(profile: ILabProfile, coins: number, page = 0, note?: string): PanelResult {
  const owner = profile.userId;
  const last = RARITY_ORDER.length - 1;
  const p = Math.max(0, Math.min(last, page));
  const rarity = RARITY_ORDER[p];
  const price = Math.round(HINT_PRICE[rarity] * (hasGear(profile, "analyzer") ? 0.5 : 1));

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
        `سعر التلميح: ${jenny(price)}${hasGear(profile, "analyzer") ? " (خصم المحلّل 50%)" : ""} • رصيدك: ${jenny(coins)}`,
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



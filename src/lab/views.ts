import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { CURRENCY, jenny } from "../constants";
import { COMPOUND_MAP, COMPOUNDS, RARITY_INFO, type Rarity } from "./compounds";
import { ELEMENT_MAP, ELEMENTS } from "./elements";
import {
  BACK,
  LEVELS_UNLOCK_SELECT,
  MARKET_SELL_SELECT,
  OPEN_CODEX,
  OPEN_LEVELS,
  OPEN_MARKET,
  OPEN_SHOP,
  PRESSURE_DOWN,
  PRESSURE_UP,
  PUBLISH_PREFIX,
  REACT,
  RESET,
  SELECT_ELEMENT,
  SHOP_BUY_SELECT,
  TEMP_DOWN,
  TEMP_UP,
} from "./ids";
import { renderFlask } from "./render";
import { getMarketPrice } from "./market";
import type { ILabProfile } from "../database/models/LabProfile";
import type { ILabSession } from "../database/models/LabSession";

export interface PanelResult {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
  files: { attachment: Buffer; name: string }[];
}

export async function buildMainPanel(profile: ILabProfile, session: ILabSession): Promise<PanelResult> {
  const buffer = await renderFlask(session.mix, session.temp, session.pressure);
  const files = buffer ? [{ attachment: buffer, name: "flask.png" }] : [];

  const mixLines = Object.entries(session.mix)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => `${ELEMENT_MAP[id]?.icon ?? COMPOUND_MAP[id]?.icon ?? "✨"} ${ELEMENT_MAP[id]?.name ?? COMPOUND_MAP[id]?.name ?? id} ×${qty}`);

  const embed = new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("🧪 المختبر")
    .setDescription(
      [
        `**المستوى:** ${profile.labLevel} (🔬 ${profile.labTokens} رمز) — **السمعة:** ✨ ${profile.reputation}`,
        `**الخليط الحالي:** ${mixLines.length ? mixLines.join("، ") : "فاضي، اختر عناصر بالأسفل"}`,
      ].join("\n"),
    );
  if (buffer) embed.setImage("attachment://flask.png");

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];

  const ownedElements = ELEMENTS.filter((e) => (profile.inventory[e.id] ?? 0) > 0);
  if (ownedElements.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(SELECT_ELEMENT)
      .setPlaceholder("➕ أضف عنصراً للخليط")
      .addOptions(
        ownedElements.slice(0, 25).map((e) => ({
          label: `${e.name} (معك ${profile.inventory[e.id]})`,
          value: e.id,
          emoji: e.icon,
        })),
      );
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }

  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(TEMP_DOWN).setLabel("حرارة").setEmoji("➖").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(TEMP_UP).setLabel("حرارة").setEmoji("➕").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(PRESSURE_DOWN).setLabel("ضغط").setEmoji("➖").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(PRESSURE_UP).setLabel("ضغط").setEmoji("➕").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(REACT).setLabel("تفاعل").setEmoji("⚗️").setStyle(ButtonStyle.Success),
    ),
  );
  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(RESET).setLabel("تصفير").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(OPEN_CODEX).setLabel("المكتبة").setEmoji("📖").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(OPEN_MARKET).setLabel("السوق").setEmoji("💹").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(OPEN_SHOP).setLabel("المتجر").setEmoji("🏪").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(OPEN_LEVELS).setLabel("المستويات").setEmoji("🎚️").setStyle(ButtonStyle.Secondary),
    ),
  );

  return { embeds: [embed], components, files };
}

export function backRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(BACK).setLabel("رجوع للمختبر").setEmoji("🔙").setStyle(ButtonStyle.Secondary),
  );
}

const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export function buildCodexView(profile: ILabProfile) {
  const lines = RARITY_ORDER.map((rarity) => {
    const items = COMPOUNDS.filter((c) => c.rarity === rarity);
    const discovered = items.filter((c) => profile.discovered.includes(c.id));
    const names = items
      .map((c) => (profile.discovered.includes(c.id) ? `${c.icon} ${c.name}` : "❔ ???"))
      .join("، ");
    return `**${RARITY_INFO[rarity].name}** (${discovered.length}/${items.length})\n${names}`;
  });

  const embed = new EmbedBuilder()
    .setColor(0xa855f7)
    .setTitle("📖 مكتبة الاكتشاف")
    .setDescription(`اكتشفت **${profile.discovered.length}/${COMPOUNDS.length}** مركب\n\n${lines.join("\n\n")}`);

  return { embeds: [embed], components: [backRow()] };
}

export async function buildMarketView(guildId: string, profile: ILabProfile) {
  const owned = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) > 0);

  const lines: string[] = [];
  for (const c of owned) {
    const price = await getMarketPrice(guildId, c.id);
    lines.push(`${c.icon} **${c.name}** ×${profile.compounds[c.id]} — ${jenny(price)} للوحدة`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle("💹 سوق المركبات")
    .setDescription(owned.length ? lines.join("\n") : "ما عندك مركبات تبيعها بعد.");

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  if (owned.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(MARKET_SELL_SELECT)
      .setPlaceholder("💰 اختر مركباً لبيع وحدة منه")
      .addOptions(owned.slice(0, 25).map((c) => ({ label: `${c.name} (معك ${profile.compounds[c.id]})`, value: c.id, emoji: c.icon })));
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }
  components.push(backRow());

  return { embeds: [embed], components };
}

export function buildShopView(profile: ILabProfile) {
  const available = ELEMENTS.filter((e) => e.tier === 1 || profile.unlockedElements.includes(e.id));
  const lines = available.map((e) => `${e.icon} **${e.name}** — ${jenny(e.price)} (معك ${profile.inventory[e.id] ?? 0})`);

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("🏪 متجر المختبر")
    .setDescription(`${lines.join("\n")}\n\nكل اختيار من القائمة يشتري **وحدة واحدة**.`);

  const select = new StringSelectMenuBuilder()
    .setCustomId(SHOP_BUY_SELECT)
    .setPlaceholder("🛒 اختر عنصراً تشتريه")
    .addOptions(available.map((e) => ({ label: `${e.name} — ${e.price} ${CURRENCY.name}`, value: e.id, emoji: e.icon })));

  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select), backRow()] };
}

export function buildLevelsView(profile: ILabProfile) {
  const locked = ELEMENTS.filter((e) => e.tier === 2 && !profile.unlockedElements.includes(e.id));
  const unlocked = ELEMENTS.filter((e) => e.tier === 2 && profile.unlockedElements.includes(e.id));

  const lines = [
    `**المستوى:** ${profile.labLevel}`,
    `**رموز المختبر 🔬:** ${profile.labTokens}`,
    "",
    unlocked.length ? `**مفتوح:** ${unlocked.map((e) => `${e.icon} ${e.name}`).join("، ")}` : "",
    locked.length ? `**مقفل:**\n${locked.map((e) => `${e.icon} ${e.name} — يحتاج 🔬 ${e.unlockCost}`).join("\n")}` : "✅ فتحت كل عناصر الدرجة الثانية!",
  ].filter(Boolean);

  const embed = new EmbedBuilder().setColor(0x8b5cf6).setTitle("🎚️ المستويات والفتح").setDescription(lines.join("\n"));

  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  if (locked.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(LEVELS_UNLOCK_SELECT)
      .setPlaceholder("🔓 اختر عنصراً تفتحه")
      .addOptions(locked.map((e) => ({ label: `${e.name} (${e.unlockCost} 🔬)`, value: e.id, emoji: e.icon })));
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  }
  components.push(backRow());

  return { embeds: [embed], components };
}

export function buildReactSuccessView(compoundId: string, discoveredNow: boolean, level: number, leveledUp: boolean, tokensGained: number) {
  const compound = COMPOUND_MAP[compoundId];
  const rarity = RARITY_INFO[compound.rarity];

  const lines = [
    `${compound.icon} **${compound.name}** (${rarity.name})`,
    discoveredNow ? "🆕 أول مرة تكتشفه!" : "✅ صنعته بنجاح",
    `+${compound.xp} XP${leveledUp ? `  🆙 المستوى **${level}** (+${tokensGained} 🔬)` : ""}`,
  ];

  const embed = new EmbedBuilder().setColor(rarity.color).setTitle("⚗️ نجح التفاعل!").setDescription(lines.join("\n"));

  const actionRow = new ActionRowBuilder<ButtonBuilder>();
  if (compound.rarity === "legendary" && discoveredNow) {
    actionRow.addComponents(
      new ButtonBuilder().setCustomId(`${PUBLISH_PREFIX}${compoundId}`).setLabel("انشر مقالاً علمياً 📰").setStyle(ButtonStyle.Success),
    );
  }
  actionRow.addComponents(
    new ButtonBuilder().setCustomId(BACK).setLabel("رجوع للمختبر").setEmoji("🔙").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [actionRow] };
}

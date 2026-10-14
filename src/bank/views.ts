import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { CURRENCY, jenny } from "../constants";
import type { IUserProfile } from "../database/models/UserProfile";
import {
  MENU_BACK_BUTTON,
  MENU_DEPOSIT_BUTTON,
  MENU_SETTINGS_BUTTON,
  MENU_TRANSFER_BUTTON,
  MENU_WITHDRAW_BUTTON,
  SETPIN_BUTTON,
  SETTINGS_CHANGEPIN_BUTTON,
  SETTINGS_REMOVEPIN_BUTTON,
} from "./ids";

export function buildAccountOpenedMessage(accountNumber: string) {
  return {
    content: [
      "🏦 تم فتح حسابك بنجاح!",
      `رقم حسابك: \`${accountNumber}\` (تحتاجه للتحويلات لاحقاً)`,
      "",
      "🔒 الآن حدد رقمك السري (4 أرقام) عشان تقدر تستخدم البنك.",
    ].join("\n"),
    components: [setPinRow()],
  };
}

export function buildNeedsPinMessage() {
  return {
    content: "🔒 ما حددت رقمك السري بعد. اضغط الزر عشان تحدده.",
    components: [setPinRow()],
  };
}

function setPinRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SETPIN_BUTTON).setLabel("تحديد الرمز السري").setEmoji("🔒").setStyle(ButtonStyle.Success),
  );
}

export function buildMainMenu() {
  const embed = new EmbedBuilder().setColor(0x38bdf8).setTitle("🏦 البنك").setDescription("اختر العملية اللي تبيها:");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(MENU_TRANSFER_BUTTON).setLabel("تحويل").setEmoji("💸").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(MENU_DEPOSIT_BUTTON).setLabel("إيداع").setEmoji("📥").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(MENU_WITHDRAW_BUTTON).setLabel("سحب").setEmoji("📤").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(MENU_SETTINGS_BUTTON).setLabel("إعدادات").setEmoji("⚙️").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function buildSettingsMenu() {
  const embed = new EmbedBuilder().setColor(0x94a3b8).setTitle("⚙️ إعدادات البنك");
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(SETTINGS_CHANGEPIN_BUTTON).setLabel("تغيير الرمز السري").setEmoji("🔁").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(SETTINGS_REMOVEPIN_BUTTON).setLabel("حذف الرمز السري").setEmoji("❌").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(MENU_BACK_BUTTON).setLabel("رجوع").setEmoji("🔙").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [row] };
}

export function buildBalanceEmbed(profile: Pick<IUserProfile, "coins" | "bank">): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x38bdf8)
    .setTitle("📊 رصيدك")
    .addFields(
      { name: "المحفظة", value: `${CURRENCY.emoji} ${jenny(profile.coins)}`, inline: true },
      { name: "البنك", value: `🏦 ${jenny(profile.bank)}`, inline: true },
    );
}

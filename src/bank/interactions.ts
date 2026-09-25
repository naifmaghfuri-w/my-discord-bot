import { EmbedBuilder, MessageFlags, type ModalSubmitInteraction } from "discord.js";
import { CURRENCY, jenny } from "../constants";
import { getProfile } from "../services/economy";
import { logger } from "../utils/logger";
import { isValidPin, setPin, verifyPin, withdraw } from "./service";

export const SETPIN_MODAL = "bank_setpin_modal";
export const BALANCE_MODAL = "bank_balance_modal";
export const WITHDRAW_MODAL_PREFIX = "bank_withdraw_modal_";

export async function handleBankModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId === SETPIN_MODAL) {
    const pin = interaction.fields.getTextInputValue("pin").trim();
    if (!isValidPin(pin)) {
      await interaction.reply({ content: "❌ الرقم السري لازم يكون 4 أرقام بالضبط.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await setPin(interaction.user.id, guildId, pin).catch((err) => {
      logger.error("فشل حفظ الرقم السري", err);
    });
    await interaction.reply({
      content: "✅ تم تحديد رقمك السري. احفظه لنفسك، ما يقدر أحد يشوفه حتى أنا.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (customId === BALANCE_MODAL) {
    const pin = interaction.fields.getTextInputValue("pin").trim();
    const ok = await verifyPin(interaction.user.id, guildId, pin);
    if (!ok) {
      await interaction.reply({ content: "❌ رقم سري غلط.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const profile = await getProfile(interaction.user.id, guildId);
    const embed = new EmbedBuilder()
      .setColor(0x38bdf8)
      .setTitle("🏦 رصيدك")
      .addFields(
        { name: "المحفظة", value: `${CURRENCY.emoji} ${jenny(profile.coins)}`, inline: true },
        { name: "البنك", value: `🏦 ${jenny(profile.bank)}`, inline: true },
      );
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId.startsWith(WITHDRAW_MODAL_PREFIX)) {
    const amount = Number(customId.slice(WITHDRAW_MODAL_PREFIX.length));
    const pin = interaction.fields.getTextInputValue("pin").trim();
    const ok = await verifyPin(interaction.user.id, guildId, pin);
    if (!ok) {
      await interaction.reply({ content: "❌ رقم سري غلط.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const result = await withdraw(interaction.user.id, guildId, amount);
    if (!result.ok) {
      await interaction.reply({ content: "❌ رصيد بنكك ما يكفي (تغيّر منذ ما فتحت النموذج).", flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.reply({
      content: `✅ سحبت ${jenny(amount)} من البنك.\n${CURRENCY.emoji} المحفظة: ${jenny(result.coins)}\n🏦 البنك: ${jenny(result.bank)}`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  return false;
}

import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { jenny } from "../constants";
import { getProfile } from "../services/economy";
import { logger } from "../utils/logger";
import {
  BALANCE_MODAL,
  DEPOSIT_MODAL,
  MENU_BACK_BUTTON,
  MENU_BALANCE_BUTTON,
  MENU_DEPOSIT_BUTTON,
  MENU_SETTINGS_BUTTON,
  MENU_TRANSFER_BUTTON,
  MENU_WITHDRAW_BUTTON,
  SETPIN_BUTTON,
  SETPIN_MODAL,
  SETTINGS_CHANGEPIN_BUTTON,
  SETTINGS_REMOVEPIN_BUTTON,
  TRANSFER_MODAL,
  WITHDRAW_MODAL,
} from "./ids";
import { deposit, hasPin, isValidPin, removePin, setPin, transferWallet, verifyPin, withdraw } from "./service";
import { buildBalanceEmbed, buildMainMenu, buildSettingsMenu } from "./views";

function pinInput(label = "أدخل رقمك السري"): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId("pin")
      .setLabel(label)
      .setStyle(TextInputStyle.Short)
      .setMinLength(4)
      .setMaxLength(4)
      .setPlaceholder("XXXX")
      .setRequired(true),
  );
}

function amountInput(): ActionRowBuilder<TextInputBuilder> {
  return new ActionRowBuilder<TextInputBuilder>().addComponents(
    new TextInputBuilder()
      .setCustomId("amount")
      .setLabel("المبلغ")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("مثال: 500")
      .setRequired(true),
  );
}

function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return n > 0 ? n : null;
}

export async function handleBankButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;
  const userId = interaction.user.id;

  if (customId === SETPIN_BUTTON) {
    const modal = new ModalBuilder().setCustomId(SETPIN_MODAL).setTitle("تحديد الرمز السري").addComponents(pinInput("رقمك السري الجديد (4 أرقام)"));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === MENU_TRANSFER_BUTTON) {
    const modal = new ModalBuilder()
      .setCustomId(TRANSFER_MODAL)
      .setTitle("تحويل لعضو")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("recipient")
            .setLabel("المستلم (منشن أو آيدي)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("@user أو رقم الآيدي")
            .setRequired(true),
        ),
        amountInput(),
      );
    await interaction.showModal(modal);
    return true;
  }

  if (customId === MENU_DEPOSIT_BUTTON) {
    const modal = new ModalBuilder().setCustomId(DEPOSIT_MODAL).setTitle("إيداع للبنك").addComponents(amountInput());
    await interaction.showModal(modal);
    return true;
  }

  if (customId === MENU_WITHDRAW_BUTTON) {
    if (!(await hasPin(userId, guildId))) {
      await interaction.reply({ content: "❌ لازم تحدد رقماً سرياً أول من الإعدادات.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const modal = new ModalBuilder()
      .setCustomId(WITHDRAW_MODAL)
      .setTitle("سحب من البنك")
      .addComponents(amountInput(), pinInput());
    await interaction.showModal(modal);
    return true;
  }

  if (customId === MENU_BALANCE_BUTTON) {
    if (!(await hasPin(userId, guildId))) {
      const profile = await getProfile(userId, guildId);
      await interaction.reply({ embeds: [buildBalanceEmbed(profile)], flags: MessageFlags.Ephemeral });
      return true;
    }
    const modal = new ModalBuilder().setCustomId(BALANCE_MODAL).setTitle("تأكيد الهوية").addComponents(pinInput());
    await interaction.showModal(modal);
    return true;
  }

  if (customId === MENU_SETTINGS_BUTTON) {
    await interaction.update(buildSettingsMenu());
    return true;
  }

  if (customId === MENU_BACK_BUTTON) {
    await interaction.update(buildMainMenu());
    return true;
  }

  if (customId === SETTINGS_CHANGEPIN_BUTTON) {
    const modal = new ModalBuilder().setCustomId(SETPIN_MODAL).setTitle("تغيير الرمز السري").addComponents(pinInput("رقمك السري الجديد (4 أرقام)"));
    await interaction.showModal(modal);
    return true;
  }

  if (customId === SETTINGS_REMOVEPIN_BUTTON) {
    await removePin(userId, guildId).catch((err) => logger.error("فشل حذف الرقم السري", err));
    await interaction.update({
      content: "✅ تم حذف رقمك السري. عرض الرصيد بعدها بدون طلب رقم، لين تحدد رقماً جديداً.",
      embeds: [],
      components: [],
    });
    return true;
  }

  return false;
}

export async function handleBankModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;
  const userId = interaction.user.id;

  if (customId === SETPIN_MODAL) {
    const pin = interaction.fields.getTextInputValue("pin").trim();
    if (!isValidPin(pin)) {
      await interaction.reply({ content: "❌ الرقم السري لازم يكون 4 أرقام بالضبط.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await setPin(userId, guildId, pin).catch((err) => logger.error("فشل حفظ الرقم السري", err));
    await interaction.reply({
      content: "✅ تم تحديد رقمك السري. احفظه لنفسك، ما يقدر أحد يشوفه حتى أنا.\nاكتب `بنك` من جديد عشان تفتح القائمة.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (customId === BALANCE_MODAL) {
    const pin = interaction.fields.getTextInputValue("pin").trim();
    const ok = await verifyPin(userId, guildId, pin);
    if (!ok) {
      await interaction.reply({ content: "❌ رقم سري غلط.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const profile = await getProfile(userId, guildId);
    await interaction.reply({ embeds: [buildBalanceEmbed(profile)], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === DEPOSIT_MODAL) {
    const amount = parseAmount(interaction.fields.getTextInputValue("amount"));
    if (!amount) {
      await interaction.reply({ content: "❌ أدخل مبلغاً صحيحاً (رقم أكبر من صفر).", flags: MessageFlags.Ephemeral });
      return true;
    }
    const result = await deposit(userId, guildId, amount);
    if (!result.ok) {
      await interaction.reply({ content: "❌ رصيد محفظتك ما يكفي لهذا المبلغ.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.reply({
      content: `✅ أودعت ${jenny(amount)} بالبنك.\nالمحفظة: ${jenny(result.coins)} | البنك: ${jenny(result.bank)}`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (customId === WITHDRAW_MODAL) {
    const amount = parseAmount(interaction.fields.getTextInputValue("amount"));
    const pin = interaction.fields.getTextInputValue("pin").trim();

    if (!amount) {
      await interaction.reply({ content: "❌ أدخل مبلغاً صحيحاً (رقم أكبر من صفر).", flags: MessageFlags.Ephemeral });
      return true;
    }
    const ok = await verifyPin(userId, guildId, pin);
    if (!ok) {
      await interaction.reply({ content: "❌ رقم سري غلط.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const result = await withdraw(userId, guildId, amount);
    if (!result.ok) {
      await interaction.reply({ content: "❌ رصيد بنكك ما يكفي لهذا المبلغ.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.reply({
      content: `✅ سحبت ${jenny(amount)} من البنك.\nالمحفظة: ${jenny(result.coins)} | البنك: ${jenny(result.bank)}`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (customId === TRANSFER_MODAL) {
    const recipientRaw = interaction.fields.getTextInputValue("recipient").trim();
    const amount = parseAmount(interaction.fields.getTextInputValue("amount"));

    const match = /^<@!?(\d+)>$|^(\d{15,21})$/.exec(recipientRaw);
    const targetId = match?.[1] ?? match?.[2];

    if (!targetId || !amount) {
      await interaction.reply({ content: "❌ تأكد من المستلم (منشن أو آيدي) والمبلغ.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
    if (!targetUser || targetUser.bot) {
      await interaction.reply({ content: "❌ ما لقيت هذا العضو.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const result = await transferWallet(userId, targetId, guildId, amount);
    if (!result.ok) {
      const reasons: Record<string, string> = {
        self: "❌ ما تقدر تحوّل لنفسك.",
        insufficient: "❌ رصيد محفظتك ما يكفي لهذا المبلغ.",
      };
      await interaction.reply({ content: reasons[result.reason], flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.reply({ content: `✅ حوّلت ${jenny(amount)} لـ ${targetUser}.`, flags: MessageFlags.Ephemeral });
    return true;
  }

  return false;
}

import {
  ActionRowBuilder,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { CURRENCY, jenny } from "../../constants";
import { deposit, hasPin, openAccount, withdraw } from "../../bank/service";
import { BALANCE_MODAL, SETPIN_MODAL, WITHDRAW_MODAL_PREFIX } from "../../bank/interactions";
import type { Command } from "../../types";
import { getGuild } from "../../utils/guild";
import { getProfile } from "../../services/economy";

function pinInput(customId: string, label: string): ActionRowBuilder<TextInputBuilder> {
  const input = new TextInputBuilder()
    .setCustomId(customId)
    .setLabel(label)
    .setStyle(TextInputStyle.Short)
    .setMinLength(4)
    .setMaxLength(4)
    .setPlaceholder("XXXX")
    .setRequired(true);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("bank")
    .setDescription("نظام البنك: حساب خاص، إيداع، سحب")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("open").setDescription("افتح حسابك البنكي"))
    .addSubcommand((s) => s.setName("setpin").setDescription("حدد أو غيّر رقمك السري (4 أرقام)"))
    .addSubcommand((s) => s.setName("account").setDescription("اعرض رقم حسابك (بدون الرصيد)"))
    .addSubcommand((s) => s.setName("balance").setDescription("اعرض رصيدك (يحتاج رقمك السري)"))
    .addSubcommand((s) =>
      s
        .setName("deposit")
        .setDescription("أودع من محفظتك للبنك")
        .addIntegerOption((o) => o.setName("amount").setDescription("المبلغ").setRequired(true).setMinValue(1)),
    )
    .addSubcommand((s) =>
      s
        .setName("withdraw")
        .setDescription("اسحب من البنك لمحفظتك (يحتاج رقمك السري)")
        .addIntegerOption((o) => o.setName("amount").setDescription("المبلغ").setRequired(true).setMinValue(1)),
    ),
  cooldown: 3,

  async execute(interaction) {
    const guildId = getGuild(interaction).id;
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "open") {
      const result = await openAccount(userId, guildId);
      const msg = result.alreadyExisted
        ? `🏦 عندك حساب بالفعل. رقم حسابك: \`${result.accountNumber}\``
        : `🏦 تم فتح حسابك بنجاح!\nرقم حسابك: \`${result.accountNumber}\`\nاستخدم \`/bank setpin\` لتحديد رقمك السري (4 أرقام).`;
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "account") {
      const result = await openAccount(userId, guildId);
      await interaction.reply({ content: `🏦 رقم حسابك: \`${result.accountNumber}\``, flags: MessageFlags.Ephemeral });
      return;
    }

    if (sub === "setpin") {
      const modal = new ModalBuilder()
        .setCustomId(SETPIN_MODAL)
        .setTitle("تحديد الرقم السري")
        .addComponents(pinInput("pin", "رقمك السري الجديد (4 أرقام)"));
      await interaction.showModal(modal);
      return;
    }

    if (sub === "balance") {
      if (!(await hasPin(userId, guildId))) {
        await interaction.reply({
          content: "❌ ما حددت رقماً سرياً بعد. استخدم `/bank setpin` أولاً.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const modal = new ModalBuilder()
        .setCustomId(BALANCE_MODAL)
        .setTitle("تأكيد الهوية")
        .addComponents(pinInput("pin", "أدخل رقمك السري"));
      await interaction.showModal(modal);
      return;
    }

    if (sub === "deposit") {
      const amount = interaction.options.getInteger("amount", true);
      const result = await deposit(userId, guildId, amount);
      if (!result.ok) {
        await interaction.reply({ content: "❌ رصيد محفظتك ما يكفي لهذا المبلغ.", flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.reply({
        content: `✅ أودعت ${jenny(amount)} بالبنك.\n${CURRENCY.emoji} المحفظة: ${jenny(result.coins)}\n🏦 البنك: ${jenny(result.bank)}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (sub === "withdraw") {
      if (!(await hasPin(userId, guildId))) {
        await interaction.reply({
          content: "❌ ما حددت رقماً سرياً بعد. استخدم `/bank setpin` أولاً.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const amount = interaction.options.getInteger("amount", true);
      const profile = await getProfile(userId, guildId);
      if (profile.bank < amount) {
        await interaction.reply({ content: "❌ رصيد بنكك ما يكفي لهذا المبلغ.", flags: MessageFlags.Ephemeral });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId(`${WITHDRAW_MODAL_PREFIX}${amount}`)
        .setTitle("تأكيد السحب")
        .addComponents(pinInput("pin", "أدخل رقمك السري"));
      await interaction.showModal(modal);
      return;
    }
  },
};

export default command;

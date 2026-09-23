import { Collection, Events, MessageFlags, type Interaction } from "discord.js";
import type { BotClient } from "../client";
import type { BotEvent } from "../types";
import { logger } from "../utils/logger";

// المفتاح: اسم الأمر + معرف المستخدم  |  القيمة: وقت انتهاء الانتظار
const cooldowns = new Collection<string, number>();

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(client: BotClient, interaction: Interaction) {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        logger.error(`خطأ في اقتراحات /${interaction.commandName}`, err);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // --- نظام الكولداون ---
    const key = `${interaction.commandName}:${interaction.user.id}`;
    const now = Date.now();
    const expires = cooldowns.get(key);

    if (expires && now < expires) {
      const left = Math.ceil((expires - now) / 1000);
      await interaction.reply({
        content: `⏳ انتظر ${left} ثانية قبل استخدام الأمر مرة ثانية.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    cooldowns.set(key, now + (command.cooldown ?? 3) * 1000);

    // --- تنفيذ الأمر مع معالجة الأخطاء ---
    try {
      await command.execute(interaction);
    } catch (err) {
      logger.error(`خطأ في الأمر /${interaction.commandName}`, err);
      const payload = { content: "❌ حدث خطأ أثناء تنفيذ الأمر.", flags: MessageFlags.Ephemeral } as const;
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    }
  },
};

export default event;

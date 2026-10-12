import { MessageFlags, type Interaction, type Message } from "discord.js";
import { createLobby, handleCodenamesButton, handleCodenamesModal } from "./codenames";
import {
  GAMES_TRIGGER,
  MENU_BACK,
  MENU_CODENAMES,
  MENU_SELECT,
  buildCategory,
  buildGamesMenu,
  type Category,
} from "./menu";

/** رسالة "$Games": تفتح قائمة الألعاب. ترجع true لو كانت الرسالة هذا الأمر. */
export async function handleGamesMessage(message: Message): Promise<boolean> {
  if (!message.inGuild() || !GAMES_TRIGGER.test((message.content ?? "").trim())) return false;
  await message.channel.send(buildGamesMenu(message.author.id)).catch(() => undefined);
  return true;
}

/** كل تفاعلات الألعاب (قائمة، أزرار، نماذج). ترجع true لو تعاملت معها. */
export async function handleGamesInteraction(interaction: Interaction): Promise<boolean> {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(`${MENU_SELECT}|`)) {
    const owner = interaction.customId.split("|")[1];
    if (owner !== interaction.user.id) {
      await interaction.reply({ content: "اكتب `$Games` وتفتح قائمتك الخاصة.", flags: MessageFlags.Ephemeral });
      return true;
    }
    await interaction.update(buildCategory(interaction.values[0] as Category, owner));
    return true;
  }

  if (interaction.isButton()) {
    const [head, owner] = interaction.customId.split("|");
    if (head === MENU_BACK || head === MENU_CODENAMES) {
      if (owner !== interaction.user.id) {
        await interaction.reply({ content: "اكتب `$Games` وتفتح قائمتك الخاصة.", flags: MessageFlags.Ephemeral });
        return true;
      }
      if (head === MENU_BACK) await interaction.update(buildGamesMenu(owner));
      else await createLobby(interaction);
      return true;
    }
    if (head === "cn") return handleCodenamesButton(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("cn|")) {
    return handleCodenamesModal(interaction);
  }

  return false;
}

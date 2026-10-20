import { MessageFlags, type Interaction, type Message } from "discord.js";
import { createLobby, createLobbyFromMessage, handleCodenamesButton, handleCodenamesModal } from "./codenames";
import { GAMES_TRIGGER, buildGamesList } from "./menu";
import { RPS_TRIGGER, startRps } from "./rps";
import { SALFA_TRIGGER, createSalfa, handleSalfaButton, handleSalfaModal, handleSalfaSelect } from "./salfa";
import { XO_TRIGGER, startXo } from "./xo";

const CODENAMES_TRIGGER = /^!\s*كود\s*-?\s*نايمز$/;

/** أوامر الألعاب النصية: !العاب !كود نايمز !سالفة !اكس-او !حجرة. ترجع true لو الرسالة كانت أحدها. */
export async function handleGamesMessage(message: Message): Promise<boolean> {
  if (!message.inGuild()) return false;
  const text = (message.content ?? "").trim();
  if (!text.startsWith("!")) return false;

  if (GAMES_TRIGGER.test(text)) {
    await message.channel.send(buildGamesList()).catch(() => undefined);
    return true;
  }
  if (CODENAMES_TRIGGER.test(text)) {
    await createLobbyFromMessage(message);
    return true;
  }
  if (SALFA_TRIGGER.test(text)) {
    await createSalfa(message);
    return true;
  }
  const xo = XO_TRIGGER.exec(text);
  if (xo) {
    await startXo(message, xo[1]);
    return true;
  }
  if (RPS_TRIGGER.test(text)) {
    await startRps(message);
    return true;
  }
  return false;
}

/** كل تفاعلات الألعاب (أزرار، قوائم، نماذج). ترجع true لو تعاملت معها. */
export async function handleGamesInteraction(interaction: Interaction): Promise<boolean> {
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith("sf|")) return handleSalfaSelect(interaction);

  if (interaction.isButton()) {
    const head = interaction.customId.split("|")[0];
    if (head === "sf") return handleSalfaButton(interaction);
    if (head === "cn") return handleCodenamesButton(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("sf|")) return handleSalfaModal(interaction);

  if (interaction.isModalSubmit() && interaction.customId.startsWith("cn|")) {
    return handleCodenamesModal(interaction);
  }
  return false;
}

export { createLobby, MessageFlags };

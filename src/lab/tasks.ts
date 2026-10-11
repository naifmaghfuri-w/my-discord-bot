import type { Message } from "discord.js";
import { getProfile } from "../services/economy";
import { getLabProfile } from "./service";
import { buildCodexView, buildLevelsView, buildQuestsView, buildWarehouseView } from "./views";

/** $LT = Lab Tasks (المهام) • $LS = Lab Stock (المخزون) • $LL = Lab Library (المكتبة) • $LTREE = Lab Tree (شجرة الفتح) — يشتغلون فقط في الروم المخصص */
export const TASKS_TRIGGER = /^\$lt$/i;
export const STOCK_TRIGGER = /^\$ls$/i;
export const LIBRARY_TRIGGER = /^\$ll$/i;
export const TREE_TRIGGER = /^\$ltree$/i;
export const TASKS_CHANNEL = "1551169206400188538";

/** يرجع true لو الرسالة كانت أحد الأمرين (حتى لو بروم غلط، عشان ما تمشي لباقي الأوامر) */
export async function handleLabTasksMessage(message: Message<true>): Promise<boolean> {
  const text = message.content.trim();
  const isTasks = TASKS_TRIGGER.test(text);
  const isStock = STOCK_TRIGGER.test(text);
  const isLibrary = LIBRARY_TRIGGER.test(text);
  const isTree = TREE_TRIGGER.test(text);
  if (!isTasks && !isStock && !isLibrary && !isTree) return false;
  if (message.channelId !== TASKS_CHANNEL) return true; // روم ثاني: ما يصير شيء

  const profile = await getLabProfile(message.author.id, message.guildId);
  if (isTasks) {
    const view = buildQuestsView(profile);
    await message.reply({ embeds: view.embeds, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }
  if (isTree) {
    const view = buildLevelsView(profile);
    await message.reply({ embeds: view.embeds, components: view.components, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }
  if (isLibrary) {
    const view = buildCodexView(profile, 0);
    await message.reply({ embeds: view.embeds, components: view.components, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }
  const coins = (await getProfile(message.author.id, message.guildId)).coins;
  const view = buildWarehouseView(profile, coins);
  await message.reply({ embeds: view.embeds, components: view.components, allowedMentions: { repliedUser: false } }).catch(() => undefined);
  return true;
}

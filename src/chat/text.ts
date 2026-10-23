import { ChannelType, PermissionFlagsBits, type Message } from "discord.js";
import { config } from "../config";
import { setConfig } from "./service";
import { buildLobbyPanel } from "./views";

/** !لوحة دردشة <#الكاتيجوري أو اسمها> [صورة مرفقة أو رابط] — لمالك السيرفر فقط */
export const CHATPANEL_TRIGGER = /^!\s*لوحة\s+دردش(?:ة|ه|ات)(?:\s+([\s\S]+))?$/;

export async function handleChatPanelMessage(message: Message<true>): Promise<void> {
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);
  const isOwner = message.author.id === message.guild.ownerId || (!!config.ownerId && message.author.id === config.ownerId);
  if (!isOwner) return void (await reply("❌ هذا الأمر لمالك السيرفر فقط."));

  const rest = (CHATPANEL_TRIGGER.exec(message.content.trim())?.[1] ?? "").trim();

  // الكاتيجوري: منشن أو اسم
  let category = null as null | { id: string; name: string };
  const mention = /<#(\d+)>/.exec(rest);
  if (mention) {
    const ch = message.guild.channels.cache.get(mention[1]);
    if (ch?.type === ChannelType.GuildCategory) category = ch;
  } else {
    const url = /https?:\/\/\S+/.exec(rest);
    const name = (url ? rest.replace(url[0], "") : rest).trim().toLowerCase();
    if (name) category = message.guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(name)) ?? null;
  }
  if (!category) {
    return void (await reply("❌ حدد الكاتيجوري: `!لوحة دردشة #الكاتيجوري` وارفق صورة البانر (اختياري)."));
  }

  const att = message.attachments.find((a) => a.contentType?.startsWith("image/"));
  const link = /https?:\/\/\S+/.exec(rest)?.[0];
  const banner = att?.url ?? link ?? null;

  const me = message.guild.members.me;
  if (!me?.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
    return void (await reply("❌ البوت يحتاج صلاحيتي «إدارة القنوات» و«إدارة الرتب» لإنشاء الغرف الخاصة."));
  }

  const saved = await setConfig(message.guildId, category.id, banner);
  const bannerUrl = saved?.bannerUrl ?? config.chatBannerUrl ?? null;
  await message.channel.send(buildLobbyPanel(message.guild.name, bannerUrl)).catch(() => undefined);
  await message.delete().catch(() => undefined);
}

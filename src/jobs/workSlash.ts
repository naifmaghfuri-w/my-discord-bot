import type { ChatInputCommandInteraction, Message } from "discord.js";
import { handleCompanyWorkMessage } from "../companies";
import { handleJobMessage } from "./interactions";
import { getJob } from "./service";
import { THIEF, handleThiefMessage } from "./thief";

/** يغلّف التفاعل كأنه رسالة، عشان /work يستخدم نفس منطق !دوام و !سرقة بالضبط */
function asMessage(i: ChatInputCommandInteraction, content: string): Message<true> {
  let first = true;
  const send = async (opts: unknown) => {
    const o = (typeof opts === "string" ? { content: opts } : opts) as Record<string, unknown>;
    // رد السلاش لازم يكون الأول؛ بعدها رسائل متابعة
    if (first) {
      first = false;
      const { allowedMentions: _a, ...rest } = o;
      await i.reply({ ...rest, allowedMentions: { parse: [], repliedUser: false } } as never);
      return i.fetchReply();
    }
    return i.followUp(o as never);
  };
  const channel = Object.create(i.channel ?? {}) as Record<string, unknown>;
  channel.send = send;
  channel.sendTyping = async () => undefined;
  return {
    id: i.id,
    author: i.user,
    member: i.member,
    guild: i.guild,
    guildId: i.guildId,
    client: i.client,
    content,
    channel,
    inGuild: () => true,
    reply: send,
  } as unknown as Message<true>;
}

/** /work: شركة → دوام الشركة، حرامي → قائمة السرقة، غير كذا → دوام الوظيفة */
export async function handleWorkSlash(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.inGuild() || !i.guild) return void (await i.reply({ content: "❌ هذا الأمر داخل السيرفر فقط.", ephemeral: true }));
  const msg = asMessage(i, "!دوام");
  if (await handleCompanyWorkMessage(msg, "work")) return;
  const jp = await getJob(i.user.id, i.guildId);
  if (jp.jobId === THIEF.jobId) return void (await handleThiefMessage(msg));
  await handleJobMessage(msg, "work");
}

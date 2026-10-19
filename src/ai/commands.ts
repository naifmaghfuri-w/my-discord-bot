import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { llmConfigured } from "./llm";
import { todayKey } from "./handler";
import { AiMemory, AiPerson, AiSettings, AiUsage } from "./models";
import { DEFAULT_VOICE, VOICES, ttsEnabled } from "./tts";

export const data = new SlashCommandBuilder()
  .setName("ذكاء")
  .setDescription("إعداد الدردشة الذكية")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((s) =>
    s
      .setName("تعيين")
      .setDescription("غرفة الدردشة وحدودها وشخصية البوت وصوته")
      .addChannelOption((o) =>
        o.setName("الغرفة").setDescription("يردّ على كل رسالة فيها").addChannelTypes(ChannelType.GuildText),
      )
      .addBooleanOption((o) => o.setName("منشن").setDescription("يردّ في أي غرفة عند منشنه أو الردّ عليه"))
      .addStringOption((o) => o.setName("الشخصية").setDescription("وصف أسلوبه وشخصيته").setMaxLength(1500))
      .addIntegerOption((o) =>
        o.setName("الحد_اليومي").setDescription("أقصى ردود في اليوم للسيرفر (0 = بلا حد)").setMinValue(0).setMaxValue(5000),
      )
      .addIntegerOption((o) =>
        o.setName("المهلة").setDescription("ثوانٍ بين ردّين للعضو نفسه").setMinValue(0).setMaxValue(300),
      )
      .addStringOption((o) => o.setName("الموديل").setDescription("اسم النموذج (فارغ = الافتراضي)"))
      .addStringOption((o) =>
        o
          .setName("الصوت")
          .setDescription("صوت الردود الصوتية")
          .addChoices(...VOICES.map((v) => ({ name: v.name, value: v.value }))),
      )
      .addIntegerOption((o) =>
        o
          .setName("نسبة_الصوت")
          .setDescription("نسبة الردّ بمقطع صوتي بدل نص (0 = عند الطلب فقط)")
          .setMinValue(0)
          .setMaxValue(100),
      )
      .addBooleanOption((o) => o.setName("الايموجي").setDescription("يستعمل إيموجيات السيرفر في ردوده"))
      .addIntegerOption((o) =>
        o.setName("الذاكرة").setDescription("كم دوراً يتذكّر من كل عضو (0 = لا ذاكرة)").setMinValue(0).setMaxValue(20),
      )
      .addStringOption((o) =>
        o.setName("رد_الحماية").setDescription("ردّه على محاولات كشف التعليمات").setMaxLength(300),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("شخصية")
      .setDescription("تعرّف البوت على عضو: وصف يعرفه به ويكلّمه على أساسه")
      .addUserOption((o) => o.setName("العضو").setDescription("العضو").setRequired(true))
      .addStringOption((o) => o.setName("الوصف").setDescription("وصف العضو").setRequired(true).setMaxLength(500))
      .addStringOption((o) => o.setName("الاسم").setDescription("اسم يناديه به").setMaxLength(40)),
  )
  .addSubcommand((s) => s.setName("شخصيات").setDescription("دليل الشخصيات: من يعرفهم البوت وكيف"))
  .addSubcommand((s) =>
    s
      .setName("شخصية_حذف")
      .setDescription("يحذف وصف عضو من دليل الشخصيات")
      .addUserOption((o) => o.setName("العضو").setDescription("العضو").setRequired(true)),
  )
  .addSubcommand((s) =>
    s
      .setName("مسح")
      .setDescription("ينسى ذاكرة عضو مع البوت (أو الجميع إن لم تحدّد)")
      .addUserOption((o) => o.setName("العضو").setDescription("العضو")),
  )
  .addSubcommand((s) => s.setName("ايقاف").setDescription("يوقف الدردشة الذكية"))
  .addSubcommand((s) => s.setName("حالة").setDescription("إعداد الدردشة الذكية واستهلاك اليوم"));

const say = (i: ChatInputCommandInteraction, content: string) =>
  i.reply({ content, flags: MessageFlags.Ephemeral });

export async function execute(i: ChatInputCommandInteraction): Promise<void> {
  const guildId = i.guildId;
  if (!guildId) {
    await say(i, "❌ الأمر للسيرفرات فقط.");
    return;
  }

  switch (i.options.getSubcommand()) {
    case "تعيين": {
      const set: Record<string, unknown> = { enabled: true };
      const ch = i.options.getChannel("الغرفة");
      if (ch) set.channelId = ch.id;
      const bools: [string, string][] = [["منشن", "mention"], ["الايموجي", "useEmoji"]];
      for (const [opt, field] of bools) {
        const v = i.options.getBoolean(opt);
        if (v !== null) set[field] = v;
      }
      const ints: [string, string][] = [
        ["الحد_اليومي", "dailyLimit"], ["المهلة", "cooldown"], ["نسبة_الصوت", "voiceRate"], ["الذاكرة", "memory"],
      ];
      for (const [opt, field] of ints) {
        const v = i.options.getInteger(opt);
        if (v !== null) set[field] = v;
      }
      const strs: [string, string][] = [
        ["الشخصية", "persona"], ["الموديل", "model"], ["الصوت", "voice"], ["رد_الحماية", "protectionReply"],
      ];
      for (const [opt, field] of strs) {
        const v = i.options.getString(opt);
        if (v !== null) set[field] = v.trim();
      }
      await AiSettings.updateOne({ guildId }, { $set: set }, { upsert: true });
      await say(i, "✅ تم حفظ الإعدادات. شوف `/ذكاء حالة` للتفاصيل.");
      return;
    }

    case "شخصية": {
      const user = i.options.getUser("العضو", true);
      await AiPerson.updateOne(
        { guildId, userId: user.id },
        { $set: { description: i.options.getString("الوصف", true), name: i.options.getString("الاسم") ?? "" } },
        { upsert: true },
      );
      await say(i, `✅ حفظت وصف <@${user.id}>.`);
      return;
    }

    case "شخصيات": {
      const people = await AiPerson.find({ guildId }).lean();
      if (people.length === 0) {
        await say(i, "ما فيه شخصيات محفوظة. أضف وحدة بـ `/ذكاء شخصية`.");
        return;
      }
      const lines = people.map((p) => `• <@${p.userId}>${p.name ? ` (${p.name})` : ""}: ${p.description}`);
      await say(i, lines.join("\n").slice(0, 1900));
      return;
    }

    case "شخصية_حذف": {
      const user = i.options.getUser("العضو", true);
      const r = await AiPerson.deleteOne({ guildId, userId: user.id });
      await say(i, r.deletedCount ? `🗑️ انحذف وصف <@${user.id}>.` : "❌ ما عنده وصف محفوظ.");
      return;
    }

    case "مسح": {
      const user = i.options.getUser("العضو");
      await AiMemory.deleteMany(user ? { guildId, userId: user.id } : { guildId });
      await say(i, user ? `🧹 نسي ذاكرته مع <@${user.id}>.` : "🧹 نسي ذاكرة الجميع.");
      return;
    }

    case "ايقاف": {
      await AiSettings.updateOne({ guildId }, { $set: { enabled: false } }, { upsert: true });
      await say(i, "⏹️ تم إيقاف الدردشة الذكية. شغّلها من جديد بـ `/ذكاء تعيين`.");
      return;
    }

    case "حالة": {
      const s = await AiSettings.findOne({ guildId }).lean();
      if (!s) {
        await say(i, "ما فيه إعدادات بعد. ابدأ بـ `/ذكاء تعيين`.");
        return;
      }
      const used = (await AiUsage.findOne({ guildId, day: todayKey() }).lean())?.count ?? 0;
      const voiceName = VOICES.find((v) => v.value === (s.voice || DEFAULT_VOICE))?.name ?? s.voice;
      const yn = (b: boolean) => (b ? "✅" : "❌");
      await say(
        i,
        [
          `**الحالة:** ${s.enabled ? "شغّال ✅" : "موقوف ⏹️"}`,
          `**الغرفة:** ${s.channelId ? `<#${s.channelId}>` : "غير محددة"}`,
          `**المنشن:** ${yn(s.mention)}  **الايموجي:** ${yn(s.useEmoji)}`,
          `**الاستهلاك اليوم:** ${used}/${s.dailyLimit || "∞"}`,
          `**المهلة:** ${s.cooldown}ث  **الذاكرة:** ${s.memory} دور`,
          `**الموديل:** ${s.model || "الافتراضي"}`,
          `**الصوت:** ${voiceName}  **النسبة:** ${s.voiceRate}%`,
          `**الشخصية:** ${s.persona ? s.persona.slice(0, 200) : "الافتراضية (سورية)"}`,
          `**مفتاح Claude:** ${yn(llmConfigured())}  **مفتاح الصوت:** ${yn(ttsEnabled())}`,
        ].join("\n"),
      );
      return;
    }
  }
}

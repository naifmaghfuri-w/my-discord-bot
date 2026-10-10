import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { jenny } from "../../constants";
import { getStreak, nextMilestone } from "../../services/streak";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder().setName("streak").setDescription("شوف شعلة نشاطك 🔥").setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const s = await getStreak(interaction.user.id, getGuild(interaction).id);
    const lines = [`🔥 **شعلتك:** ${s.streak} ${s.streak === 1 ? "يوم" : "يوم متتالي"}`, `🏅 أفضل شعلة: ${s.best} يوم`];
    const next = nextMilestone(s.streak);
    if (next) lines.push(`🎯 المرحلة القادمة: ${next.day} يوم (جائزة ${jenny(next.reward)})`);
    lines.push(s.activeToday ? "✅ حسبنا يومك اليوم." : s.atRisk ? "⚠️ أرسل أي رسالة اليوم قبل منتصف الليل (توقيت الرياض) وإلا تنطفئ شعلتك!" : "أرسل أي رسالة لتشعل شعلة جديدة.");
    await interaction.reply(lines.join("\n"));
  },
};

export default command;

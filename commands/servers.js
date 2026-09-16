const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// ⚠️ ضع الآيدي الخاص بحسابك هنا
const OWNER_ID = '1391517806193017023';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('عرض السيرفرات التي يتواجد فيها البوت'),

    async execute(interaction) {
        // 1. تأجيل الرد فوراً لتجنب خطأ The application did not respond
        await interaction.deferReply({ ephemeral: true });

        // التحقق من أن المستخدم هو صاحب البوت
        if (interaction.user.id !== OWNER_ID) {
            return interaction.editReply({ content: '❌ هذا الأمر مخصص لصاحب البوت فقط!' });
        }

        const guilds = interaction.client.guilds.cache;

        if (guilds.size === 0) {
            return interaction.editReply({ content: 'البوت غير متواجد في أي سيرفر حالياً.' });
        }

        // إنشاء قائمة السيرفرات
        const description = guilds.map((guild, index) => {
            return `**${index + 1}. ${guild.name}**\n🆔 ID: \`${guild.id}\` | 👥 الأعضاء: \`${guild.memberCount}\``;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`📊 قائمة سيرفرات البوت (${guilds.size})`)
            .setDescription(description.length > 4000 ? description.substring(0, 4000) + '...' : description)
            .setColor('#2b2d31');

        // 2. إرسال النتيجة عبر editReply
        await interaction.editReply({ embeds: [embed] });
    },
};

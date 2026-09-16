const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ⚠️ ضع الآيدي الخاص بحسابك هنا لضمان عدم استخدام الأمر من قبل غيرك
const OWNER_ID = '1391517806193017023';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('عرض السيرفرات التي يتواجد فيها البوت وإمكانية الخروج منها'),

    async execute(interaction) {
        // التحقق من أن المستخدم هو صاحب البوت فقط
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص لصاحب البوت فقط!', ephemeral: true });
        }

        const guilds = interaction.client.guilds.cache;

        if (guilds.size === 0) {
            return interaction.reply({ content: 'البوت غير متواجد في أي سيرفر حالياً.', ephemeral: true });
        }

        // إنشاء قائمة السيرفرات
        const description = guilds.map((guild, index) => {
            return `**${index + 1}. ${guild.name}**\n🆔 ID: \`${guild.id}\` | 👥 الأعضاء: \`${guild.memberCount}\``;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setTitle(`📊 قائمة سيرفرات البوت (${guilds.size})`)
            .setDescription(description.length > 4000 ? description.substring(0, 4000) + '...' : description)
            .setColor('#2b2d31');

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};

const { SlashCommandBuilder } = require('discord.js');

const OWNER_ID = '1391517806193017023'; // ضع الآيدي الخاص بك هنا

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave-server')
        .setDescription('إخراج البوت من سيرفر محدد بواسطة ID')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر المراد الخروج منه')
                .setRequired(true)),

    async execute(interaction) {
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ هذا الأمر مخصص لصاحب البوت فقط!', ephemeral: true });
        }

        const guildId = interaction.options.getString('guild_id');
        const guild = interaction.client.guilds.cache.get(guildId);

        if (!guild) {
            return interaction.reply({ content: '❌ لم يتم العثور على سيرفر بهذا ID.', ephemeral: true });
        }

        try {
            const guildName = guild.name;
            await guild.leave();
            await interaction.reply({ content: `✅ تم الخروج بنجاح من سيرفر: **${guildName}** (\`${guildId}\`)`, ephemeral: true });
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ حدث خطأ أثناء محاولة الخروج من السيرفر.', ephemeral: true });
        }
    },
};

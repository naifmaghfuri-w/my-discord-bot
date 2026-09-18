const { SlashCommandBuilder, MessageFlags } = require('discord.js');

// ⚠️ الآيدي الخاص بحساب صاحب البوت
const OWNER_ID = '1391517806193017023';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave-server')
        .setDescription('إخراج البوت من سيرفر محدد بواسطة ID')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر المراد الخروج منه')
                .setRequired(true)),

    async execute(interaction) {
        try {
            // التحقق من أن المستخدم هو صاحب البوت
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ 
                    content: '❌ هذا الأمر مخصص لصاحب البوت فقط!', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const guildId = interaction.options.getString('guild_id').trim();
            
            // البحث عن السيرفر في الكاش أو محاولة جلب البيانات
            let guild = interaction.client.guilds.cache.get(guildId);
            if (!guild) {
                guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
            }

            if (!guild) {
                return interaction.reply({ 
                    content: '❌ لم يتم العثور على سيرفر بهذا الـ ID أو أن البوت غير متواجد فيه.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            const guildName = guild.name;
            await guild.leave();

            return interaction.reply({ 
                content: `✅ تم الخروج بنجاح من سيرفر: **${guildName}** (\`${guildId}\`)`, 
                flags: MessageFlags.Ephemeral 
            });

        } catch (error) {
            console.error('❌ خطأ في أمر leave-server:', error);
            if (!interaction.replied) {
                await interaction.reply({ 
                    content: '❌ حدث خطأ أثناء محاولة الخروج من السيرفر.', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    },
};

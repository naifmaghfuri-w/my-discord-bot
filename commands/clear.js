const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('حذف مجموعة من الرسائل')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('عدد الرسائل المراد حذفها من 1 إلى 100')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option => 
            option.setName('target')
                .setDescription('حدد الشخص المراد حذف رسائله فقط')
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            const allowedRoleIds = ['1434264100556247040'];
            const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));

            if (!hasRole) {
                return interaction.reply({ 
                    content: '❌ عذراً، لا تملك الرتبة المحددة لاستخدام هذا الأمر.', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('target');

            // جلب الرسائل من القناة
            const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });

            let messagesToDelete = Array.from(fetchedMessages.values());

            if (targetUser) {
                messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
            }

            // اقتطاع العدد المطلوب فقط
            messagesToDelete = messagesToDelete.slice(0, amount);

            if (messagesToDelete.length === 0) {
                return interaction.editReply({ content: '⚠️ لم يتم العثور على رسائل مطابقة للحذف.' });
            }

            const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);

            return interaction.editReply({ 
                content: `🗑️ تم حذف **${deleted.size}** رسالة بنجاح.` 
            });

        } catch (err) {
            console.error('❌ خطأ أثناء تنفيذ أمر clear:', err);
            if (interaction.deferred) {
                await interaction.editReply({ 
                    content: '❌ حدث خطأ أثناء الحذف (قد تكون الرسائل أقدم من 14 يوماً ولا يمكن حذفها جماعياً).' 
                });
            }
        }
    }
};

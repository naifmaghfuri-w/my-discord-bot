const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('حذف مجموعة من الرسائل')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
        .addIntegerOption(option => 
            option.setName('amount').setDescription('عدد الرسائل المراد حذفها من 1 الى 100').setRequired(true).setMinValue(1).setMaxValue(100)
        )
        .addUserOption(option => 
            option.setName('target').setDescription('منشن الشخص المراد حذف رسائله فقط').setRequired(false)
        ),

    async execute(interaction) {
        const allowedRoleIds = ['1434264100556247040'];
        const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));

        if (!hasRole) {
            return interaction.reply({ content: 'عذراً، لا تملك الرتبة المحددة لاستخدام هذا الأمر.', flags: MessageFlags.Ephemeral });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('target');

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let messagesToDelete = Array.from(messages.values());

        if (targetUser) {
            messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
        }

        messagesToDelete = messagesToDelete.slice(0, amount);

        if (messagesToDelete.length === 0) {
            return interaction.reply({ content: 'لم يتم العثور على رسائل لحذفها.', flags: MessageFlags.Ephemeral });
        }

        await interaction.channel.bulkDelete(messagesToDelete, true)
            .then(deleted => {
                interaction.reply({ content: `تم حذف ${deleted.size} رسالة بنجاح.`, flags: MessageFlags.Ephemeral });
            })
            .catch(err => {
                console.error(err);
                interaction.reply({ content: 'حدث خطأ أثناء الحذف (قد تكون الرسائل أقدم من 14 يوماً).', flags: MessageFlags.Ephemeral });
            });
    }
};


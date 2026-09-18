const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ActionRowBuilder, 
    MessageFlags 
} = require('discord.js');

const COLOR_ROLES = {
    '1398466078346317914': { 
        'red': '1547536586487365683',
        'blue': '1550050050736918619',
        'green': '1550050315376525382',
        'yellow': '1550050523359744011',
        'purple': '1550050683754119188',
        'grey': '1550051301147021393',
        'black': 'ID_رتبة_الأسود_سيرفر_1'
    },
    '1519745057505153186': { 
        'red': 'ID_رتبة_الأحمر_سيرفر_2',
        'blue': 'ID_رتبة_الأزرق_سيرفر_2',
        'green': 'ID_رتبة_الأخضر_سيرفر_2',
        'yellow': 'ID_رتبة_الأصفر_سيرفر_2',
        'purple': 'ID_رتبة_البنفسجي_سيرفر_2',
        'grey': 'ID_رتبة_الرمادي_سيرفر_2',
        'black': '1545356919072489483'
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('colors')
        .setDescription('إرسال قائمة اختيار لون الاسم (للإدارة)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🎨 قائمة تخصيص لون الاسم')
                .setDescription('اختر اللون الذي تفضله من القائمة أدناه لتغيير لون اسمك في السيرفر!\n\n*(يمكنك إزالة اللون بالضغط على إزالة اللون)*');

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_name_color')
                .setPlaceholder('🎨 اضغط هنا لاختيار لون اسمك...')
                .addOptions([
                    new StringSelectMenuOptionBuilder().setLabel('أحمر 🔴').setValue('red'),
                    new StringSelectMenuOptionBuilder().setLabel('أزرق 🔵').setValue('blue'),
                    new StringSelectMenuOptionBuilder().setLabel('أخضر 🟢').setValue('green'),
                    new StringSelectMenuOptionBuilder().setLabel('أصفر 🟡').setValue('yellow'),
                    new StringSelectMenuOptionBuilder().setLabel('بنفسجي 🟣').setValue('purple'),
                    new StringSelectMenuOptionBuilder().setLabel('رمادي 🩶').setValue('grey'),
                    new StringSelectMenuOptionBuilder().setLabel('أسود 🖤').setValue('black'),
                    new StringSelectMenuOptionBuilder().setLabel('إزالة اللون الحالي ⚪').setValue('remove_color')
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            await interaction.reply({ embeds: [embed], components: [row] });
        } catch (error) {
            console.error('❌ خطأ في تنفيذ أمر colors:', error);
        }
    },

    async handleColorSelect(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guildId = interaction.guildId;
            const serverColors = COLOR_ROLES[guildId];

            if (!serverColors) {
                return interaction.editReply({ content: '⚠️ هذا السيرفر غير مسجل في إعدادات الألوان!' });
            }

            const selectedValue = interaction.values[0];
            const member = interaction.member;

            // استخراج IDs الرتب المحددة بشكل صحيح وإبعاد النماذج غير المجهزة
            const validColorRoleIds = Object.values(serverColors).filter(id => id && !id.startsWith('ID_'));

            // إزالة جميع ألوان الألقاب المجهزة سابقاً
            if (validColorRoleIds.length > 0) {
                await member.roles.remove(validColorRoleIds).catch(() => null);
            }

            if (selectedValue === 'remove_color') {
                return interaction.editReply({ content: '✅ تم إزالة لون الاسم وتعيين اللون الافتراضي بنجاح.' });
            }

            const targetRoleId = serverColors[selectedValue];

            if (!targetRoleId || targetRoleId.startsWith('ID_')) {
                return interaction.editReply({ content: '⚠️ لم يتم إعداد ID الرتبة الخاص بهذا اللون في السيرفر بعد!' });
            }

            await member.roles.add(targetRoleId);
            return interaction.editReply({ content: '🎉 تم تغيير لون اسمك بنجاح!' });

        } catch (error) {
            console.error('❌ حدث خطأ أثناء تغيير رتبة اللون:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ حدث خطأ، تأكد من صلاحيات البوت وارتفاع رتبته فوق رتب الألوان!' });
            }
        }
    }
};

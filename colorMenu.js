const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');

// 🎨 خريطة الألوان: ضعي ID الرتب الخاصة بكل لون في سيرفرك
const COLOR_ROLES = {
    'red': 'ضع_ID_رتبة_اللون_الأحمر',
    'blue': 'ضع_ID_رتبة_اللون_الأزرق',
    'green': 'ضع_ID_رتبة_اللون_الأخضر',
    'yellow': 'ضع_ID_رتبة_اللون_الأصفر',
    'purple': 'ضع_ID_رتبة_اللون_البنفسجي'
};

// أمر Slash Command الخاص بإرسال القائمة
const colorCommandData = new SlashCommandBuilder()
    .setName('colors')
    .setDescription('إرسال قائمة اختيار لون الاسم (للإدارة)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString());

/**
 * دالة إرسال القائمة
 */
async function sendColorMenu(target) {
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
            new StringSelectMenuOptionBuilder().setLabel('إزالة اللون الحالي ⚪').setValue('remove_color')
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    if (target.send) {
        await target.send({ embeds: [embed], components: [row] });
    } else if (target.reply) {
        await target.reply({ embeds: [embed], components: [row] });
    }
}

/**
 * معالج اختيارات قائمة الألوان
 */
async function handleColorSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'select_name_color') return;

    const selectedValue = interaction.values[0];
    const member = interaction.member;
    const allColorRoleIds = Object.values(COLOR_ROLES);

    try {
        await member.roles.remove(allColorRoleIds.filter(id => id && !id.startsWith('ضع_ID')));

        if (selectedValue === 'remove_color') {
            return interaction.reply({ 
                content: '✅ تم إزالة لون الاسم وتعيين اللون الافتراضي بنجاح.', 
                ephemeral: true 
            });
        }

        const targetRoleId = COLOR_ROLES[selectedValue];
        if (targetRoleId && !targetRoleId.startsWith('ضع_ID')) {
            await member.roles.add(targetRoleId);
            return interaction.reply({ 
                content: '🎉 تم تغيير لون اسمك بنجاح!', 
                ephemeral: true 
            });
        } else {
            return interaction.reply({ 
                content: '⚠️ لم يتم وضع ID الرتبة الخاص بهذا اللون في الكود بعد!', 
                ephemeral: true 
            });
        }
    } catch (error) {
        console.error('حدث خطأ أثناء تغيير رتبة اللون:', error);
        return interaction.reply({ 
            content: '❌ حدث خطأ، تأكد من أن رتبة البوت أعلى من رتب الألوان في إعدادات السيرفر.', 
            ephemeral: true 
        });
    }
}

module.exports = {
    colorCommandData,
    sendColorMenu,
    handleColorSelect
};
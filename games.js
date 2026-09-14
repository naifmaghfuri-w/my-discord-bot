const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType,
    MessageFlags
} = require('discord.js');

// استدعاء ملفات الألعاب المستقلة
const { startOutOfLoopGame } = require('./outOfLoop');
const { startDetectiveGame } = require('./detective');
const { executeRouletteGame } = require('./roulette'); // استدعاء لعبة الروليت

const gamesCommands = [
    new SlashCommandBuilder()
        .setName('games')
        .setDescription('عرض قائمة الألعاب المتاحة واختيار لعبة لبدئها')
];

async function handleGamesCommand(context) {
    // تحديد صاحب الأمر ومصدر الرسالة (سواء كان إنتراكشن سلاش أو رسالة نصية بالچات)
    const author = context.user || context.author;

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_game')
        .setPlaceholder('اختر لعبة للبدء 🎲')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('برا السالفة')
                .setDescription('لعبة معرفة من هو الشخص الذي برا السالفة')
                .setValue('out_of_loop')
                .setEmoji('🕵️‍♂️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('المحققين')
                .setDescription('لعبة التحقيق واستجواب المشاركين لكشف الجاني')
                .setValue('detective_game')
                .setEmoji('🔍'),
            new StringSelectMenuOptionBuilder()
                .setLabel('روليت')
                .setDescription('لعبة العجلة لطرد اللاعبين حتى يتبقى الفائز')
                .setValue('roulette_game')
                .setEmoji('🎰'),
            new StringSelectMenuOptionBuilder()
                .setLabel('HxH')
                .setDescription('قريباً...')
                .setValue('hxh_game')
                .setEmoji('🎯')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const gamesEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle(' قائمة الألعاب المتاحة')
        .setDescription('اختر اللعبة التي تريد تشغيلها من القائمة بالأسفل:');

    let response;
    if (context.reply) {
        response = await context.reply({ embeds: [gamesEmbed], components: [row], fetchReply: true });
    } else {
        response = await context.channel.send({ embeds: [gamesEmbed], components: [row] });
    }

    const menuCollector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

    menuCollector.on('collect', async selectInteraction => {
        if (selectInteraction.user.id !== author.id) {
            return selectInteraction.reply({ 
                content: 'صاحب الأمر فقط هو من يمكنه اختيار اللعبة!', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const selectedValue = selectInteraction.values[0];

        if (selectedValue === 'out_of_loop') {
            menuCollector.stop();
            await startOutOfLoopGame(selectInteraction, context);
        } else if (selectedValue === 'detective_game') {
            menuCollector.stop();
            await startDetectiveGame(selectInteraction, context);
        } else if (selectedValue === 'roulette_game') {
            menuCollector.stop();
            await executeRouletteGame(selectInteraction);
        } else if (selectedValue === 'hxh_game') {
            await selectInteraction.reply({ 
                content: '⏳ ** قريباً!**  .', 
                flags: MessageFlags.Ephemeral 
            });
        }
    });
}

module.exports = { gamesCommands, handleGamesCommand };

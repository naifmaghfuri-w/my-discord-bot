const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType 
} = require('discord.js');

// استدعاء ملفات الألعاب المستقلة
const { startOutOfLoopGame } = require('./outOfLoop');
const { startDetectiveGame } = require('./detective');

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
                .setEmoji('🔍')
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const gamesEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🎮 قائمة الألعاب المتاحة')
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
            return selectInteraction.reply({ content: 'صاحب الأمر فقط هو من يمكنه اختيار اللعبة!', flags: 64 });
        }

        if (selectInteraction.values[0] === 'out_of_loop') {
            menuCollector.stop();
            await startOutOfLoopGame(selectInteraction, context);
        } else if (selectInteraction.values[0] === 'detective_game') {
            menuCollector.stop();
            await startDetectiveGame(selectInteraction, context);
        }
    });
}

module.exports = { gamesCommands, handleGamesCommand };

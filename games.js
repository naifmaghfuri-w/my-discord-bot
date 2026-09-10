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
        .setName('العاب')
        .setDescription('عرض قائمة الألعاب المتاحة واختيار لعبة لبدئها')
];

async function handleGamesCommand(interaction) {
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

    const response = await interaction.reply({ embeds: [gamesEmbed], components: [row], fetchReply: true });

    const menuCollector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

    menuCollector.on('collect', async selectInteraction => {
        if (selectInteraction.user.id !== interaction.user.id) {
            return selectInteraction.reply({ content: 'صاحب الأمر فقط هو من يمكنه اختيار اللعبة!', ephemeral: true });
        }

        if (selectInteraction.values[0] === 'out_of_loop') {
            menuCollector.stop();
            await startOutOfLoopGame(selectInteraction, interaction);
        } else if (selectInteraction.values[0] === 'detective_game') {
            menuCollector.stop();
            await startDetectiveGame(selectInteraction, interaction);
        }
    });
}

module.exports = { gamesCommands, handleGamesCommand };

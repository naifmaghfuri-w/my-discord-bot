const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType
} = require('discord.js');

// استدعاء ملفات الألعاب من نفس المجلد (commands/games/)
const { startOutOfLoopGame } = require('./outOfLoop');
const { startDetectiveGame } = require('./detective');
const { executeRouletteGame } = require('./roulette');

const gamesCommand = new SlashCommandBuilder()
    .setName('games')
    .setDescription('عرض قائمة الألعاب المتاحة واختيار لعبة لبدئها');

async function handleGamesCommand(context) {
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
            return selectInteraction.reply({ 
                content: 'صاحب الأمر فقط هو من يمكنه اختيار اللعبة!', 
                ephemeral: true 
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
            const hxhEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🎯 لعبة Hunter x Hunter')
                .setDescription('⏳ **قريباً جداً...**\nجارٍ العمل على تجهيز اللعبة وإضافة النظام الخاص بها!')
                .setImage('https://cdn.discordapp.com/attachments/1522782977472462898/1549384767714238484/C9B94D06-CB0E-4B26-9FE4-924489C72322.jpg?ex=6aaa8082&is=6aa92f02&hm=3c993a6a52705c0c3488009bab122bd1c63732b24042da4b7d4292b5021eea8a&');

            await selectInteraction.reply({ 
                embeds: [hxhEmbed], 
                ephemeral: true 
            });
        }
    });
}

// تصدير متوافق مع index.js و interactionCreate
module.exports = { 
    gamesCommands: [gamesCommand], 
    handleGamesCommand,
    execute: handleGamesCommand
};

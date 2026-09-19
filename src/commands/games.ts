import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType,
    MessageFlags,
    ChatInputCommandInteraction,
    Message,
    InteractionResponse,
    User,
    TextBasedChannel
} from 'discord.js';

// استدعاء الألعاب المتبقية
import { startOutOfLoopGame } from './games/outOfLoop';
import { executeRouletteGame } from './games/roulette';

export type GameContext = ChatInputCommandInteraction | Message;

export interface Command {
    data: SlashCommandBuilder;
    execute(context: GameContext): Promise<void>;
    gamesCommands?: SlashCommandBuilder[];
    handleGamesCommand?: (context: GameContext) => Promise<void>;
}

export const gamesCommand = new SlashCommandBuilder()
    .setName('games')
    .setDescription('عرض قائمة الألعاب المتاحة واختيار لعبة لبدئها') as SlashCommandBuilder;

// تم إضافة export هنا لتسهيل استدعائها عند كتابة "العاب" كرسالة
export async function handleGamesCommand(context: GameContext): Promise<void> {
    try {
        const author: User = 'user' in context ? context.user : context.author;

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

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

        const gamesEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🎮 قائمة الألعاب المتاحة')
            .setDescription('اختر اللعبة التي تريد تشغيلها من القائمة بالأسفل:');

        let response: Message | InteractionResponse;

        if ('reply' in context && typeof context.reply === 'function') {
            response = await context.reply({ embeds: [gamesEmbed], components: [row], fetchReply: true });
        } else {
            const channel = context.channel as TextBasedChannel | null;
            if (!channel || typeof (channel as any).send !== 'function') {
                console.error('❌ القناة غير متاحة للإرسال.');
                return;
            }
            response = await (channel as any).send({ embeds: [gamesEmbed], components: [row] });
        }

        const menuCollector = response.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 
        });

        menuCollector.on('collect', async (selectInteraction) => {
            try {
                if (selectInteraction.user.id !== author.id) {
                    await selectInteraction.reply({ 
                        content: '❌ صاحب الأمر فقط هو من يمكنه اختيار اللعبة!', 
                        flags: MessageFlags.Ephemeral 
                    });
                    return;
                }

                const selectedValue = selectInteraction.values[0];

                if (selectedValue === 'out_of_loop') {
                    menuCollector.stop('selected');
                    await (startOutOfLoopGame as any)(selectInteraction, context);
                } else if (selectedValue === 'roulette_game') {
                    menuCollector.stop('selected');
                    await (executeRouletteGame as any)(selectInteraction);
                } else if (selectedValue === 'hxh_game') {
                    const hxhEmbed = new EmbedBuilder()
                        .setColor('#ff0000')
                        .setTitle('🎯 لعبة Hunter x Hunter')
                        .setDescription('⏳ **قريباً جداً...**\nجارٍ العمل على تجهيز اللعبة وإضافة النظام الخاص بها!')
                        .setImage('https://cdn.discordapp.com/attachments/1522782977472462898/1549384767714238484/C9B94D06-CB0E-4B26-9FE4-924489C72322.jpg?ex=6aaa8082&is=6aa92f02&hm=3c993a6a52705c0c3488009bab122bd1c63732b24042da4b7d4292b5021eea8a&');

                    await selectInteraction.reply({ 
                        embeds: [hxhEmbed], 
                        flags: MessageFlags.Ephemeral 
                    });
                }
            } catch (err) {
                console.error('❌ خطأ أثناء اختيار اللعبة:', err);
            }
        });

        menuCollector.on('end', (_, reason) => {
            if (reason !== 'selected') {
                const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                    selectMenu.setDisabled(true).setPlaceholder('انتهت مهلة اختيار اللعبة ⏱️')
                );
                response.edit({ components: [disabledRow] }).catch(() => null);
            }
        });

    } catch (err) {
        console.error('❌ خطأ في تنفيذ أمر games:', err);
    }
}

const commandModule: Command = { 
    data: gamesCommand,
    gamesCommands: [gamesCommand], 
    handleGamesCommand,
    execute: handleGamesCommand
};

export default commandModule;

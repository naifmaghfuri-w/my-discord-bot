const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ComponentType,
    MessageFlags 
} = require('discord.js');

async function executeRouletteGame(interaction) {
    const players = [];
    const maxPlayers = 20;
    let countdown = 20; // الوقت المتبقي لبدء اللعبة

    // 1. بناء واجهة اللعبة المطابقة للصورة
    const buildEmbed = (secondsLeft) => {
        const playersListText = players.length > 0 
            ? players.map(p => `**${p.number}**- <@${p.id}>`).join('\n')
            : "لا يوجد لاعبين مشاركين باللعبة'";

        return new EmbedBuilder()
            .setTitle('روليت')
            .setDescription(
                `**طريقة اللعب:**\n` +
                `1- اختر الرقم الذي سيمثلك في اللعبة\n` +
                `2- ستبدأ الجولة الأولى وسيتم تدوير العجلة واختيار لاعب عشوائي\n` +
                `3- إذا كنت اللاعب المختار ، فستختار لاعباً من اختيارك ليتم طرده من اللعبة\n` +
                `4- يُطرد اللاعب وتبدأ جولة جديدة ، عندما يُطرد جميع اللاعبين ويبقى لاعبان فقط ، ستدور العجلة ويكون اللاعب المختار هو الفائز باللعبة\n\n` +
                `**أرقام اللاعبين: (${players.length}/${maxPlayers})**\n` +
                `${playersListText}`
            )
            .setColor('#E6A100')
            .setFooter({ text: `ستبدأ اللعبة بعد ${secondsLeft} ثانية` })
            .setTimestamp();
    };

    const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('join_roulette')
            .setLabel('دخول اللعبة 🎲')
            .setStyle(ButtonStyle.Success)
    );

    // الرد على تفاعل القائمة أو إرسال الرسالة
    let response;
    if (interaction.replied || interaction.deferred) {
        response = await interaction.followUp({ embeds: [buildEmbed(countdown)], components: [joinButton], fetchReply: true });
    } else {
        response = await interaction.reply({ embeds: [buildEmbed(countdown)], components: [joinButton], fetchReply: true });
    }

    // 2. مؤقت تنازلي لتحديث الرسالة
    const interval = setInterval(async () => {
        countdown--;
        if (countdown > 0) {
            await interaction.editReply({ embeds: [buildEmbed(countdown)] }).catch(() => {});
        } else {
            clearInterval(interval);
        }
    }, 1000);

    // 3. استقبال انضمام اللاعبين
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 20_000
    });

    collector.on('collect', async (i) => {
        if (i.customId === 'join_roulette') {
            if (players.some(p => p.id === i.user.id)) {
                return i.reply({ content: 'أنت مشارك بالفعل في اللعبة!', flags: MessageFlags.Ephemeral });
            }

            if (players.length >= maxPlayers) {
                return i.reply({ content: 'اكتمل الحد الأقصى للاعبين!', flags: MessageFlags.Ephemeral });
            }

            const assignedNumber = players.length + 1;
            players.push({ id: i.user.id, number: assignedNumber });

            await i.reply({ content: `تم انضمامك بنجاح! رقمك في اللعبة هو: **${assignedNumber}**`, flags: MessageFlags.Ephemeral });
            await interaction.editReply({ embeds: [buildEmbed(countdown)] });
        }
    });

    collector.on('end', async () => {
        clearInterval(interval);

        if (players.length < 2) {
            const cancelEmbed = new EmbedBuilder()
                .setTitle('روليت')
                .setDescription('❌ تم إلغاء اللعبة لعدم وجود عدد كافٍ من اللاعبين (مطلوب لاعبان على الأقل).')
                .setColor('#ED4245');

            await interaction.editReply({ embeds: [cancelEmbed], components: [] });
            return;
        }

        // بدء حلقة الجولات
        await runGameLoop(interaction, players);
    });
}

// 4. حلقة الجولات وطرد اللاعبين
async function runGameLoop(interaction, players) {
    let round = 1;

    while (players.length > 1) {
        const chosenIndex = Math.floor(Math.random() * players.length);
        const chosenPlayer = players[chosenIndex];

        // حالة النهائيات (عند متبقي لاعبان فقط)
        if (players.length === 2) {
            const winnerEmbed = new EmbedBuilder()
                .setTitle('🏆 الفائز في اللعبة!')
                .setDescription(`دارت العجلة المتبقية بين الأخيرين، ووقع الاختيار على صاحب الرقم **${chosenPlayer.number}**!\n\n🎉 **الفائز باللعبة هو:** <@${chosenPlayer.id}>`)
                .setColor('#57F287');

            await interaction.followUp({ embeds: [winnerEmbed], components: [] });
            return;
        }

        const targets = players.filter(p => p.id !== chosenPlayer.id);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('eliminate_select')
            .setPlaceholder('اختر اللاعب الذي تريد طرده من اللعبة...')
            .addOptions(
                targets.map(p => ({
                    label: `اللاعب رقم ${p.number}`,
                    value: p.id,
                    description: `طرد صاحب الرقم ${p.number}`,
                    emoji: '❌'
                }))
            );

        const menuRow = new ActionRowBuilder().addComponents(selectMenu);

        const roundEmbed = new EmbedBuilder()
            .setTitle(`🌀 الجولة ${round}`)
            .setDescription(
                `دارت العجلة ووقع الاختيار على صاحب الرقم **${chosenPlayer.number}** (<@${chosenPlayer.id}>)!\n\n` +
                `**يا <@${chosenPlayer.id}>، قم باختيار اللاعب الذي تريد طرده من القائمة أدناه!**`
            )
            .setColor('#E6A100');

        const roundMessage = await interaction.followUp({
            embeds: [roundEmbed],
            components: [menuRow]
        });

        try {
            const selectInteraction = await roundMessage.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                filter: (i) => {
                    if (i.user.id !== chosenPlayer.id) {
                        i.reply({ content: '❌ أنت لست اللاعب المختار للقيام بالطرد!', flags: MessageFlags.Ephemeral });
                        return false;
                    }
                    return true;
                },
                time: 30_000
            });

            const eliminatedId = selectInteraction.values[0];
            const eliminatedIndex = players.findIndex(p => p.id === eliminatedId);
            const eliminatedPlayer = players[eliminatedIndex];

            players.splice(eliminatedIndex, 1);

            const eliminatedEmbed = new EmbedBuilder()
                .setTitle('💥 تم طرد لاعب!')
                .setDescription(`قام صاحب الرقم **${chosenPlayer.number}** بطرد الرقم **${eliminatedPlayer.number}** (<@${eliminatedPlayer.id}>)!\n\nاللاعبون المتبقون: **${players.length}**`)
                .setColor('#ED4245');

            await selectInteraction.update({
                embeds: [eliminatedEmbed],
                components: []
            });

            round++;

        } catch {
            await interaction.followUp({
                content: `⏰ انتهى الوقت ولم يقم الرقم **${chosenPlayer.number}** باختيار أحد، تم تخطي دور هذه الجولة!`
            });
        }
    }
}

module.exports = { executeRouletteGame };

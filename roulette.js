const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ComponentType,
    MessageFlags 
} = require('discord.js');

// دالة تأخير زمني لخلق تأثير دوران العجلة
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function executeRouletteGame(interaction) {
    const players = [];
    const maxPlayers = 20;
    let countdown = 60;

    // 1. بناء واجهة اللعبة
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

    const joinRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('join_roulette')
            .setLabel('دخول اللعبة 🎲')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('leave_roulette')
            .setLabel('خروج 🚪')
            .setStyle(ButtonStyle.Danger)
    );

    let response;
    if (interaction.replied || interaction.deferred) {
        response = await interaction.followUp({ embeds: [buildEmbed(countdown)], components: [joinRow], fetchReply: true });
    } else {
        response = await interaction.reply({ embeds: [buildEmbed(countdown)], components: [joinRow], fetchReply: true });
    }

    // 2. تحديث العداد التنازلي كل 5 ثوانٍ لتفادي Rate Limits
    const interval = setInterval(async () => {
        countdown -= 5;
        if (countdown > 0) {
            await interaction.editReply({ embeds: [buildEmbed(countdown)] }).catch(() => {});
        } else {
            clearInterval(interval);
        }
    }, 5000);

    // 3. استقبال انضمام وخروج اللاعبين
    const collector = response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000
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

        } else if (i.customId === 'leave_roulette') {
            const playerIndex = players.findIndex(p => p.id === i.user.id);
            if (playerIndex === -1) {
                return i.reply({ content: 'أنت لست مشاركاً في اللعبة بالأساس!', flags: MessageFlags.Ephemeral });
            }

            players.splice(playerIndex, 1);
            players.forEach((p, idx) => p.number = idx + 1);

            await i.reply({ content: 'تم خروجك من اللعبة بنجاح!', flags: MessageFlags.Ephemeral });
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

        await runGameLoop(interaction, players);
    });
}

// 4. دوران العجلة والجولات
async function runGameLoop(interaction, players) {
    let round = 1;

    while (players.length > 1) {
        const spinEmbed = new EmbedBuilder()
            .setTitle(`🌀 الجولة ${round} - دوران العجلة`)
            .setDescription('🎰 **جاري تدوير العجلة الآن...**')
            .setColor('#E6A100');

        const wheelMessage = await interaction.followUp({ embeds: [spinEmbed] });

        // أنيميشن حركة العجلة
        const animationFrames = 5;
        for (let f = 0; f < animationFrames; f++) {
            const randomPlayer = players[Math.floor(Math.random() * players.length)];
            const animEmbed = new EmbedBuilder()
                .setTitle(`🌀 الجولة ${round} - دوران العجلة`)
                .setDescription(`🎰 العجلة تدور... **[ الرقم ${randomPlayer.number} - <@${randomPlayer.id}> ]** 🔄`)
                .setColor('#E6A100');

            await wheelMessage.edit({ embeds: [animEmbed] }).catch(() => {});
            await sleep(500 + (f * 150));
        }

        const chosenIndex = Math.floor(Math.random() * players.length);
        const chosenPlayer = players[chosenIndex];

        // نهائي اللعبة (لاعبان متبقيان)
        if (players.length === 2) {
            const winnerEmbed = new EmbedBuilder()
                .setTitle('🏆 الفائز في اللعبة!')
                .setDescription(`توقفت العجلة عند صاحب الرقم **${chosenPlayer.number}**!\n\n🎉 **الفائز باللعبة هو:** <@${chosenPlayer.id}>`)
                .setColor('#57F287');

            await wheelMessage.edit({ embeds: [winnerEmbed], components: [] });
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
                `🎯 **توقفت العجلة على:** الرقم **${chosenPlayer.number}** (<@${chosenPlayer.id}>)!\n\n` +
                `**يا <@${chosenPlayer.id}>، قم باختيار اللاعب الذي تريد طرده من القائمة أدناه!**`
            )
            .setColor('#E6A100');

        await wheelMessage.edit({
            embeds: [roundEmbed],
            components: [menuRow]
        });

        try {
            const selectInteraction = await wheelMessage.awaitMessageComponent({
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

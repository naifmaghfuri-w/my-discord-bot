const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    ComponentType,
    MessageFlags,
    AttachmentBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// دالة رسم العجلة (تم تقليل الحجم إلى 350 لحماية الـ RAM)
async function drawWheel(players, rotationAngle = 0, centerAvatarUrl = null) {
    const size = 350;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const radius = size / 2 - 25;
    const total = players.length;
    const sliceAngle = (2 * Math.PI) / total;

    const grayShades = ['#2B2C30', '#3A3B40', '#1F2023', '#4A4C54'];

    ctx.clearRect(0, 0, size, size);

    // 1. الإطار الخارجي الذهبي
    ctx.beginPath();
    ctx.arc(center, center, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#D4AF37';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    // 2. قطاعات العجلة
    players.forEach((player, index) => {
        const start = rotationAngle + index * sliceAngle;
        const end = start + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, start, end);
        ctx.closePath();

        ctx.fillStyle = grayShades[index % grayShades.length];
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#D4AF37';
        ctx.stroke();

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(start + sliceAngle / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${player.number}- ${player.username}`, radius - 15, 4);
        ctx.restore();
    });

    // 3. المؤشر الذهبي
    ctx.beginPath();
    ctx.moveTo(size - 5, center);
    ctx.lineTo(size - 25, center - 10);
    ctx.lineTo(size - 25, center + 10);
    ctx.closePath();
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#996515';
    ctx.stroke();

    // 4. أفياتار المنتصف
    const centerRadius = 30;
    if (centerAvatarUrl) {
        try {
            const img = await loadImage(centerAvatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(center, center, centerRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(img, center - centerRadius, center - centerRadius, centerRadius * 2, centerRadius * 2);
            ctx.restore();
        } catch {
            ctx.beginPath();
            ctx.arc(center, center, centerRadius, 0, 2 * Math.PI);
            ctx.fillStyle = '#1A1A1A';
            ctx.fill();
        }
    } else {
        ctx.beginPath();
        ctx.arc(center, center, centerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#1A1A1A';
        ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(center, center, centerRadius, 0, 2 * Math.PI);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#D4AF37';
    ctx.stroke();

    return canvas.toBuffer('image/png');
}

async function executeRouletteGame(interaction) {
    const players = []; // { id, number, username, avatarUrl }
    const maxPlayers = 20;
    let countdown = 60;

    const buildEmbed = (secondsLeft) => {
        const playersListText = players.length > 0 
            ? players.sort((a, b) => a.number - b.number).map(p => `**${p.number}**- <@${p.id}>`).join('\n')
            : "لا يوجد لاعبين مشاركين باللعبة";

        return new EmbedBuilder()
            .setTitle('روليت 🎲')
            .setDescription(
                `**طريقة اللعب:**\n` +
                `1- اختر الرقم الذي سيمثلك في اللعبة\n` +
                `2- ستبدأ الجولة الأولى وسيتم تدوير العجلة واختيار لاعب عشوائي\n` +
                `3- إذا كنت اللاعب المختار ، فستختار لاعباً من اختيارك ليتم طرده من اللعبة\n` +
                `4- يُطرد اللاعب وتبدأ جولة جديدة ، عندما يُطرد جميع اللاعبين ويبقى لاعبان فقط ، ستدور العجلة ويكون اللاعب المختار هو الفائز باللعبة\n\n` +
                `**أرقام اللاعبين: (${players.length}/${maxPlayers})**\n` +
                `${playersListText}`
            )
            .setColor('#D4AF37')
            .setFooter({ text: `ستبدأ اللعبة بعد ${secondsLeft} ثانية` })
            .setTimestamp();
    };

    const buildButtons = () => {
        const rows = [];
        const takenNumbers = players.map(p => p.number);

        for (let r = 0; r < 4; r++) {
            const row = new ActionRowBuilder();
            for (let i = 1; i <= 5; i++) {
                const num = r * 5 + i;
                const isTaken = takenNumbers.includes(num);

                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`num_${num}`)
                        .setLabel(`${num}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(isTaken)
                );
            }
            rows.push(row);
        }

        const controlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('random_join')
                .setLabel('دخول عشوائي')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('leave_game')
                .setLabel('اخرج من اللعبة')
                .setStyle(ButtonStyle.Danger)
        );
        rows.push(controlRow);

        return rows;
    };

    let response;
    // استخدام withResponse: true بدلاً من fetchReply: true
    if (interaction.replied || interaction.deferred) {
        response = await interaction.followUp({ embeds: [buildEmbed(countdown)], components: buildButtons(), withResponse: true });
    } else {
        response = await interaction.reply({ embeds: [buildEmbed(countdown)], components: buildButtons(), withResponse: true });
    }

    const interval = setInterval(async () => {
        countdown -= 5;
        if (countdown > 0) {
            await interaction.editReply({ embeds: [buildEmbed(countdown)] }).catch(() => {});
        } else {
            clearInterval(interval);
        }
    }, 5000);

    const collector = response.resource ? response.resource.message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000
    }) : response.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000
    });

    collector.on('collect', async (i) => {
        const userId = i.user.id;
        const username = i.user.username;
        const avatarUrl = i.user.displayAvatarURL({ extension: 'png', size: 128 });

        if (i.customId === 'leave_game') {
            const playerIndex = players.findIndex(p => p.id === userId);
            if (playerIndex === -1) {
                return i.reply({ content: 'أنت لست مشاركاً في اللعبة بالأساس!', flags: MessageFlags.Ephemeral });
            }

            players.splice(playerIndex, 1);
            await i.reply({ content: 'تم خروجك من اللعبة بنجاح!', flags: MessageFlags.Ephemeral });
            await interaction.editReply({ embeds: [buildEmbed(countdown)], components: buildButtons() });
            return;
        }

        if (players.some(p => p.id === userId)) {
            return i.reply({ content: 'أنت مشارك بالفعل في اللعبة!', flags: MessageFlags.Ephemeral });
        }

        if (players.length >= maxPlayers) {
            return i.reply({ content: 'اكتمل الحد الأقصى للاعبين!', flags: MessageFlags.Ephemeral });
        }

        let chosenNumber;

        if (i.customId === 'random_join') {
            const takenNumbers = players.map(p => p.number);
            const availableNumbers = Array.from({ length: 20 }, (_, idx) => idx + 1).filter(n => !takenNumbers.includes(n));
            
            chosenNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
        } else if (i.customId.startsWith('num_')) {
            chosenNumber = parseInt(i.customId.split('_')[1]);
            
            if (players.some(p => p.number === chosenNumber)) {
                return i.reply({ content: 'هذا الرقم تم اختياره بالفعل من لاعب آخر!', flags: MessageFlags.Ephemeral });
            }
        }

        players.push({ id: userId, number: chosenNumber, username: username, avatarUrl: avatarUrl });
        await i.reply({ content: `تم دخولك بنجاح بالرقم: **${chosenNumber}**`, flags: MessageFlags.Ephemeral });
        await interaction.editReply({ embeds: [buildEmbed(countdown)], components: buildButtons() });
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

async function runGameLoop(interaction, players) {
    let round = 1;

    while (players.length > 1) {
        const chosenIndex = Math.floor(Math.random() * players.length);
        const chosenPlayer = players[chosenIndex];

        const sliceAngle = (2 * Math.PI) / players.length;
        const targetAngle = -(chosenIndex * sliceAngle + sliceAngle / 2);

        let currentAngle = 0;
        const frames = 1; // تقليل الإطارات لتجنب الحظر ولحماية الذاكرة
        let wheelMsg;

        for (let f = 0; f < frames; f++) {
            currentAngle += Math.PI;
            const randomAvatar = players[Math.floor(Math.random() * players.length)].avatarUrl;
            
            const buffer = await drawWheel(players, currentAngle, randomAvatar);
            const attachment = new AttachmentBuilder(buffer, { name: 'wheel.png' });

            const spinEmbed = new EmbedBuilder()
                .setTitle(`🌀 الجولة ${round} - دوران العجلة`)
                .setDescription('🎰 **جاري تدوير العجلة...**')
                .setImage('attachment://wheel.png')
                .setColor('#D4AF37');

            if (!wheelMsg) {
                wheelMsg = await interaction.followUp({ embeds: [spinEmbed], files: [attachment] });
            } else {
                await wheelMsg.edit({ embeds: [spinEmbed], files: [attachment] }).catch(() => {});
            }
            await sleep(500);
        }

        const finalBuffer = await drawWheel(players, targetAngle, chosenPlayer.avatarUrl);
        const finalAttachment = new AttachmentBuilder(finalBuffer, { name: 'wheel_final.png' });

        if (players.length === 2) {
            const winnerEmbed = new EmbedBuilder()
                .setTitle('🏆 الفائز في اللعبة!')
                .setDescription(`توقفت العجلة عند صاحب الرقم **${chosenPlayer.number}**!\n\n🎉 **الفائز باللعبة هو:** <@${chosenPlayer.id}>`)
                .setImage('attachment://wheel_final.png')
                .setColor('#57F287');

            await wheelMsg.edit({ embeds: [winnerEmbed], files: [finalAttachment], components: [] });
            return;
        }

        const targets = players.filter(p => p.id !== chosenPlayer.id);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('eliminate_select')
            .setPlaceholder('اختر اللاعب الذي تريد طرده من اللعبة...')
            .addOptions(
                targets.map(p => ({
                    label: `اللاعب رقم ${p.number} (${p.username})`,
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
            .setImage('attachment://wheel_final.png')
            .setColor('#D4AF37');

        await wheelMsg.edit({
            embeds: [roundEmbed],
            files: [finalAttachment],
            components: [menuRow]
        });

        try {
            const selectInteraction = await wheelMsg.awaitMessageComponent({
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

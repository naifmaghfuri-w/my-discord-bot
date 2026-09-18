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

// ايقونة العملة
const CURRENCY_EMOJI = '<:J_:1548935096768274532>';

// قاعدة بيانات وهمية لرصيد اللاعبين (يمكنك ربطها بقاعدة البيانات الخاصة بك Quick.db / SQLite)
const balances = new Map(); // userId => amount

function getBalance(userId) {
    if (!balances.has(userId)) balances.set(userId, 500); // رصيد مجاني ابتدائي للجميع للتجربة 500 Jenny
    return balances.get(userId);
}

function addBalance(userId, amount) {
    balances.set(userId, getBalance(userId) + amount);
}

function removeBalance(userId, amount) {
    const current = getBalance(userId);
    if (current < amount) return false;
    balances.set(userId, current - amount);
    return true;
}

// أسعار عناصر المتجر
const SHOP_ITEMS = {
    DOUBLE_ELIMINATE: { id: 'double_eliminate', name: 'طرد مزدوج ✌️', price: 150, desc: 'طرد اثنين في نفس الجولة' },
    SHIELD: { id: 'shield', name: 'درع الحماية 🛡️', price: 100, desc: 'حماية لمرة واحدة من الطرد' },
    REVIVE: { id: 'revive', name: 'إحياء لاعب 🧟', price: 200, desc: 'إعادة لاعب خرج من اللعبة' }
};

// دالة رسم العجلة (مصححة الذاكرة 350x350)
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

    // 1. الإطار الخارجي
    ctx.beginPath();
    ctx.arc(center, center, radius + 8, 0, 2 * Math.PI);
    ctx.fillStyle = '#D4AF37';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFD700';
    ctx.stroke();

    // 2. القطاعات
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
        
        // إضافة أيقونة الدرع بجانب الاسم إذا كان لديه درع
        const shieldIcon = player.hasShield ? ' 🛡️' : '';
        ctx.fillText(`${player.number}- ${player.username}${shieldIcon}`, radius - 15, 4);
        ctx.restore();
    });

    // 3. المؤشر
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

// دالة فتح نافذة المتجر التفاعلية
async function openShopModal(i, player) {
    const userBal = getBalance(i.user.id);

    const shopEmbed = new EmbedBuilder()
        .setTitle(`🏪 متجر اللعبة (عملتك: ${userBal} ${CURRENCY_EMOJI})`)
        .setDescription(
            `اختر العناصر التي تريد شراءها باستخدام عملة Jenny:\n\n` +
            `1️⃣ **${SHOP_ITEMS.DOUBLE_ELIMINATE.name}** - ${SHOP_ITEMS.DOUBLE_ELIMINATE.price} ${CURRENCY_EMOJI}\n└ ${SHOP_ITEMS.DOUBLE_ELIMINATE.desc}\n\n` +
            `2️⃣ **${SHOP_ITEMS.SHIELD.name}** - ${SHOP_ITEMS.SHIELD.price} ${CURRENCY_EMOJI}\n└ ${SHOP_ITEMS.SHIELD.desc}\n\n` +
            `3️⃣ **${SHOP_ITEMS.REVIVE.name}** - ${SHOP_ITEMS.REVIVE.price} ${CURRENCY_EMOJI}\n└ ${SHOP_ITEMS.REVIVE.desc}`
        )
        .setColor('#F1C40F');

    const shopMenu = new StringSelectMenuBuilder()
        .setCustomId('buy_item_select')
        .setPlaceholder('اختر عنصراً لشرائه...')
        .addOptions([
            { label: SHOP_ITEMS.DOUBLE_ELIMINATE.name, value: SHOP_ITEMS.DOUBLE_ELIMINATE.id, description: `${SHOP_ITEMS.DOUBLE_ELIMINATE.price} Jenny` },
            { label: SHOP_ITEMS.SHIELD.name, value: SHOP_ITEMS.SHIELD.id, description: `${SHOP_ITEMS.SHIELD.price} Jenny` },
            { label: SHOP_ITEMS.REVIVE.name, value: SHOP_ITEMS.REVIVE.id, description: `${SHOP_ITEMS.REVIVE.price} Jenny` }
        ]);

    const row = new ActionRowBuilder().addComponents(shopMenu);

    const shopReply = await i.reply({ embeds: [shopEmbed], components: [row], flags: MessageFlags.Ephemeral, withResponse: true });

    const collector = shopReply.resource ? shopReply.resource.message.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 20_000
    }) : shopReply.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 20_000
    });

    collector.on('collect', async (selectInt) => {
        const itemKey = selectInt.values[0];

        if (itemKey === SHOP_ITEMS.DOUBLE_ELIMINATE.id) {
            if (player.hasDouble) {
                return selectInt.reply({ content: '❌ لديك ميزة الطرد المزدوج بالفعل!', flags: MessageFlags.Ephemeral });
            }
            if (!removeBalance(i.user.id, SHOP_ITEMS.DOUBLE_ELIMINATE.price)) {
                return selectInt.reply({ content: `❌ لا تملك رصيداً كافياً من ${CURRENCY_EMOJI}!`, flags: MessageFlags.Ephemeral });
            }
            player.hasDouble = true;
            await selectInt.reply({ content: `✅ تم شراء **${SHOP_ITEMS.DOUBLE_ELIMINATE.name}** بنجاح!`, flags: MessageFlags.Ephemeral });

        } else if (itemKey === SHOP_ITEMS.SHIELD.id) {
            if (player.hasShield) {
                return selectInt.reply({ content: '❌ لديك درع حماية مفعل بالفعل!', flags: MessageFlags.Ephemeral });
            }
            if (!removeBalance(i.user.id, SHOP_ITEMS.SHIELD.price)) {
                return selectInt.reply({ content: `❌ لا تملك رصيداً كافياً من ${CURRENCY_EMOJI}!`, flags: MessageFlags.Ephemeral });
            }
            player.hasShield = true;
            await selectInt.reply({ content: `✅ تم شراء **${SHOP_ITEMS.SHIELD.name}** بنجاح! يمكنك استخدامه لحمايتك من الطرد.`, flags: MessageFlags.Ephemeral });

        } else if (itemKey === SHOP_ITEMS.REVIVE.id) {
            if (player.hasRevive) {
                return selectInt.reply({ content: '❌ لديك جرعة إحياء بالفعل!', flags: MessageFlags.Ephemeral });
            }
            if (!removeBalance(i.user.id, SHOP_ITEMS.REVIVE.price)) {
                return selectInt.reply({ content: `❌ لا تملك رصيداً كافياً من ${CURRENCY_EMOJI}!`, flags: MessageFlags.Ephemeral });
            }
            player.hasRevive = true;
            await selectInt.reply({ content: `✅ تم شراء **${SHOP_ITEMS.REVIVE.name}** بنجاح! يمكنك استخدامه لإعادة لاعب مفقود.`, flags: MessageFlags.Ephemeral });
        }
    });
}

async function executeRouletteGame(interaction) {
    const players = []; // { id, number, username, avatarUrl, hasShield, hasDouble, hasRevive }
    const eliminatedPlayers = []; // لتتبع اللاعبين المطرودين للاستفادة من الإحياء
    const maxPlayers = 20;
    let countdown = 60;

    const buildEmbed = (secondsLeft) => {
        const playersListText = players.length > 0 
            ? players.sort((a, b) => a.number - b.number).map(p => `**${p.number}**- <@${p.id}> ${p.hasShield ? '🛡️' : ''}`).join('\n')
            : "لا يوجد لاعبين مشاركين باللعبة";

        return new EmbedBuilder()
            .setTitle('روليت 🎲')
            .setDescription(
                `**طريقة اللعب:**\n` +
                `1- اختر الرقم الذي سيمثلك في اللعبة\n` +
                `2- ستبدأ الجولة الأولى وسيتم تدوير العجلة واختيار لاعب عشوائي\n` +
                `3- إذا كنت اللاعب المختار ، فستختار لاعباً من اختيارك ليتم طرده من اللعبة\n` +
                `4- يُطرد اللاعب وتبدأ جولة جديدة حتى يتبقى الفائز النهائي\n\n` +
                `🛒 **المتجر متوفر!** يمكنك شراء درع أو طرد مزدوج أو إحياء باستخدام عملة ${CURRENCY_EMOJI}\n\n` +
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
                .setCustomId('open_shop')
                .setLabel('المتجر 🛒')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('leave_game')
                .setLabel('اخرج من اللعبة')
                .setStyle(ButtonStyle.Danger)
        );
        rows.push(controlRow);

        return rows;
    };

    let response;
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

        if (i.customId === 'open_shop') {
            let player = players.find(p => p.id === userId);
            if (!player) {
                // لاعب زائر في المتجر
                player = { id: userId, username, avatarUrl, hasShield: false, hasDouble: false, hasRevive: false };
            }
            return await openShopModal(i, player);
        }

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

        players.push({ 
            id: userId, 
            number: chosenNumber, 
            username: username, 
            avatarUrl: avatarUrl,
            hasShield: false,
            hasDouble: false,
            hasRevive: false
        });
        
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

        await runGameLoop(interaction, players, eliminatedPlayers);
    });
}

async function runGameLoop(interaction, players, eliminatedPlayers) {
    let round = 1;

    while (players.length > 1) {
        const chosenIndex = Math.floor(Math.random() * players.length);
        const chosenPlayer = players[chosenIndex];

        const sliceAngle = (2 * Math.PI) / players.length;
        const targetAngle = -(chosenIndex * sliceAngle + sliceAngle / 2);

        let wheelMsg;
        const buffer = await drawWheel(players, targetAngle, chosenPlayer.avatarUrl);
        const attachment = new AttachmentBuilder(buffer, { name: 'wheel.png' });

        if (players.length === 2) {
            const winnerEmbed = new EmbedBuilder()
                .setTitle('🏆 الفائز في اللعبة!')
                .setDescription(`توقفت العجلة عند صاحب الرقم **${chosenPlayer.number}**!\n\n🎉 **الفائز باللعبة هو:** <@${chosenPlayer.id}>`)
                .setImage('attachment://wheel.png')
                .setColor('#57F287');

            // مكافأة الفائز 100 Jenny
            addBalance(chosenPlayer.id, 100);

            if (wheelMsg) {
                await wheelMsg.edit({ embeds: [winnerEmbed], files: [attachment], components: [] });
            } else {
                await interaction.followUp({ embeds: [winnerEmbed], files: [attachment] });
            }
            return;
        }

        const targets = players.filter(p => p.id !== chosenPlayer.id);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('eliminate_select')
            .setPlaceholder(`اختر اللاعب الذي تريد طرده... ${chosenPlayer.hasDouble ? '(طرد مزدوج مفعل!)' : ''}`)
            .addOptions(
                targets.map(p => ({
                    label: `اللاعب رقم ${p.number} (${p.username}) ${p.hasShield ? '🛡️' : ''}`,
                    value: p.id,
                    description: `طرد صاحب الرقم ${p.number}`,
                    emoji: '❌'
                }))
            );

        if (chosenPlayer.hasDouble && targets.length >= 2) {
            selectMenu.setMinValues(2).setMaxValues(2);
        }

        const menuRow = new ActionRowBuilder().addComponents(selectMenu);
        const actionButtons = new ActionRowBuilder();

        if (chosenPlayer.hasRevive && eliminatedPlayers.length > 0) {
            actionButtons.addComponents(
                new ButtonBuilder()
                    .setCustomId('use_revive')
                    .setLabel('استخدام إحياء لاعب 🧟')
                    .setStyle(ButtonStyle.Success)
            );
        }

        const components = actionButtons.components.length > 0 ? [menuRow, actionButtons] : [menuRow];

        const roundEmbed = new EmbedBuilder()
            .setTitle(`🌀 الجولة ${round}`)
            .setDescription(
                `🎯 **توقفت العجلة على:** الرقم **${chosenPlayer.number}** (<@${chosenPlayer.id}>)!\n\n` +
                `**يا <@${chosenPlayer.id}>، قم باختيار اللاعب الذي تريد طرده من القائمة أدناه!**` +
                (chosenPlayer.hasDouble ? `\n\n⚡ **تنويه:** لديك ميزة **طرد مزدوج**، قم باختيار لاعبين اثنين!` : '')
            )
            .setImage('attachment://wheel.png')
            .setColor('#D4AF37');

        wheelMsg = await interaction.followUp({
            embeds: [roundEmbed],
            files: [attachment],
            components: components
        });

        try {
            const selectInteraction = await wheelMsg.awaitMessageComponent({
                filter: (i) => {
                    if (i.user.id !== chosenPlayer.id) {
                        i.reply({ content: '❌ أنت لست اللاعب المختار للقيام بالطرد!', flags: MessageFlags.Ephemeral });
                        return false;
                    }
                    return true;
                },
                time: 30_000
            });

            if (selectInteraction.customId === 'use_revive') {
                // خيار الإحياء
                chosenPlayer.hasRevive = false;
                const revivedPlayer = eliminatedPlayers.pop();
                players.push(revivedPlayer);

                const reviveEmbed = new EmbedBuilder()
                    .setTitle('🧟 إحياء لاعب!')
                    .setDescription(`قام <@${chosenPlayer.id}> بإعادة اللاعب الرقم **${revivedPlayer.number}** (<@${revivedPlayer.id}>) إلى اللعبة مرة أخرى!`)
                    .setColor('#2ECC71');

                await selectInteraction.update({ embeds: [reviveEmbed], components: [] });
                round++;
                continue;
            }

            const selectedIds = selectInteraction.values;
            let statusText = '';

            for (const eliminatedId of selectedIds) {
                const targetIndex = players.findIndex(p => p.id === eliminatedId);
                const targetPlayer = players[targetIndex];

                // التحقق من وجود درع حماية
                if (targetPlayer.hasShield) {
                    targetPlayer.hasShield = false; // استهلاك الدرع
                    statusText += `🛡️ **الرقم ${targetPlayer.number}** (<@${targetPlayer.id}>) استخدم **درع الحماية** وتم إلغاء طرده!\n`;
                } else {
                    eliminatedPlayers.push(targetPlayer);
                    players.splice(targetIndex, 1);
                    statusText += `💥 تم طرد الرقم **${targetPlayer.number}** (<@${targetPlayer.id}>)!\n`;
                }
            }

            if (chosenPlayer.hasDouble) chosenPlayer.hasDouble = false; // استهلاك الميزة

            const eliminatedEmbed = new EmbedBuilder()
                .setTitle(`💥 نتائج الجولة ${round}`)
                .setDescription(`${statusText}\nاللاعبون المتبقون: **${players.length}**`)
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
            round++;
        }
    }
}

module.exports = { executeRouletteGame, getBalance, addBalance };

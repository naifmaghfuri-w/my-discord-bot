const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    EmbedBuilder,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'labData.json');

// ==========================================
// 🧪 DATABASE & SYSTEM DATA (الموسوعة الكاملة)
// ==========================================
const labData = {
    items: {
        na: { name: 'الصوديوم (Na)', symbol: 'Na', price: 15, buyable: true, state: '🪨 صلب' },
        cl: { name: 'الكلور (Cl)', symbol: 'Cl', price: 15, buyable: true, state: '💨 غاز' },
        caco3: { name: 'حجر الجير (CaCO3)', symbol: 'CaCO3', price: 30, buyable: true, state: '🪨 صلب' },
        h2o_imp: { name: 'ماء غير نقي (H2O)', symbol: 'H2O', price: 20, buyable: true, state: '💧 سائل' },
        fe: { name: 'الحديد (Fe)', symbol: 'Fe', price: 35, buyable: true, state: '🪨 صلب' },
        o2: { name: 'الأكسجين (O2)', symbol: 'O2', price: 25, buyable: true, state: '💨 غاز' },
        h2: { name: 'الهيدروجين (H2)', symbol: 'H2', price: 25, buyable: true, state: '💨 غاز' },
        so2: { name: 'ثاني أكسيد الكبريت (SO2)', symbol: 'SO2', price: 40, buyable: true, state: '💨 غاز' },
        cu: { name: 'النحاس (Cu)', symbol: 'Cu', price: 50, buyable: true, state: '🪨 صلب' },
        hno3: { name: 'حمض النيتريك (HNO3)', symbol: 'HNO3', price: 75, buyable: true, state: '💧 سائل' },
        nacl: { name: 'ملح الطعام (NaCl)', symbol: 'NaCl', price: 50, buyable: false, state: '🪨 صلب' },
        h2o_pure: { name: 'ماء نقي 💧', symbol: 'H2O', price: 45, buyable: false, state: '💧 سائل' },
        secret_compound: { name: 'المركب السري ✨', symbol: 'X', price: 2500, buyable: false, state: '✨ طاقة' }
    },
    equipment: {
        beaker: { name: 'وعاء التفاعل (Beaker)', reqLevel: 1, price: 100 },
        electrolysis: { name: 'جهاز التحليل الكهربائي', reqLevel: 2, price: 200 }
    },
    reactions: [
        { id: 'r_nacl', name: 'تخليق ملح الطعام (NaCl)', tool: 'beaker', reqLevel: 1, costAbility: 1, req: { na: 1, cl: 1 }, targetTemp: 25, targetPress: 1, timeSec: 10, yield: { nacl: 1 }, xp: 25 },
        { id: 'r_h2o_purify', name: 'تنقية المياه (H2O)', tool: 'beaker', reqLevel: 1, costAbility: 1, req: { h2o_imp: 1 }, targetTemp: 110, targetPress: 1, timeSec: 15, yield: { h2o_pure: 1 }, xp: 30 },
        { id: 'r_elec_water', name: 'تحليل الماء كهربائياً', tool: 'electrolysis', reqLevel: 2, costAbility: 2, req: { h2o_pure: 2 }, targetTemp: 25, targetPress: 2, timeSec: 25, yield: { h2: 2, o2: 1 }, xp: 60 }
    ]
};

const TEMP_STEPS = [25, 110, 500, 900];
const PRESS_STEPS = [1, 2, 3];

function getPlayerData(userId) {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }

    if (!db[userId]) {
        db[userId] = {
            level: 1, xp: 0, coins: 300, abilityPoints: 3,
            unlockedReactions: ['r_nacl', 'r_h2o_purify', 'r_elec_water'],
            ownedEquipment: { beaker: 1, electrolysis: 1 },
            inv: { na: 5, cl: 5, h2o_imp: 5, h2o_pure: 2 },
            codex: ['na', 'cl', 'h2o_imp', 'h2o_pure'], 
            pendingQueue: []
        };
        fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    }
    return db[userId];
}

function updatePlayerData(userId, data) {
    let db = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    db[userId] = data;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
}

// ==========================================
// 🎨 EMBED ENGINE (واجهات تفاعلية خفيفة)
// ==========================================
function renderLabEmbed(user, player, screenType, extraData = {}) {
    const embed = new EmbedBuilder().setTimestamp();

    if (screenType === 'main') {
        let queueText = player.pendingQueue.length === 0 ? 'لا يوجد تفاعل شغال حالياً.' : '';
        player.pendingQueue.forEach((q, idx) => {
            const r = labData.reactions.find(x => x.id === q.reactionId);
            const left = Math.max(0, Math.ceil((q.finishAt - Date.now()) / 1000));
            queueText += `${idx + 1}. **${r?.name}**: ${left === 0 ? 'مكتمل! ✅' : left + ' ثانية ⏳'}\n`;
        });

        embed
            .setTitle('⚗️ مركز التحكم بالمعمل الكيميائي')
            .setColor(0x66FCF1)
            .setDescription(`مرحباً بك **${user.username}** في معملك الخاص!`)
            .addFields(
                { name: '📊 الإحصائيات العامة', value: `👤 **المستوى:** ${player.level} (${player.xp} XP)\n🪙 **العملات:** ${player.coins}\n⚡ **نقاط AP:** ${player.abilityPoints}`, inline: true },
                { name: '📖 التقدم', value: `🧪 **الموسوعة:** ${player.codex.length}/${Object.keys(labData.items).length}\n🔬 **التفاعلات:** ${player.unlockedReactions.length}\n⚙️ **الأجهزة:** ${Object.keys(player.ownedEquipment).length}`, inline: true },
                { name: '⏳ طابور العمليات (Queue)', value: queueText, inline: false }
            );
    } 
    else if (screenType === 'inv') {
        let invText = '';
        for (const [id, qty] of Object.entries(player.inv)) {
            const item = labData.items[id];
            invText += `• **${item?.name || id}** (${item?.symbol || 'Chem'}): x${qty}\n`;
        }
        embed
            .setTitle('🎒 مستودع المواد والمعدات')
            .setColor(0x3498DB)
            .setDescription(invText || 'المستودع فارغ حالياً.');
    } 
    else if (screenType === 'codex') {
        let codexText = '';
        for (const [id, item] of Object.entries(labData.items)) {
            const isUnlocked = player.codex.includes(id);
            if (isUnlocked) {
                codexText += `🟢 **${item.name}** [${item.symbol}] - ${item.state}\n`;
            } else {
                codexText += `🔒 **غير مكتشف** (???)\n`;
            }
        }
        embed
            .setTitle('📖 موسوعة العناصر الكيميائية')
            .setColor(0x9B59B6)
            .setDescription(codexText);
    } 
    else if (screenType === 'calib') {
        const { reaction, currentTemp, currentPress } = extraData;
        embed
            .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
            .setColor(0xE74C3C)
            .addFields(
                { name: '🔥 الحرارة الحالية', value: `\`${currentTemp} °C\``, inline: true },
                { name: '💨 الضغط الحالي', value: `\`${currentPress} atm\``, inline: true },
                { name: '⚙️ الجهاز المطلوب', value: `${labData.equipment[reaction.tool]?.name || reaction.tool}`, inline: true },
                { name: '⚡ تكلفة AP', value: `${reaction.costAbility}`, inline: true }
            );
    }

    return embed;
}

// ==========================================
// 🕹️ LAB SESSION & CONTROLLERS
// ==========================================
async function handleLabSession(context, user) {
    let player = getPlayerData(user.id);
    let selectedReaction = labData.reactions[0];

    const embed = renderLabEmbed(user, player, 'main');

    const rowNav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_lab').setLabel('المختبر والتفاعلات').setEmoji('🧪').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_codex').setLabel('الموسوعة').setEmoji('📖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_claim_queue').setLabel('استلام التفاعلات').setEmoji('✅').setStyle(ButtonStyle.Success)
    );

    const initialMsg = { embeds: [embed], components: [rowNav] };

    let responseMsg = context.replied || context.deferred 
        ? await context.followUp({ ...initialMsg, fetchReply: true })
        : await context.reply({ ...initialMsg, fetchReply: true });

    const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

    let tempIndex = 0;
    let pressIndex = 0;

    collector.on('collect', async i => {
        if (i.user.id !== user.id) {
            return i.reply({ content: '❌ هذه الواجهة ليست لك!', flags: MessageFlags.Ephemeral });
        }

        player = getPlayerData(user.id);

        if (i.customId === 'btn_back_main') {
            const emb = renderLabEmbed(user, player, 'main');
            return await i.update({ embeds: [emb], components: [rowNav] });
        }

        if (i.customId === 'btn_open_inv') {
            const emb = renderLabEmbed(user, player, 'inv');
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Danger)
            );
            return await i.update({ embeds: [emb], components: [backRow] });
        }

        if (i.customId === 'btn_open_codex') {
            const emb = renderLabEmbed(user, player, 'codex');
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Danger)
            );
            return await i.update({ embeds: [emb], components: [backRow] });
        }

        if (i.customId === 'btn_open_lab') {
            const emb = renderLabEmbed(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });

            const selectOptions = player.unlockedReactions.map(rId => {
                const r = labData.reactions.find(x => x.id === rId);
                return new StringSelectMenuOptionBuilder()
                    .setLabel(r.name)
                    .setValue(r.id)
                    .setDescription(`يحتاج ${r.costAbility} AP | الجهاز: ${r.tool}`);
            });

            const selectRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_reaction')
                    .setPlaceholder('اختر التفاعل المطلوب...')
                    .addOptions(selectOptions)
            );

            const calibRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_temp_up').setLabel('🔥 تغيير الحرارة').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_press_up').setLabel('💨 تغيير الضغط').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_start_mix').setLabel('⚗️ بدء التفاعل').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ إلغاء').setStyle(ButtonStyle.Danger)
            );

            return await i.update({ embeds: [emb], components: [selectRow, calibRow] });
        }

        if (i.customId === 'select_reaction') {
            const chosenId = i.values[0];
            selectedReaction = labData.reactions.find(r => r.id === chosenId);

            const emb = renderLabEmbed(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });
            return await i.update({ embeds: [emb] });
        }

        if (i.customId === 'btn_temp_up') {
            tempIndex = (tempIndex + 1) % TEMP_STEPS.length;
            const emb = renderLabEmbed(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });
            return await i.update({ embeds: [emb] });
        }

        if (i.customId === 'btn_press_up') {
            pressIndex = (pressIndex + 1) % PRESS_STEPS.length;
            const emb = renderLabEmbed(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });
            return await i.update({ embeds: [emb] });
        }

        if (i.customId === 'btn_start_mix') {
            if (player.abilityPoints < selectedReaction.costAbility) {
                return i.reply({ content: '❌ لا تملك نقاط قدرة (AP) كافية!', flags: MessageFlags.Ephemeral });
            }

            for (const [mat, qty] of Object.entries(selectedReaction.req)) {
                if ((player.inv[mat] || 0) < qty) {
                    return i.reply({ content: `❌ لا تملك كمية كافية من ${labData.items[mat]?.name || mat}!`, flags: MessageFlags.Ephemeral });
                }
            }

            for (const [mat, qty] of Object.entries(selectedReaction.req)) {
                player.inv[mat] -= qty;
                if (player.inv[mat] <= 0) delete player.inv[mat];
            }

            player.abilityPoints -= selectedReaction.costAbility;
            const isCorrect = (TEMP_STEPS[tempIndex] === selectedReaction.targetTemp) && (PRESS_STEPS[pressIndex] === selectedReaction.targetPress);
            const duration = isCorrect ? selectedReaction.timeSec * 1000 : (selectedReaction.timeSec * 1.5) * 1000;

            player.pendingQueue.push({
                reactionId: selectedReaction.id,
                finishAt: Date.now() + duration
            });

            updatePlayerData(user.id, player);

            const emb = renderLabEmbed(user, player, 'main');
            await i.reply({ content: `✅ تم بدء تفاعل **${selectedReaction.name}** بنجاح!`, flags: MessageFlags.Ephemeral });
            return await responseMsg.edit({ embeds: [emb], components: [rowNav] });
        }

        if (i.customId === 'btn_claim_queue') {
            const now = Date.now();
            const readyItems = player.pendingQueue.filter(q => q.finishAt <= now);

            if (readyItems.length === 0) {
                return i.reply({ content: '⏳ لا توجد تفاعلات مكتملة جاهزة للاستلام بعد!', flags: MessageFlags.Ephemeral });
            }

            let summaryMsg = '🎉 **تم استلام النواتج:**\n';

            readyItems.forEach(q => {
                const reaction = labData.reactions.find(r => r.id === q.reactionId);
                if (reaction) {
                    for (const [yItem, yQty] of Object.entries(reaction.yield)) {
                        player.inv[yItem] = (player.inv[yItem] || 0) + yQty;
                        if (!player.codex.includes(yItem)) player.codex.push(yItem);
                        summaryMsg += `• ${labData.items[yItem]?.name || yItem} x${yQty}\n`;
                    }
                    player.xp += reaction.xp;
                }
            });

            player.pendingQueue = player.pendingQueue.filter(q => q.finishAt > now);
            updatePlayerData(user.id, player);

            const emb = renderLabEmbed(user, player, 'main');
            await i.reply({ content: summaryMsg, flags: MessageFlags.Ephemeral });
            return await responseMsg.edit({ embeds: [emb], components: [rowNav] });
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lab')
        .setDescription('نظام المعمل الكيميائي المتكامل (نسخة Embeds السريعة الخفيفة)'),

    async execute(interaction) {
        await handleLabSession(interaction, interaction.user);
    }
};

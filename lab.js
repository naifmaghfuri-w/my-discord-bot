const { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder,
    MessageFlags
} = require('discord.js');
const { createCanvas } = require('@napi-rs/canvas');
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
// 🎨 CANVAS ENGINE (رسام الواجهة الموسعة)
// ==========================================
async function renderLabCanvas(user, player, screenType, extraData = {}) {
    const canvas = createCanvas(800, 480);
    const ctx = canvas.getContext('2d');

    // الخلفية العامة
    ctx.fillStyle = '#0B0C10';
    ctx.fillRect(0, 0, 800, 480);

    // شبكة خلفية
    ctx.strokeStyle = '#1F2833';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 480); ctx.stroke(); }
    for (let y = 0; y < 480; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(800, y); ctx.stroke(); }

    // Header Status Bar
    ctx.fillStyle = '#1F2833';
    ctx.roundRect(20, 15, 760, 60, 10);
    ctx.fill();

    ctx.fillStyle = '#66FCF1';
    ctx.font = 'bold 18px Sans';
    ctx.fillText(`🧪 ${user.username}`, 40, 50);

    ctx.fillStyle = '#45A29E';
    ctx.font = '15px Sans';
    ctx.fillText(`LVL ${player.level}`, 480, 50);

    ctx.fillStyle = '#F1C40F';
    ctx.fillText(`🪙 ${player.coins}`, 570, 50);

    ctx.fillStyle = '#E74C3C';
    ctx.fillText(`⚡ ${player.abilityPoints} AP`, 670, 50);

    // XP Bar
    const xpPercent = Math.min(player.xp / (player.level * 100), 1);
    ctx.fillStyle = '#0B0C10';
    ctx.roundRect(180, 38, 270, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#66FCF1';
    ctx.roundRect(180, 38, 270 * xpPercent, 8, 4);
    ctx.fill();

    // ================= SHOT: MAIN =================
    if (screenType === 'main') {
        ctx.fillStyle = '#1F2833';
        ctx.roundRect(20, 90, 760, 370, 12);
        ctx.fill();

        ctx.fillStyle = '#66FCF1';
        ctx.font = 'bold 24px Sans';
        ctx.fillText('مرحباً بك في مركز التحكم بالمعمل ⚗️', 40, 135);

        ctx.fillStyle = '#C5C6C7';
        ctx.font = '15px Sans';
        ctx.fillText(`• الإنجاز بالموسوعة الكيميائية: ${player.codex.length} / ${Object.keys(labData.items).length}`, 40, 185);
        ctx.fillText(`• التفاعلات المتاحة: ${player.unlockedReactions.length}`, 40, 220);
        ctx.fillText(`• الأجهزة التي تمتلكها: ${Object.keys(player.ownedEquipment).length}`, 40, 255);
        ctx.fillText(`• النقاط المتاحة للتفاعل (AP): ${player.abilityPoints}`, 40, 290);

        // لوحة طابور العمليات
        ctx.fillStyle = '#0B0C10';
        ctx.roundRect(430, 120, 330, 310, 10);
        ctx.fill();

        ctx.fillStyle = '#F1C40F';
        ctx.font = 'bold 16px Sans';
        ctx.fillText('⏳ قائمة التفاعلات الحالية (Queue)', 450, 155);

        let qY = 195;
        if (player.pendingQueue.length === 0) {
            ctx.fillStyle = '#C5C6C7';
            ctx.font = '14px Sans';
            ctx.fillText('لا يوجد تفاعل شغال حالياً.', 450, qY);
        } else {
            player.pendingQueue.forEach((q, idx) => {
                const r = labData.reactions.find(x => x.id === q.reactionId);
                const left = Math.max(0, Math.ceil((q.finishAt - Date.now()) / 1000));
                ctx.fillStyle = left === 0 ? '#2ECC71' : '#E67E22';
                ctx.font = '13px Sans';
                ctx.fillText(`${idx + 1}. ${r?.name}: ${left === 0 ? 'مكتمل! ✅' : left + ' ثانية ⏳'}`, 450, qY);
                qY += 35;
            });
        }
    }

    // ================= SHOT: INVENTORY =================
    else if (screenType === 'inv') {
        ctx.fillStyle = '#1F2833';
        ctx.roundRect(20, 90, 760, 370, 12);
        ctx.fill();

        ctx.fillStyle = '#66FCF1';
        ctx.font = 'bold 22px Sans';
        ctx.fillText('🎒 مستودع المواد والمعدات', 40, 130);

        let xPos = 40, yPos = 160, count = 0;
        for (const [id, qty] of Object.entries(player.inv)) {
            const item = labData.items[id];
            ctx.fillStyle = '#0B0C10';
            ctx.roundRect(xPos, yPos, 170, 70, 8);
            ctx.fill();

            ctx.fillStyle = '#E74C3C';
            ctx.font = 'bold 14px Sans';
            ctx.fillText(item?.symbol || 'Chem', xPos + 10, yPos + 25);

            ctx.fillStyle = '#FFFFFF';
            ctx.font = '12px Sans';
            ctx.fillText(item?.name || id, xPos + 10, yPos + 45);

            ctx.fillStyle = '#F1C40F';
            ctx.font = 'bold 14px Sans';
            ctx.fillText(`x${qty}`, xPos + 130, yPos + 60);

            xPos += 185; count++;
            if (count % 4 === 0) { xPos = 40; yPos += 80; }
        }
    }

    // ================= SHOT: CODEX =================
    else if (screenType === 'codex') {
        ctx.fillStyle = '#1F2833';
        ctx.roundRect(20, 90, 760, 370, 12);
        ctx.fill();

        ctx.fillStyle = '#66FCF1';
        ctx.font = 'bold 22px Sans';
        ctx.fillText('📖 موسوعة العناصر والتفاعلات الكيميائية', 40, 130);

        let xPos = 40, yPos = 160, count = 0;
        for (const [id, item] of Object.entries(labData.items)) {
            const isUnlocked = player.codex.includes(id);

            ctx.fillStyle = isUnlocked ? '#0B0C10' : '#15171C';
            ctx.roundRect(xPos, yPos, 170, 70, 8);
            ctx.fill();

            if (isUnlocked) {
                ctx.fillStyle = '#2ECC71';
                ctx.font = 'bold 14px Sans';
                ctx.fillText(item.symbol, xPos + 10, yPos + 25);

                ctx.fillStyle = '#FFFFFF';
                ctx.font = '12px Sans';
                ctx.fillText(item.name, xPos + 10, yPos + 45);

                ctx.fillStyle = '#C5C6C7';
                ctx.font = '11px Sans';
                ctx.fillText(item.state, xPos + 10, yPos + 60);
            } else {
                ctx.fillStyle = '#7F8C8D';
                ctx.font = 'bold 15px Sans';
                ctx.fillText('❓ غير مكتشف', xPos + 25, yPos + 42);
            }

            xPos += 185; count++;
            if (count % 4 === 0) { xPos = 40; yPos += 80; }
        }
    }

    // ================= SHOT: CALIBRATION =================
    else if (screenType === 'calib') {
        const { reaction, currentTemp, currentPress } = extraData;

        ctx.fillStyle = '#1F2833';
        ctx.roundRect(20, 90, 760, 370, 12);
        ctx.fill();

        ctx.fillStyle = '#E74C3C';
        ctx.font = 'bold 22px Sans';
        ctx.fillText(`🎛️ معايرة التفاعل: ${reaction.name}`, 40, 130);

        // الحرارة
        ctx.fillStyle = '#0B0C10';
        ctx.roundRect(50, 160, 330, 210, 10);
        ctx.fill();

        ctx.fillStyle = '#E74C3C';
        ctx.font = 'bold 18px Sans';
        ctx.fillText(`🔥 الحرارة الحالية: ${currentTemp} °C`, 70, 200);

        const tempPercent = currentTemp / 900;
        ctx.fillStyle = '#1F2833';
        ctx.fillRect(70, 230, 290, 20);
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(70, 230, 290 * tempPercent, 20);

        // الضغط
        ctx.fillStyle = '#0B0C10';
        ctx.roundRect(420, 160, 330, 210, 10);
        ctx.fill();

        ctx.fillStyle = '#3498DB';
        ctx.font = 'bold 18px Sans';
        ctx.fillText(`💨 الضغط الحالي: ${currentPress} atm`, 440, 200);

        const pressPercent = currentPress / 3;
        ctx.fillStyle = '#1F2833';
        ctx.fillRect(440, 230, 290, 20);
        ctx.fillStyle = '#3498DB';
        ctx.fillRect(440, 230, 290 * pressPercent, 20);
    }

    const buffer = await canvas.encode('png');
    return new AttachmentBuilder(buffer, { name: 'lab-screen.png' });
}

// ==========================================
// 🕹️ LAB SESSION & CONTROLLERS
// ==========================================
async function handleLabSession(context, user) {
    let player = getPlayerData(user.id);
    let selectedReaction = labData.reactions[0];

    const imageAttachment = await renderLabCanvas(user, player, 'main');

    const rowNav = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_lab').setLabel('المختبر والتفاعلات').setEmoji('🧪').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_codex').setLabel('الموسوعة').setEmoji('📖').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_claim_queue').setLabel('استلام التفاعلات').setEmoji('✅').setStyle(ButtonStyle.Success)
    );

    const initialMsg = { files: [imageAttachment], components: [rowNav] };

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
            const img = await renderLabCanvas(user, player, 'main');
            return await i.update({ files: [img], components: [rowNav] });
        }

        if (i.customId === 'btn_open_inv') {
            const img = await renderLabCanvas(user, player, 'inv');
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Danger)
            );
            return await i.update({ files: [img], components: [backRow] });
        }

        if (i.customId === 'btn_open_codex') {
            const img = await renderLabCanvas(user, player, 'codex');
            const backRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Danger)
            );
            return await i.update({ files: [img], components: [backRow] });
        }

        // --- فتح المعمل مع قائمة اختيار التفاعل (Reaction Selector) ---
        if (i.customId === 'btn_open_lab') {
            const img = await renderLabCanvas(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });

            // إنشاء قائمة الاختيار من التفاعلات المفتوحة للاعب
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

            return await i.update({ files: [img], components: [selectRow, calibRow] });
        }

        // --- اختيار تفاعل من القائمة ---
        if (i.customId === 'select_reaction') {
            const chosenId = i.values[0];
            selectedReaction = labData.reactions.find(r => r.id === chosenId);

            const img = await renderLabCanvas(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });
            return await i.update({ files: [img] });
        }

        // --- التحكم في المعايرة ---
        if (i.customId === 'btn_temp_up') {
            tempIndex = (tempIndex + 1) % TEMP_STEPS.length;
            const img = await renderLabCanvas(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });
            return await i.update({ files: [img] });
        }

        if (i.customId === 'btn_press_up') {
            pressIndex = (pressIndex + 1) % PRESS_STEPS.length;
            const img = await renderLabCanvas(user, player, 'calib', {
                reaction: selectedReaction,
                currentTemp: TEMP_STEPS[tempIndex],
                currentPress: PRESS_STEPS[pressIndex]
            });
            return await i.update({ files: [img] });
        }

        // --- بدء التفاعل ---
        if (i.customId === 'btn_start_mix') {
            if (player.abilityPoints < selectedReaction.costAbility) {
                return i.reply({ content: '❌ لا تملك نقاط قدرة (AP) كافية!', flags: MessageFlags.Ephemeral });
            }

            for (const [mat, qty] of Object.entries(selectedReaction.req)) {
                if ((player.inv[mat] || 0) < qty) {
                    return i.reply({ content: `❌ لا تملك كمية كافية من ${labData.items[mat]?.name || mat}!`, flags: MessageFlags.Ephemeral });
                }
            }

            // تخصيم المواد والـ AP
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

            const img = await renderLabCanvas(user, player, 'main');
            await i.reply({ content: `✅ تم بدء تفاعل **${selectedReaction.name}** بنجاح!`, flags: MessageFlags.Ephemeral });
            return await responseMsg.edit({ files: [img], components: [rowNav] });
        }

        // --- استلام التفاعلات الجاهزة ---
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

            const img = await renderLabCanvas(user, player, 'main');
            await i.reply({ content: summaryMsg, flags: MessageFlags.Ephemeral });
            return await responseMsg.edit({ files: [img], components: [rowNav] });
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lab')
        .setDescription('نظام المعمل الكيميائي المتكامل بالصور والقوائم العريضة'),

    async execute(interaction) {
        await handleLabSession(interaction, interaction.user);
    }
};


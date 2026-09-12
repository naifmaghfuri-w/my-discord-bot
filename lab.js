const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'labData.json');

const labData = {
    items: {
        na: { name: 'الصوديوم (Na)', price: 15, buyable: true, state: '🪨 صلب' },
        cl: { name: 'الكلور (Cl)', price: 15, buyable: true, state: '💨 غاز' },
        caco3: { name: 'حجر الجير (CaCO3)', price: 30, buyable: true, state: '🪨 صلب' },
        h2o_imp: { name: 'ماء غير نقي (H2O)', price: 20, buyable: true, state: '💧 سائل' },
        fe: { name: 'الحديد (Fe)', price: 35, buyable: true, state: '🪨 صلب' },
        o2: { name: 'الأكسجين (O2)', price: 25, buyable: true, state: '💨 غاز' },
        h2: { name: 'الهيدروجين (H2)', price: 25, buyable: true, state: '💨 غاز' },
        
        nacl: { name: 'ملح الطعام (NaCl)', price: 50, buyable: false, state: '🪨 صلب', desc: 'مركب أيوني ناتج من تفاعل الصوديوم والكلور.' },
        cao: { name: 'الجير الحي (CaO)', price: 80, buyable: false, state: '🪨 صلب', desc: 'ينتج عن التفكك الحراري لحجر الجير.' },
        co2: { name: 'ثاني أكسيد الكربون (CO2)', price: 40, buyable: false, state: '💨 غاز', desc: 'غاز ينطلق كناتج ثانوي.' },
        h2o_pure: { name: 'ماء نقي 💧 (Pure H2O)', price: 45, buyable: false, state: '💧 سائل', desc: 'ماء مقطر عالي النقاوة.' },
        fe2o3: { name: 'أكسيد الحديد (Fe2O3)', price: 90, buyable: false, state: '🪨 صلب', desc: 'مركب ناتج من أكسدة الحديد العالية.' },
        h2so4: { name: 'حمض الكبريتيك (H2SO4)', price: 150, buyable: false, state: '💧 سائل', desc: 'حمض شديد التآكل.' }
    },
    equipment: {
        beaker: { name: 'وعاء التفاعل (Beaker)', reqLevel: 1 },
        electrolysis: { name: 'جهاز التحليل الكهربائي', reqLevel: 2 },
        still: { name: 'جهاز التقطير (Distillation)', reqLevel: 3 },
        combustion: { name: 'مفاعل الأكسدة', reqLevel: 4 },
        furnace: { name: 'الفرن الحراري (Furnace)', reqLevel: 5 }
    },
    upgrades: {
        speed: { name: '⚡ المسرع الكيميائي (سرعة x2)', price: 200, desc: 'يخفض زمن التفاعلات 50%' },
        shield: { name: '🛡️ درع الحماية من الانفجار', price: 150, desc: 'يحميك من خسارة المواد عند الخطأ' }
    },
    reactions: [
        { id: 'r_nacl', name: '🧪 تخليق ملح الطعام (NaCl)', tool: 'beaker', req: { na: 1, cl: 1 }, targetTemp: 25, targetPress: 1, timeSec: 10, yield: { nacl: 1 }, xp: 25 },
        { id: 'r_electrolysis_h2o', name: '⚡ تحليل الماء كهروبيائياً (H2 + O2)', tool: 'electrolysis', req: { h2o_imp: 2 }, targetTemp: 25, targetPress: 1, timeSec: 12, yield: { h2: 2, o2: 1 }, xp: 40 },
        { id: 'r_h2o', name: '💧 تنقية وتقطير الماء (H2O)', tool: 'still', req: { h2o_imp: 1 }, targetTemp: 110, targetPress: 1, timeSec: 15, yield: { h2o_pure: 1 }, xp: 35 },
        { id: 'r_fe2o3', name: '🔥 أكسدة الحديد وتكوين أكسيد الحديد', tool: 'combustion', req: { fe: 2, o2: 1 }, targetTemp: 500, targetPress: 2, timeSec: 18, yield: { fe2o3: 1 }, xp: 70 },
        { id: 'r_cao', name: '🔥 التفكك الحراري لحجر الجير', tool: 'furnace', req: { caco3: 1 }, targetTemp: 900, targetPress: 1, timeSec: 20, yield: { cao: 1, co2: 1 }, xp: 60 }
    ]
};

function getRankTitle(level) {
    if (level >= 5) return '👑 عالم كيمياء رئيسي';
    if (level >= 4) return '🔥 خبير أكسدة واحتراق';
    if (level >= 3) return '🔬 خبير تقطير وتحليل';
    if (level >= 2) return '⚡ فني تحليل كهربائي';
    return '🥼 مساعد مختبر مستجد';
}

function ensureDataFile() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
}

function getPlayerData(userId) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }

    if (!db[userId]) {
        db[userId] = {
            level: 1, xp: 0, coins: 200,
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1 },
            codex: [], upgrades: { speed: false, shield: false },
            quest: { item: 'h2o_pure', count: 2, progress: 0, rewardCoins: 100, rewardXp: 50, completed: false },
            pendingQueue: []
        };
        fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    }
    return db[userId];
}

function updatePlayerData(userId, data) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }
    db[userId] = data;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
}

function buildMainMenu(user, player) {
    const rank = getRankTitle(player.level);
    const embed = new EmbedBuilder()
        .setTitle('🧪 مختبر الكيمياء المتقدم | Ultimate Lab v2.5')
        .setDescription(`مرحباً بك **${user.username}** 👋\nالرتبة العلمية: **${rank}**`)
        .setColor(0x2ecc71)
        .addFields(
            { name: '👤 المستوى', value: `\`Lv.${player.level}\``, inline: true },
            { name: '✨ الخبرة', value: `\`${player.xp} / ${player.level * 100} XP\``, inline: true },
            { name: '💰 Valence', value: `\`${player.coins} 🪙\``, inline: true },
            { name: '📘 الموسوعة الكيميائية', value: `\`${player.codex.length} / 6 مكتشفات\``, inline: true },
            { name: '🛡️ الحماية', value: player.upgrades.shield ? '`مفعل ✅`' : '`غير مفعل ❌`', inline: true },
            { name: '⚡ السرعة', value: player.upgrades.speed ? '`مضاعفة 2x ⚡`' : '`عادية 1x`', inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: 'انقر على الأزرار للتنقل المباشر' });

    if (player.pendingQueue && player.pendingQueue.length > 0) {
        embed.addFields({ name: '⏳ تفاعلات قيد التشغيل', value: `عدد التفاعلات الجارية: **${player.pendingQueue.length}**` });
    }

    const reactionOptions = labData.reactions.map(r => {
        const reqEquipment = labData.equipment[r.tool];
        return {
            label: r.name,
            description: `الجهاز: ${reqEquipment.name} (طلب Lv.${reqEquipment.reqLevel})`,
            value: r.id,
            disabled: player.level < reqEquipment.reqLevel
        };
    });

    const reactionSelect = new StringSelectMenuBuilder()
        .setCustomId('select_reaction')
        .setPlaceholder('⚗️ اختر تفاعلاً كيميائياً للمعايرة...')
        .addOptions(reactionOptions);

    const row1 = new ActionRowBuilder().addComponents(reactionSelect);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_shop').setLabel('المتجر والترقيات').setEmoji('🛒').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_open_codex').setLabel('الموسوعة').setEmoji('📘').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_quest').setLabel('المهام').setEmoji('📜').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_sell_all').setLabel('بيع النواتج').setEmoji('💵').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

async function handleLabSession(context, user) {
    let player = getPlayerData(user.id);
    const channel = context.channel;
    const currentNow = Math.floor(Date.now() / 1000);

    // معالجة التفاعلات المكتملة
    if (player.pendingQueue && player.pendingQueue.length > 0) {
        let updatedQueue = [];
        for (const task of player.pendingQueue) {
            if (currentNow >= task.busyUntil) {
                for (const [itemId, qty] of Object.entries(task.yield)) {
                    player.inv[itemId] = (player.inv[itemId] || 0) + qty;
                    if (!player.codex.includes(itemId)) player.codex.push(itemId);
                    if (!player.quest.completed && player.quest.item === itemId) player.quest.progress += qty;
                }
                player.xp += task.xp;
                if (player.xp >= player.level * 100) {
                    player.level += 1;
                    player.xp -= player.level * 100;
                }
            } else {
                updatedQueue.push(task);
            }
        }
        player.pendingQueue = updatedQueue;
        updatePlayerData(user.id, player);
    }

    const initialMenu = buildMainMenu(user, player);
    let responseMsg;

    if (context.replied || context.deferred) {
        responseMsg = await context.followUp({ ...initialMenu, fetchReply: true });
    } else if (context.isCommand && context.isCommand()) {
        responseMsg = await context.reply({ ...initialMenu, fetchReply: true });
    } else {
        responseMsg = await context.reply(initialMenu);
    }

    let selectedReactionId = null;
    let currentTemp = 25;
    let currentPress = 1;

    const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return i.reply({ content: '❌ اللوحة غير مخصصة لك!', ephemeral: true });

        player = getPlayerData(user.id);

        const backBtnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('الرجوع للقائمة الرئيسية ↩️').setStyle(ButtonStyle.Danger)
        );

        if (i.customId === 'btn_back_main') {
            return await i.update(buildMainMenu(user, player));
        }

        if (i.customId === 'btn_open_inv') {
            const invList = Object.keys(player.inv).length > 0 
                ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``).join('\n')
                : '_المستودع فارغ حالياً_';

            const invEmbed = new EmbedBuilder()
                .setTitle(`🎒 مستودع المواد - ${user.username}`)
                .setDescription(invList)
                .setColor(0x3498db);

            return await i.update({ embeds: [invEmbed], components: [backBtnRow] });
        }

        if (i.customId === 'btn_open_codex') {
            const allProducts = ['nacl', 'cao', 'co2', 'h2o_pure', 'fe2o3', 'h2so4'];
            const codexList = allProducts.map(id => {
                const item = labData.items[id];
                return player.codex.includes(id)
                    ? `✅ **${item.name}**\n└ _${item.desc}_`
                    : `🔒 **مركب غامض لم يكتشف بعد**`;
            }).join('\n\n');

            const codexEmbed = new EmbedBuilder()
                .setTitle('📘 موسوعة الاكتشافات الكيميائية')
                .setDescription(`نسبة الاكتشاف: **${player.codex.length} / ${allProducts.length}**\n\n${codexList}`)
                .setColor(0x9b59b6);

            return await i.update({ embeds: [codexEmbed], components: [backBtnRow] });
        }

        if (i.customId === 'btn_open_quest') {
            const q = player.quest;
            const itemNeeded = labData.items[q.item];
            
            const questEmbed = new EmbedBuilder()
                .setTitle('📜 المهام اليومية')
                .addFields(
                    { name: '🎯 المطلوب', value: `إنتاج **${q.count}x ${itemNeeded.name}**`, inline: true },
                    { name: '📊 التقدم الحالي', value: `\`${q.progress} / ${q.count}\``, inline: true },
                    { name: '🎁 المكافأة', value: `\`+${q.rewardCoins} Valence\` | \`+${q.rewardXp} XP\``, inline: true }
                )
                .setColor(0xe67e22);

            const claimBtn = new ButtonBuilder()
                .setCustomId('btn_claim_quest')
                .setLabel('تسليم المهمة')
                .setStyle(ButtonStyle.Success)
                .setDisabled(q.completed || q.progress < q.count);

            const questRow = new ActionRowBuilder().addComponents(claimBtn, backBtnRow.components[0]);
            return await i.update({ embeds: [questEmbed], components: [questRow] });
        }

        if (i.customId === 'btn_claim_quest') {
            if (player.quest.progress >= player.quest.count && !player.quest.completed) {
                player.coins += player.quest.rewardCoins;
                player.xp += player.quest.rewardXp;
                player.quest.completed = true;
                updatePlayerData(user.id, player);
                return await i.update(buildMainMenu(user, player));
            }
        }

        if (i.customId === 'btn_open_shop') {
            const shopOptions = Object.entries(labData.items)
                .filter(([_, item]) => item.buyable)
                .map(([id, item]) => ({ label: item.name, description: `السعر: ${item.price} Valence`, value: `item_${id}` }));

            if (!player.upgrades.speed) shopOptions.push({ label: labData.upgrades.speed.name, description: `السعر: ${labData.upgrades.speed.price} Valence`, value: 'up_speed' });
            if (!player.upgrades.shield) shopOptions.push({ label: labData.upgrades.shield.name, description: `السعر: ${labData.upgrades.shield.price} Valence`, value: 'up_shield' });

            const shopSelect = new StringSelectMenuBuilder().setCustomId('select_shop_all').setPlaceholder('🛒 اختر لشراء مادة أو ترقية...').addOptions(shopOptions);
            const shopEmbed = new EmbedBuilder().setTitle('🛒 المتجر والترقيات').setDescription(`رصيدك الحالي: **${player.coins} Valence** 🪙`).setColor(0xf1c40f);

            return await i.update({ embeds: [shopEmbed], components: [new ActionRowBuilder().addComponents(shopSelect), backBtnRow] });
        }

        if (i.isStringSelectMenu() && i.customId === 'select_shop_all') {
            const val = i.values[0];
            if (val.startsWith('item_')) {
                const itemId = val.replace('item_', '');
                const item = labData.items[itemId];
                if (player.coins >= item.price) {
                    player.coins -= item.price;
                    player.inv[itemId] = (player.inv[itemId] || 0) + 1;
                    updatePlayerData(user.id, player);
                }
            } else if (val.startsWith('up_')) {
                const upKey = val.replace('up_', '');
                const upItem = labData.upgrades[upKey];
                if (player.coins >= upItem.price) {
                    player.coins -= upItem.price;
                    player.upgrades[upKey] = true;
                    updatePlayerData(user.id, player);
                }
            }
            return await i.update(buildMainMenu(user, player));
        }

        if (i.customId === 'btn_sell_all') {
            let totalEarned = 0;
            ['nacl', 'cao', 'co2', 'h2o_pure', 'fe2o3', 'h2so4'].forEach(id => {
                if (player.inv[id]) {
                    totalEarned += player.inv[id] * labData.items[id].price;
                    delete player.inv[id];
                }
            });
            player.coins += totalEarned;
            updatePlayerData(user.id, player);
            return await i.update(buildMainMenu(user, player));
        }

        if (i.isStringSelectMenu() && i.customId === 'select_reaction') {
            selectedReactionId = i.values[0];
            const reaction = labData.reactions.find(r => r.id === selectedReactionId);

            const calibEmbed = new EmbedBuilder()
                .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
                .setDescription(`الجهاز: **${labData.equipment[reaction.tool].name}**\nاضبط المعايير ثم اضغط **بدء التفاعل**.`)
                .setColor(0xe74c3c)
                .addFields(
                    { name: '🔥 الحرارة', value: `\`${currentTemp} °C\``, inline: true },
                    { name: '💨 الضغط', value: `\`${currentPress} atm\``, inline: true }
                );

            const tempMenu = new StringSelectMenuBuilder().setCustomId('change_temp').setPlaceholder('🔥 اختر الحرارة...').addOptions([
                { label: '25 °C', value: '25' }, { label: '110 °C', value: '110' }, { label: '500 °C', value: '500' }, { label: '900 °C', value: '900' }
            ]);

            const pressMenu = new StringSelectMenuBuilder().setCustomId('change_press').setPlaceholder('💨 اختر الضغط...').addOptions([
                { label: '1 atm', value: '1' }, { label: '2 atm', value: '2' }, { label: '3 atm', value: '3' }
            ]);

            const startBtn = new ButtonBuilder().setCustomId('btn_start_reaction').setLabel('🚀 بدء التفاعل').setStyle(ButtonStyle.Success);

            return await i.update({
                embeds: [calibEmbed],
                components: [
                    new ActionRowBuilder().addComponents(tempMenu),
                    new ActionRowBuilder().addComponents(pressMenu),
                    new ActionRowBuilder().addComponents(startBtn, backBtnRow.components[0])
                ]
            });
        }

        if (i.isStringSelectMenu() && (i.customId === 'change_temp' || i.customId === 'change_press')) {
            if (i.customId === 'change_temp') currentTemp = parseInt(i.values[0]);
            if (i.customId === 'change_press') currentPress = parseInt(i.values[0]);

            const reaction = labData.reactions.find(r => r.id === selectedReactionId);
            const calibEmbed = new EmbedBuilder()
                .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
                .setColor(0xe74c3c)
                .addFields(
                    { name: '🔥 الحرارة', value: `\`${currentTemp} °C\``, inline: true },
                    { name: '💨 الضغط', value: `\`${currentPress} atm\``, inline: true }
                );

            return await i.update({ embeds: [calibEmbed] });
        }

        if (i.customId === 'btn_start_reaction') {
            const reaction = labData.reactions.find(r => r.id === selectedReactionId);
            for (const [mat, qty] of Object.entries(reaction.req)) {
                if (!player.inv[mat] || player.inv[mat] < qty) {
                    return await i.reply({ content: '❌ لا تملك المواد الكافية!', ephemeral: true });
                }
            }

            if (currentTemp !== reaction.targetTemp || currentPress !== reaction.targetPress) {
                if (!player.upgrades.shield) {
                    for (const [mat, qty] of Object.entries(reaction.req)) {
                        player.inv[mat] -= qty;
                        if (player.inv[mat] <= 0) delete player.inv[mat];
                    }
                }
                updatePlayerData(user.id, player);
                return await i.update(buildMainMenu(user, player));
            }

            for (const [mat, qty] of Object.entries(reaction.req)) {
                player.inv[mat] -= qty;
                if (player.inv[mat] <= 0) delete player.inv[mat];
            }

            let duration = player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec;
            player.pendingQueue.push({ busyUntil: Math.floor(Date.now() / 1000) + duration, yield: reaction.yield, xp: reaction.xp });
            updatePlayerData(user.id, player);

            setTimeout(() => {
                channel.send(`🎉 <@${user.id}> **مختبر الكيمياء:** اكتمل التفاعل! اكتب **مختبر** لرؤية النتائج.`).catch(() => {});
            }, duration * 1000);

            return await i.update(buildMainMenu(user, player));
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder().setName('lab').setDescription('مختبر الكيمياء التفاعلي المطور v2.5'),
    async execute(interaction) {
        await handleLabSession(interaction, interaction.user);
    },
    handleLabSession
};

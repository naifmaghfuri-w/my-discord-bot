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
        hcl_raw: { name: 'حمض الهيدروكلوريك الخام', price: 40, buyable: true, state: '💧 سائل' },
        o2: { name: 'الأكسجين (O2)', price: 25, buyable: true, state: '💨 غاز', desc: 'غاز غني يستخدم في عمليات الاحتراق والأكسدة.' },
        h2: { name: 'الهيدروجين (H2)', price: 25, buyable: true, state: '💨 غاز', desc: 'غاز خفيف وقابل للاشتعال كعامل اختزال.' },
        fe: { name: 'الحديد (Fe)', price: 35, buyable: true, state: '🪨 صلب', desc: 'عنصر فلزي واسع الاستخدام في التفاعلات.' },

        nacl: { name: 'ملح الطعام (NaCl)', price: 50, buyable: false, state: '🪨 صلب', desc: 'مركب أيوني ناتج من تفاعل الصوديوم والكلور.' },
        cao: { name: 'الجير الحي (CaO)', price: 80, buyable: false, state: '🪨 صلب', desc: 'ينتج عن التفكك الحراري لحجر الجير.' },
        co2: { name: 'ثاني أكسيد الكربون (CO2)', price: 40, buyable: false, state: '💨 غاز', desc: 'غاز ينطلق كناتج ثانوي في العمليات الحرارية.' },
        hcl_pure: { name: 'حمض الهيدروكلوريك المركز', price: 120, buyable: false, state: '💧 سائل', desc: 'حمض قوي ينتج عن التقطير المعاير.' },
        h2o_pure: { name: 'ماء نقي 💧 (Pure H2O)', price: 45, buyable: false, state: '💧 سائل', desc: 'ماء مقطر عالي النقاوة خالٍ من الشوائب.' },
        fe2o3: { name: 'أكسيد الحديد (Fe2O3)', price: 90, buyable: false, state: '🪨 صلب', desc: 'مركب ناتج من أكسدة الحديد العالية.' },
        h2so4: { name: 'حمض الكبريتيك (H2SO4)', price: 150, buyable: false, state: '💧 سائل', desc: 'حمض شديد التآكل وذو قيمة عالية.' }
    },
    equipment: {
        beaker: { name: 'وعاء التفاعل (Beaker)', reqLevel: 1 },
        electrolysis: { name: 'جهاز التحليل الكهربائي (Electrolysis Unit)', reqLevel: 2 },
        still: { name: 'جهاز التقطير (Distillation Unit)', reqLevel: 3 },
        combustion: { name: 'مفاعل الأكسدة والاحتراق (Combustion Chamber)', reqLevel: 4 },
        furnace: { name: 'الفرن الحراري (Furnace)', reqLevel: 5 }
    },
    upgrades: {
        speed: { name: '⚡ المسرع الكيميائي (سرعة x2)', price: 200, desc: 'يخفض زمن جميع التفاعلات بنسبة 50%' },
        shield: { name: '🛡️ درع الحماية من الانفجار', price: 150, desc: 'يحميك من خسارة المواد عند الخطأ في المعايرة' }
    },
    reactions: [
        {
            id: 'r_nacl',
            name: '🧪 تخليق ملح الطعام (NaCl)',
            tool: 'beaker',
            req: { na: 1, cl: 1 },
            targetTemp: 25,
            targetPress: 1,
            timeSec: 10,
            yield: { nacl: 1 },
            xp: 25
        },
        {
            id: 'r_electrolysis_h2o',
            name: '⚡ تحليل الماء كهروبيائياً (H2 + O2)',
            tool: 'electrolysis',
            req: { h2o_imp: 2 },
            targetTemp: 25,
            targetPress: 1,
            timeSec: 12,
            yield: { h2: 2, o2: 1 },
            xp: 40
        },
        {
            id: 'r_h2o',
            name: '💧 تنقية وتقطير الماء (H2O)',
            tool: 'still',
            req: { h2o_imp: 1 },
            targetTemp: 110,
            targetPress: 1,
            timeSec: 15,
            yield: { h2o_pure: 1 },
            xp: 35
        },
        {
            id: 'r_fe2o3',
            name: '🔥 أكسدة الحديد وتكوين أكسيد الحديد',
            tool: 'combustion',
            req: { fe: 2, o2: 1 },
            targetTemp: 500,
            targetPress: 2,
            timeSec: 18,
            yield: { fe2o3: 1 },
            xp: 70
        },
        {
            id: 'r_cao',
            name: '🔥 التفكك الحراري لحجر الجير',
            tool: 'furnace',
            req: { caco3: 1 },
            targetTemp: 900,
            targetPress: 1,
            timeSec: 20,
            yield: { cao: 1, co2: 1 },
            xp: 60
        },
        {
            id: 'r_h2so4',
            name: '⚗️ تخليق حمض الكبريتيك المركز',
            tool: 'combustion',
            req: { fe2o3: 1, h2o_imp: 1 },
            targetTemp: 450,
            targetPress: 3,
            timeSec: 25,
            yield: { h2so4: 1 },
            xp: 110
        }
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
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
    }
}

function getPlayerData(userId) {
    ensureDataFile();
    let db = {};
    try {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        db = rawData ? JSON.parse(rawData) : {};
    } catch (err) {
        db = {};
    }

    if (!db[userId]) {
        db[userId] = {
            level: 1,
            xp: 0,
            coins: 200,
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1 },
            codex: [],
            upgrades: { speed: false, shield: false },
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
    try {
        const rawData = fs.readFileSync(dataPath, 'utf8');
        db = rawData ? JSON.parse(rawData) : {};
    } catch (err) {
        db = {};
    }
    db[userId] = data;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lab')
        .setDescription('مختبر الكيمياء التفاعلي المتقدم v2.4'),

    async execute(interaction) {
        const user = interaction.user;
        const channel = interaction.channel;
        let player = getPlayerData(user.id);
        const currentNow = Math.floor(Date.now() / 1000);

        if (player.pendingQueue && player.pendingQueue.length > 0) {
            let updatedQueue = [];
            for (const task of player.pendingQueue) {
                if (currentNow >= task.busyUntil) {
                    for (const [itemId, qty] of Object.entries(task.yield)) {
                        player.inv[itemId] = (player.inv[itemId] || 0) + qty;
                        
                        if (!player.codex.includes(itemId)) {
                            player.codex.push(itemId);
                        }

                        if (!player.quest.completed && player.quest.item === itemId) {
                            player.quest.progress += qty;
                        }
                    }
                    player.xp += task.xp;

                    const xpNeeded = player.level * 100;
                    if (player.xp >= xpNeeded) {
                        player.level += 1;
                        player.xp -= xpNeeded;
                    }
                } else {
                    updatedQueue.push(task);
                }
            }
            player.pendingQueue = updatedQueue;
            updatePlayerData(user.id, player);
        }

        const buildMainEmbed = (p) => {
            const rank = getRankTitle(p.level);
            const embed = new EmbedBuilder()
                .setTitle('🧪 مختبر الكيمياء المتقدم | Ultimate Lab v2.4')
                .setDescription(`مرحباً بك **${user.username}** 👋\nالرتبة العلمية: **${rank}**`)
                .setColor(0x2ecc71)
                .addFields(
                    { name: '👤 المستوى', value: `\`Lv.${p.level}\``, inline: true },
                    { name: '✨ الخبرة', value: `\`${p.xp} / ${p.level * 100} XP\``, inline: true },
                    { name: '💰 Valence', value: `\`${p.coins} 🪙\``, inline: true },
                    { name: '📘 الموسوعة الكيميائية', value: `\`${p.codex.length} / 7 مكتشفات\``, inline: true },
                    { name: '🛡️ الحماية', value: p.upgrades.shield ? '`مفعل ✅`' : '`غير مفعل ❌`', inline: true },
                    { name: '⚡ السرعة', value: p.upgrades.speed ? '`مضاعفة 2x ⚡`' : '`عادية 1x`', inline: true }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: 'المختبر المتقدم v2.4' });

            if (p.pendingQueue && p.pendingQueue.length > 0) {
                embed.addFields({ 
                    name: '⏳ تفاعلات قيد التشغيل', 
                    value: `عدد التفاعلات الجارية: **${p.pendingQueue.length}**` 
                });
            }
            return embed;
        };

        const reactionOptions = labData.reactions.map(r => {
            const reqEquipment = labData.equipment[r.tool];
            const isUnlocked = player.level >= reqEquipment.reqLevel;
            return {
                label: r.name,
                description: `الجهاز: ${reqEquipment.name} (طلب Lv.${reqEquipment.reqLevel})`,
                value: r.id,
                disabled: !isUnlocked
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

        const responseMsg = await interaction.reply({
            embeds: [buildMainEmbed(player)],
            components: [row1, row2],
            fetchReply: true
        });

        let selectedReactionId = null;
        let currentTemp = 25;
        let currentPress = 1;

        const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

        collector.on('collect', async i => {
            if (i.user.id !== user.id) {
                return i.reply({ content: '❌ هذه اللوحة ليست مخصصة لك!', ephemeral: true });
            }

            try {
                player = getPlayerData(user.id);

                if (i.customId === 'btn_open_inv') {
                    const invList = Object.keys(player.inv).length > 0 
                        ? Object.entries(player.inv).map(([id, qty]) => {
                            const item = labData.items[id];
                            return `• **${item?.name || id}** \`[${item?.state || 'غير محدد'}]\`: **${qty}**`;
                        }).join('\n')
                        : '_المستودع فارغ حالياً_';

                    const invEmbed = new EmbedBuilder()
                        .setTitle(`🎒 مستودع المواد والمخزون - ${user.username}`)
                        .setDescription(invList)
                        .setColor(0x3498db);

                    return await i.reply({ embeds: [invEmbed], ephemeral: true });
                }

                if (i.customId === 'btn_open_codex') {
                    const allProducts = ['nacl', 'cao', 'co2', 'hcl_pure', 'h2o_pure', 'fe2o3', 'h2so4'];
                    const codexList = allProducts.map(id => {
                        const item = labData.items[id];
                        if (player.codex.includes(id)) {
                            return `✅ **${item.name}**\n└ _${item.desc}_ [الحالة: ${item.state}]`;
                        } else {
                            return `🔒 **مركب غامض لم يكتشف بعد** (\`${id.toUpperCase()}\`)`;
                        }
                    }).join('\n\n');

                    const codexEmbed = new EmbedBuilder()
                        .setTitle('📘 موسوعة الاكتشافات الكيميائية (Codex)')
                        .setDescription(`نسبة الاكتشاف: **${player.codex.length} / ${allProducts.length}**\n\n${codexList}`)
                        .setColor(0x9b59b6);

                    return await i.reply({ embeds: [codexEmbed], ephemeral: true });
                }

                if (i.customId === 'btn_open_quest') {
                    const q = player.quest;
                    const itemNeeded = labData.items[q.item];
                    
                    const questEmbed = new EmbedBuilder()
                        .setTitle('📜 مهمة منظمة الكيمياء اليومية')
                        .setDescription(`طلبية خاصة بإنتاج مركب معين لرفع مستوى المختبر!`)
                        .addFields(
                            { name: '🎯 المطلوب', value: `إنتاج **${q.count}x ${itemNeeded.name}**`, inline: true },
                            { name: '📊 التقدم الحالي', value: `\`${q.progress} / ${q.count}\``, inline: true },
                            { name: '🎁 المكافأة', value: `\`+${q.rewardCoins} Valence\` | \`+${q.rewardXp} XP\``, inline: true }
                        )
                        .setColor(0xe67e22);

                    const claimBtn = new ButtonBuilder()
                        .setCustomId('btn_claim_quest')
                        .setLabel('تسليم المهمة وحصد المكافأة')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(q.completed || q.progress < q.count);

                    const qRow = new ActionRowBuilder().addComponents(claimBtn);
                    return await i.reply({ embeds: [questEmbed], components: [qRow], ephemeral: true });
                }

                if (i.customId === 'btn_claim_quest') {
                    if (player.quest.progress >= player.quest.count && !player.quest.completed) {
                        player.coins += player.quest.rewardCoins;
                        player.xp += player.quest.rewardXp;
                        player.quest.completed = true;
                        updatePlayerData(user.id, player);

                        return await i.reply({ content: `🎉 **تم تسليم المهمة اليومية بنجاح!**\nحصلت على \`+${player.quest.rewardCoins} Valence\` و \`+${player.quest.rewardXp} XP\`!`, ephemeral: true });
                    }
                }

                if (i.customId === 'btn_open_shop') {
                    const shopOptions = Object.entries(labData.items)
                        .filter(([_, item]) => item.buyable)
                        .map(([id, item]) => ({
                            label: item.name,
                            description: `مادة خام | السعر: ${item.price} Valence`,
                            value: `item_${id}`
                        }));

                    if (!player.upgrades.speed) {
                        shopOptions.push({
                            label: labData.upgrades.speed.name,
                            description: `تجهيز جهاز | السعر: ${labData.upgrades.speed.price} Valence`,
                            value: 'up_speed'
                        });
                    }
                    if (!player.upgrades.shield) {
                        shopOptions.push({
                            label: labData.upgrades.shield.name,
                            description: `حماية | السعر: ${labData.upgrades.shield.price} Valence`,
                            value: 'up_shield'
                        });
                    }

                    const shopSelect = new StringSelectMenuBuilder()
                        .setCustomId('select_shop_all')
                        .setPlaceholder('🛒 اختر مادة أو ترقية لشراءها...')
                        .addOptions(shopOptions);

                    const shopRow = new ActionRowBuilder().addComponents(shopSelect);

                    const shopReply = await i.reply({ 
                        content: `💰 **رصيدك الحالي:** \`${player.coins} Valence\`\nاختر من القائمة أدناه لشراء المواد الخام أو ترقيات أجهزة المختبر:`, 
                        components: [shopRow], 
                        ephemeral: true,
                        fetchReply: true
                    });

                    const shopCollector = shopReply.createMessageComponentCollector({ time: 60000 });

                    shopCollector.on('collect', async shopInteraction => {
                        if (shopInteraction.customId === 'select_shop_all') {
                            const val = shopInteraction.values[0];
                            let currentP = getPlayerData(user.id);

                            if (val.startsWith('item_')) {
                                const itemId = val.replace('item_', '');
                                const item = labData.items[itemId];

                                if (currentP.coins < item.price) {
                                    return await shopInteraction.reply({ content: `❌ لا تملك رصيد **Valence** كافي!`, ephemeral: true });
                                }

                                currentP.coins -= item.price;
                                currentP.inv[itemId] = (currentP.inv[itemId] || 0) + 1;
                                updatePlayerData(user.id, currentP);

                                return await shopInteraction.reply({ content: `✅ تم شراء **1x ${item.name}** بنجاح!`, ephemeral: true });
                            } 
                            else if (val.startsWith('up_')) {
                                const upKey = val.replace('up_', '');
                                const upItem = labData.upgrades[upKey];

                                if (currentP.coins < upItem.price) {
                                    return await shopInteraction.reply({ content: `❌ لا تملك رصيد كافي لشراء الترقية!`, ephemeral: true });
                                }

                                currentP.coins -= upItem.price;
                                currentP.upgrades[upKey] = true;
                                updatePlayerData(user.id, currentP);

                                return await shopInteraction.reply({ content: `🎉 **تم شراء وتفعيل ترقية (${upItem.name}) بنجاح!**`, ephemeral: true });
                            }
                        }
                    });

                    return;
                }

                if (i.customId === 'btn_sell_all') {
                    let totalEarned = 0;
                    const sellables = ['nacl', 'cao', 'co2', 'hcl_pure', 'h2o_pure', 'fe2o3', 'h2so4'];
                    
                    sellables.forEach(id => {
                        if (player.inv[id]) {
                            totalEarned += player.inv[id] * labData.items[id].price;
                            delete player.inv[id];
                        }
                    });

                    if (totalEarned === 0) {
                        return await i.reply({ content: `⚠️ لا تملك أي مركب مُصنّع لبيعه حالياً!`, ephemeral: true });
                    }

                    player.coins += totalEarned;
                    updatePlayerData(user.id, player);

                    return await i.reply({ content: `💵 تم بيع كافة المركبات المصنعة بنجاح! حصلت على **+${totalEarned} Valence** 🪙`, ephemeral: true });
                }

                if (i.isStringSelectMenu() && i.customId === 'select_reaction') {
                    selectedReactionId = i.values[0];
                    const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                    currentTemp = 25;
                    currentPress = 1;

                    const embed = new EmbedBuilder()
                        .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
                        .setDescription(`الجهاز المستخدم: **${labData.equipment[reaction.tool].name}**\nاضبط الحرارة والضغط بمهارة ثم اضغط **بدء التفاعل**.`)
                        .setColor(0xf39c12)
                        .addFields(
                            { name: '🔥 الحرارة الحالية', value: `\`${currentTemp} °C\``, inline: true },
                            { name: '💨 الضغط الحالي', value: `\`${currentPress} atm\``, inline: true }
                        );

                    const tempMenu = new StringSelectMenuBuilder()
                        .setCustomId('change_temp')
                        .setPlaceholder('🔥 اختر درجة الحرارة...')
                        .addOptions([
                            { label: '25 °C (حرارة الغرفة)', value: '25' },
                            { label: '110 °C (غليان وتكثيف)', value: '110' },
                            { label: '450 °C (تفاعل حمضي متوسط)', value: '450' },
                            { label: '500 °C (أكسدة عالية)', value: '500' },
                            { label: '900 °C (صهر حراري)', value: '900' }
                        ]);

                    const pressMenu = new StringSelectMenuBuilder()
                        .setCustomId('change_press')
                        .setPlaceholder('💨 اختر مقدار الضغط...')
                        .addOptions([
                            { label: '1 atm (ضغط جوي عادي)', value: '1' },
                            { label: '2 atm (ضغط مضاعف)', value: '2' },
                            { label: '3 atm (ضغط كيميائي مركز)', value: '3' },
                            { label: '10 atm (ضغط عالي جدًا)', value: '10' }
                        ]);

                    const startBtn = new ButtonBuilder().setCustomId('btn_start_reaction').setLabel('🚀 بدء التفاعل').setStyle(ButtonStyle.Success);

                    return await i.update({
                        embeds: [embed],
                        components: [
                            new ActionRowBuilder().addComponents(tempMenu),
                            new ActionRowBuilder().addComponents(pressMenu),
                            new ActionRowBuilder().addComponents(startBtn)
                        ]
                    });
                }

                if (i.isStringSelectMenu() && i.customId === 'change_temp') {
                    if (!selectedReactionId) return await i.reply({ content: '⚠️ اختر تفاعلاً أولاً!', ephemeral: true });
                    currentTemp = parseInt(i.values[0]);
                    const reaction = labData.reactions.find(r => r.id === selectedReactionId);
                    
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
                        .setDescription(`تم تحديث الحرارة! اضبط الضغط واضغط بدء التفاعل.`)
                        .setColor(0xf39c12)
                        .addFields(
                            { name: '🔥 الحرارة الحالية', value: `\`${currentTemp} °C\``, inline: true },
                            { name: '💨 الضغط الحالي', value: `\`${currentPress} atm\``, inline: true }
                        );

                    return await i.update({ embeds: [updatedEmbed] });
                }

                if (i.isStringSelectMenu() && i.customId === 'change_press') {
                    if (!selectedReactionId) return await i.reply({ content: '⚠️ اختر تفاعلاً أولاً!', ephemeral: true });
                    currentPress = parseInt(i.values[0]);
                    const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                    const updatedEmbed = new EmbedBuilder()
                        .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
                        .setDescription(`تم تحديث الضغط! اضبط الحرارة واضغط بدء التفاعل.`)
                        .setColor(0xf39c12)
                        .addFields(
                            { name: '🔥 الحرارة الحالية', value: `\`${currentTemp} °C\``, inline: true },
                            { name: '💨 الضغط الحالي', value: `\`${currentPress} atm\``, inline: true }
                        );

                    return await i.update({ embeds: [updatedEmbed] });
                }

                if (i.customId === 'btn_start_reaction') {
                    if (!selectedReactionId) return await i.reply({ content: '⚠️ اختر تفاعلاً أولاً!', ephemeral: true });
                    const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                    let hasMaterials = true;
                    for (const [mat, qty] of Object.entries(reaction.req)) {
                        if (!player.inv[mat] || player.inv[mat] < qty) {
                            hasMaterials = false;
                            break;
                        }
                    }

                    if (!hasMaterials) {
                        return await i.reply({ content: `❌ **لا تملك المواد الكافية في مستودعك لبدء هذا التفاعل!**`, ephemeral: true });
                    }

                    if (currentTemp !== reaction.targetTemp || currentPress !== reaction.targetPress) {
                        if (player.upgrades.shield) {
                            return await i.update({
                                content: `🛡️ **انحراف في المعايرة!** لكن **درع الحماية (Safety Shield)** منع انفجار الأجهزة وخسارة المواد.`,
                                embeds: [], components: []
                            });
                        } else {
                            for (const [mat, qty] of Object.entries(reaction.req)) {
                                player.inv[mat] -= qty;
                                if (player.inv[mat] <= 0) delete player.inv[mat];
                            }
                            updatePlayerData(user.id, player);
                            return await i.update({
                                content: `💥 **فشل التفاعل وتفجر الوعاء!** خسرت المواد المستخدمة بسبب ضبط حرارة/ضغط خاطئ!`,
                                embeds: [], components: []
                            });
                        }
                    }

                    for (const [mat, qty] of Object.entries(reaction.req)) {
                        player.inv[mat] -= qty;
                        if (player.inv[mat] <= 0) delete player.inv[mat];
                    }

                    let duration = reaction.timeSec;
                    if (player.upgrades.speed) duration = Math.ceil(duration / 2);

                    const now = Math.floor(Date.now() / 1000);
                    
                    player.pendingQueue.push({
                        busyUntil: now + duration,
                        yield: reaction.yield,
                        xp: reaction.xp
                    });
                    
                    updatePlayerData(user.id, player);

                    // إرسال تنبيه مباشرة في نفس الروم عند الانتهاء
                    setTimeout(() => {
                        channel.send(`🎉 <@${user.id}> **مختبر الكيمياء:** اكتمل التفاعل الكيميائي الخاص بك بنجاح! استخدم \`/lab\` لاستلام نواتجك.`).catch(() => {});
                    }, duration * 1000);

                    return await i.update({
                        content: `⏳ **بدأ التفاعل بنجاح في [${labData.equipment[reaction.tool].name}]!**\nالوقت المستغرق: **${duration} ثانية** ${player.upgrades.speed ? '⚡ (مسرع 2x)' : ''}\nسيصلك تنبيه في هذا الروم عند الانتهاء!`,
                        embeds: [], components: []
                    });
                }
            } catch (err) {
                console.error("Interaction error:", err);
            }
        });
    }
};

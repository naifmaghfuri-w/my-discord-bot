// lab.js - The Lab v1.1
const fs = require('fs');
const path = require('path');
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    SlashCommandBuilder 
} = require('discord.js');

const DATA_FILE = path.join(__dirname, 'players.json');

// 1. نظام الحفظ الدائم (JSON)
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
    }
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        return {};
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getPlayerData(userId) {
    const data = loadData();
    if (!data[userId]) {
        data[userId] = {
            coins: 100,
            xp: 0,
            level: 1,
            inv: { hcl: 2, naoh: 2, caco3: 2 },
            busyUntil: 0,
            pendingYield: null
        };
        saveData(data);
    }
    return data[userId];
}

function updatePlayerData(userId, playerData) {
    const data = loadData();
    data[userId] = playerData;
    saveData(data);
}

// 2. قاعدة بيانات اللعبة والخبرة
const labData = {
    equipment: {
        vessel: { name: 'وعاء التفاعل (Reaction Vessel)', reqLevel: 1 },
        furnace: { name: 'الفرن الحراري (Furnace)', reqLevel: 2 },
        distiller: { name: 'جهاز التقطير (Distiller)', reqLevel: 3 }
    },
    reactions: [
        {
            id: 'react_nacl',
            name: 'تخليق ملح الطعام والماء',
            eq: 'HCl + NaOH → NaCl + H₂O',
            tool: 'vessel',
            reqLevel: 1,
            req: { hcl: 1, naoh: 1 },
            yield: { nacl: 1, h2o: 1 },
            targetTemp: 25,
            targetPress: 1,
            timeSec: 10,
            xp: 25
        },
        {
            id: 'react_lime',
            name: 'التفكك الحراري لحجر الجير',
            eq: 'CaCO₃ + Heat → CaO + CO₂',
            tool: 'furnace',
            reqLevel: 2,
            req: { caco3: 1 },
            yield: { cao: 1, co2: 1 },
            targetTemp: 900,
            targetPress: 1,
            timeSec: 30,
            xp: 60
        },
        {
            id: 'react_distill_acid',
            name: 'تنقية وتقطير حمض الهيدروكلوريك',
            eq: 'HCl (Dilute) → Pure HCl',
            tool: 'distiller',
            reqLevel: 3,
            req: { hcl: 2 },
            yield: { hcl_pure: 1 },
            targetTemp: 110,
            targetPress: 2,
            timeSec: 45,
            xp: 120
        }
    ],
    items: {
        hcl: { name: 'حمض الهيدروكلوريك المخفف (HCl)', price: 15 },
        naoh: { name: 'هيدروكسيد الصوديوم (NaOH)', price: 15 },
        caco3: { name: 'كربونات الكالسيوم (CaCO₃)', price: 20 },
        nacl: { name: 'كلوريد الصوديوم (NaCl)', price: 35 },
        h2o: { name: 'ماء مقطر (H₂O)', price: 5 },
        cao: { name: 'أكسيد الكالسيوم (CaO)', price: 40 },
        co2: { name: 'ثاني أكسيد الكربون (CO₂)', price: 25 },
        hcl_pure: { name: 'حمض هيدروكلوريك مركز (Pure HCl)', price: 75 }
    }
};

// حساب زيادة المستوى
function addXP(player, amount) {
    player.xp += amount;
    const nextLevelXP = player.level * 100;
    if (player.xp >= nextLevelXP) {
        player.level += 1;
        return true;
    }
    return false;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lab')
        .setDescription('The Lab v1.1'),

    async execute(interactionOrMessage) {
        const user = interactionOrMessage.user || interactionOrMessage.author;
        let player = getPlayerData(user.id);
        const now = Math.floor(Date.now() / 1000);

        // التحقق من اكتمال التفاعل في حال كان البوت ينتظر
        if (player.busyUntil > 0 && now >= player.busyUntil && player.pendingYield) {
            for (const [mat, qty] of Object.entries(player.pendingYield.yield)) {
                player.inv[mat] = (player.inv[mat] || 0) + qty;
            }
            const leveledUp = addXP(player, player.pendingYield.xp);
            const msg = `🎉 **اكتمل التفاعل الكيميائي في المختبر!**\nحصلت على: ${Object.entries(player.pendingYield.yield).map(([id, q]) => `**${labData.items[id]?.name || id}** x${q}`).join(', ')} (+${player.pendingYield.xp} XP)` + (leveledUp ? `\n🌟 **مبروك! ارتفع مستواك إلى المستوى ${player.level}!**` : '');
            
            player.busyUntil = 0;
            player.pendingYield = null;
            updatePlayerData(user.id, player);

            if (interactionOrMessage.channel) {
                interactionOrMessage.channel.send(`<@${user.id}> ${msg}`);
            }
        }

        const buildMainEmbed = () => {
            const isBusy = player.busyUntil > now;
            const remaining = player.busyUntil - now;

            return new EmbedBuilder()
                .setTitle('🧪 مختبر الكيمياء | The Lab v1.1')
                .setDescription(`مرحباً بك يا دكتور **${user.username}**!\n` + (isBusy ? `⏳ **المختبر مشغول حالياً بتفاعل قائمة.. متبقي: \`${remaining} ثانية\`**` : `✅ **المختبر جاهز لاستقبال تفاعلات جديدة.**`))
                .setColor(isBusy ? 0xe67e22 : 0x2b2d31)
                .addFields(
                    { name: '📊 المستوى و XP', value: `المستوى: **${player.level}**\nالخبرة: \`${player.xp} / ${player.level * 100} XP\``, inline: true },
                    { name: '💰 الرصيد الحالي', value: `\`${player.coins} Valence\``, inline: true },
                    { 
                        name: '🎒 مستودع المواد الحالي', 
                        value: Object.keys(player.inv).length > 0 
                            ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: ${qty}`).join('\n')
                            : '_المستودع فارغ_' 
                    },
                    { 
                        name: '🧰 الأجهزة المتاحة بالمستوى', 
                        value: Object.values(labData.equipment).map(e => `• **${e.name}** (Req Lv.${e.reqLevel}) ${player.level >= e.reqLevel ? '✅' : '🔒'}`).join('\n') 
                    }
                )
                .setFooter({ text: 'The Lab Engine • v1.1.0 (Persistence, Levels & Calibration Systems)' });
        };

        const availableReactions = labData.reactions.filter(r => player.level >= r.reqLevel);
        const reactionSelect = new StringSelectMenuBuilder()
            .setCustomId('select_reaction')
            .setPlaceholder(player.busyUntil > now ? '⏳ الجهاز مشغول حالياً...' : '⚗️ اختر تفاعلاً كيميائياً لإجرائه...')
            .setDisabled(player.busyUntil > now)
            .addOptions(
                availableReactions.length > 0 ? availableReactions.map(r => ({
                    label: r.name,
                    description: `المنسوب: Lv.${r.reqLevel} | الوقت: ${r.timeSec}ث | XP: +${r.xp}`,
                    value: r.id
                })) : [{ label: 'لا توجد تفاعلات متاح للمستوى الحالي', value: 'none' }]
            );

        const storeButton = new ButtonBuilder()
            .setCustomId('btn_buy_raw')
            .setLabel('🛒 شراء مواد خام (20 Valence)')
            .setStyle(ButtonStyle.Primary);

        const sellButton = new ButtonBuilder()
            .setCustomId('btn_sell_all')
            .setLabel('💵 بيع النواتج المصنعة')
            .setStyle(ButtonStyle.Success);

        const rowSelect = new ActionRowBuilder().addComponents(reactionSelect);
        const rowButtons = new ActionRowBuilder().addComponents(storeButton, sellButton);

        const replyOptions = {
            embeds: [buildMainEmbed()],
            components: [rowSelect, rowButtons],
            fetchReply: true
        };

        let responseMessage;
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            responseMessage = await interactionOrMessage.followUp(replyOptions);
        } else {
            responseMessage = await interactionOrMessage.reply(replyOptions);
        }

        const collector = responseMessage.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            player = getPlayerData(user.id);
            const currentNow = Math.floor(Date.now() / 1000);

            // 1. اختيار تفاعل وفتح شاشة الضبط
            if (i.isStringSelectMenu() && i.customId === 'select_reaction') {
                if (i.values[0] === 'none') return i.deferUpdate();
                if (player.busyUntil > currentNow) {
                    return i.reply({ content: '⚠️ **المختبر مشغول في تفاعل آخر حالياً!**', ephemeral: true });
                }

                const reaction = labData.reactions.find(r => r.id === i.values[0]);
                
                let hasMaterials = true;
                for (const [mat, qty] of Object.entries(reaction.req)) {
                    if (!player.inv[mat] || player.inv[mat] < qty) {
                        hasMaterials = false;
                        break;
                    }
                }

                if (!hasMaterials) {
                    return i.reply({ content: `❌ **لا تملك المواد الكافية!** يتطلب: \`${JSON.stringify(reaction.req)}\``, ephemeral: true });
                }

                // واجهة ضبط درجة الحرارة والضغط قبل البدء
                const calibEmbed = new EmbedBuilder()
                    .setTitle(`⚙️ معايرة بيئة التفاعل: ${reaction.name}`)
                    .setDescription(`أنت على وشك استخدام **[${labData.equipment[reaction.tool].name}]**.\nحدد درجة الحرارة والضغط المناسبين لإتمام التفاعل بنجاح وبدون مخاطر!`)
                    .setColor(0xf1c40f)
                    .addFields(
                        { name: '🔥 درجة الحرارة المطلوبة تقريباً', value: `المطلوب: ~\`${reaction.targetTemp} °C\``, inline: true },
                        { name: '💨 الضغط المطلوب تقريباً', value: `المطلوب: ~\`${reaction.targetPress} atm\``, inline: true }
                    );

                const tempSelect = new StringSelectMenuBuilder()
                    .setCustomId(`calib_temp_${reaction.id}`)
                    .setPlaceholder('🔥 اختر درجة الحرارة...')
                    .addOptions([
                        { label: '25 °C (حرارة الغرفة)', value: '25' },
                        { label: '110 °C (غليان وتكثيف)', value: '110' },
                        { label: '900 °C (فرن عالي الحرارة)', value: '900' }
                    ]);

                const pressSelect = new StringSelectMenuBuilder()
                    .setCustomId(`calib_press_${reaction.id}`)
                    .setPlaceholder('💨 اختر مقدار الضغط...')
                    .addOptions([
                        { label: '1 atm (ضغط جوي عادي)', value: '1' },
                        { label: '2 atm (ضغط مضاعف)', value: '2' },
                        { label: '10 atm (ضغط مرتفع خطير)', value: '10' }
                    ]);

                const rowT = new ActionRowBuilder().addComponents(tempSelect);
                const rowP = new ActionRowBuilder().addComponents(pressSelect);

                await i.reply({ embeds: [calibEmbed], components: [rowT, rowP], ephemeral: true });
            }

            // 2. استقبال قيم المعايرة والبدء في التفاعل الزمنية
            if (i.isStringSelectMenu() && (i.customId.startsWith('calib_temp_') || i.customId.startsWith('calib_press_'))) {
                const reactionId = i.customId.replace('calib_temp_', '').replace('calib_press_', '');
                const reaction = labData.reactions.find(r => r.id === reactionId);

                const selectedVal = parseInt(i.values[0]);
                const isTemp = i.customId.startsWith('calib_temp_');

                const expectedVal = isTemp ? reaction.targetTemp : reaction.targetPress;

                // خصم المواد فوراً
                for (const [mat, qty] of Object.entries(reaction.req)) {
                    player.inv[mat] -= qty;
                    if (player.inv[mat] <= 0) delete player.inv[mat];
                }

                // فحص دقة المعايرة (فشل أو نجاح)
                if (selectedVal !== expectedVal) {
                    updatePlayerData(user.id, player);
                    return i.update({
                        content: `💥 **حدث انحراف في المعايرة وتفجر التفاعل!**\nخسرت المواد المستخدمة بسبب ضبط غير صحيح لـ ${isTemp ? 'درجة الحرارة' : 'الضغط'}.`,
                        embeds: [], components: []
                    });
                }

                // نجاح المعايرة والبدء في الانتظار الزمني
                player.busyUntil = currentNow + reaction.timeSec;
                player.pendingYield = { yield: reaction.yield, xp: reaction.xp };
                updatePlayerData(user.id, player);

                await i.update({
                    content: `⏳ **بدأ التفاعل بنجاح بداخل [${labData.equipment[reaction.tool].name}]!**\nالوقت المطلوب: **${reaction.timeSec} ثانية**. سيتم إشعاراتك عند اكتمال النواتج.`,
                    embeds: [], components: []
                });
            }

            // 3. شراء المواد الخام
            if (i.isButton() && i.customId === 'btn_buy_raw') {
                if (player.coins < 20) {
                    return i.reply({ content: '❌ لا تملك نقوداً كافية (تحتاج 20 Valence)!', ephemeral: true });
                }
                player.coins -= 20;
                player.inv.caco3 = (player.inv.caco3 || 0) + 1;
                player.inv.hcl = (player.inv.hcl || 0) + 1;
                updatePlayerData(user.id, player);

                await i.update({ embeds: [buildMainEmbed()], components: [rowSelect, rowButtons] });
                await i.followUp({ content: '🛒 تم شراء **1x حجر جير (CaCO₃)** و **1x حمض (HCl)** مقابل 20 Valence.', ephemeral: true });
            }

            // 4. بيع النواتج
            if (i.isButton() && i.customId === 'btn_sell_all') {
                let totalEarned = 0;
                const sellables = ['nacl', 'cao', 'co2', 'hcl_pure'];
                
                sellables.forEach(id => {
                    if (player.inv[id]) {
                        totalEarned += player.inv[id] * labData.items[id].price;
                        delete player.inv[id];
                    }
                });

                if (totalEarned === 0) {
                    return i.reply({ content: '⚠️ لا تملك أي نواتج مُصنّعة ذات قيمة لبيعها حالياً!', ephemeral: true });
                }

                player.coins += totalEarned;
                updatePlayerData(user.id, player);

                await i.update({ embeds: [buildMainEmbed()], components: [rowSelect, rowButtons] });
                await i.followUp({ content: `💵 تم بيع جميع المركبات الناتجة وحصلت على **${totalEarned} Valence**!`, ephemeral: true });
            }
        });
    }
};

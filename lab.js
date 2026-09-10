// lab.js - The Lab v1.2
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

function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
    }
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
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
            coins: 100, // Valence
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
        hcl: { name: 'حمض الهيدروكلوريك المخفف (HCl)', price: 15, buyable: true },
        naoh: { name: 'هيدروكسيد الصوديوم (NaOH)', price: 15, buyable: true },
        caco3: { name: 'كربونات الكالسيوم (CaCO₃)', price: 20, buyable: true },
        nacl: { name: 'كلوريد الصوديوم (NaCl)', price: 35, buyable: false },
        h2o: { name: 'ماء مقطر (H₂O)', price: 5, buyable: false },
        cao: { name: 'أكسيد الكالسيوم (CaO)', price: 40, buyable: false },
        co2: { name: 'ثاني أكسيد الكربون (CO₂)', price: 25, buyable: false },
        hcl_pure: { name: 'حمض هيدروكلوريك مركز (Pure HCl)', price: 75, buyable: false }
    }
};

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
        .setDescription('The Lab v1.2'),

    async execute(interactionOrMessage) {
        const user = interactionOrMessage.user || interactionOrMessage.author;
        let player = getPlayerData(user.id);
        const now = Math.floor(Date.now() / 1000);

        // فحص اكتمال التفاعلات السابقة
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
                .setTitle('🧪 مختبر الكيمياء | The Lab v1.2')
                .setDescription(`مرحباً بك يا دكتور **${user.username}**!\n` + (isBusy ? `⏳ **المختبر مشغول حالياً بتفاعل قائمة.. متبقي: \`${remaining} ثانية\`**` : `✅ **المختبر جاهز لاستقبال تفاعلات جديدة.**`))
                .setColor(isBusy ? 0xe67e22 : 0x2b2d31)
                .addFields(
                    { name: '📊 المستوى والخبرة', value: `المستوى: **${player.level}** | \`${player.xp}/${player.level * 100} XP\``, inline: true },
                    { name: '💰 الرصيد الحالي', value: `\`${player.coins} Valence\``, inline: true }
                )
                .setFooter({ text: 'The Lab Engine • v1.2.0 (Dynamic Calibration & UI Components)' });
        };

        const availableReactions = labData.reactions.filter(r => player.level >= r.reqLevel);
        const reactionSelect = new StringSelectMenuBuilder()
            .setCustomId('select_reaction')
            .setPlaceholder(player.busyUntil > now ? '⏳ الجهاز مشغول حالياً...' : '⚗️ اختر تفاعلاً كيميائياً للبدء...')
            .setDisabled(player.busyUntil > now)
            .addOptions(
                availableReactions.length > 0 ? availableReactions.map(r => ({
                    label: r.name,
                    description: `Lv.${r.reqLevel} | الوقت: ${r.timeSec}ث | XP: +${r.xp}`,
                    value: r.id
                })) : [{ label: 'لا توجد تفاعلات متاحة حالياً', value: 'none' }]
            );

        const invButton = new ButtonBuilder().setCustomId('btn_open_inv').setLabel('🎒 المستودع').setStyle(ButtonStyle.Secondary);
        const equipButton = new ButtonBuilder().setCustomId('btn_open_equip').setLabel('🧰 الأجهزة').setStyle(ButtonStyle.Secondary);
        const roadmapButton = new ButtonBuilder().setCustomId('btn_open_roadmap').setLabel('📊 خريطة المستويات').setStyle(ButtonStyle.Secondary);
        const shopButton = new ButtonBuilder().setCustomId('btn_open_shop').setLabel('🛒 المتجر').setStyle(ButtonStyle.Primary);
        const sellButton = new ButtonBuilder().setCustomId('btn_sell_all').setLabel('💵 بيع النواتج').setStyle(ButtonStyle.Success);

        const rowSelect = new ActionRowBuilder().addComponents(reactionSelect);
        const rowNav = new ActionRowBuilder().addComponents(invButton, equipButton, roadmapButton, shopButton, sellButton);

        const replyOptions = { embeds: [buildMainEmbed()], components: [rowSelect, rowNav], fetchReply: true };

        let responseMessage;
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            responseMessage = await interactionOrMessage.followUp(replyOptions);
        } else {
            responseMessage = await interactionOrMessage.reply(replyOptions);
        }

        const collector = responseMessage.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 300000
        });

        // متغيرات المعايرة الحالية للمستخدم
        let currentTemp = 25;
        let currentPress = 1;
        let selectedReactionId = null;

        collector.on('collect', async i => {
            player = getPlayerData(user.id);
            const currentNow = Math.floor(Date.now() / 1000);

            // 1. فتح المستودع
            if (i.customId === 'btn_open_inv') {
                await i.deferUpdate();
                const invList = Object.keys(player.inv).length > 0 
                    ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: ${qty}`).join('\n')
                    : '_المستودع فارغ حالياً_';

                const invEmbed = new EmbedBuilder()
                    .setTitle('🎒 مستودع المواد الخاص بك')
                    .setDescription(invList)
                    .setColor(0x3498db);

                return i.followUp({ embeds: [invEmbed], ephemeral: true });
            }

            // 2. فتح الأجهزة
            if (i.customId === 'btn_open_equip') {
                await i.deferUpdate();
                const equipList = Object.values(labData.equipment).map(e => `• **${e.name}** - (يتطلب مستوى: Lv.${e.reqLevel}) ${player.level >= e.reqLevel ? '✅' : '🔒'}`).join('\n');
                
                const equipEmbed = new EmbedBuilder()
                    .setTitle('🧰 الأجهزة المتاحة في المختبر')
                    .setDescription(equipList)
                    .setColor(0x9b59b6);

                return i.followUp({ embeds: [equipEmbed], ephemeral: true });
            }

            // 3. خريطة المستويات والتقدم
            if (i.customId === 'btn_open_roadmap') {
                await i.deferUpdate();
                const roadmapEmbed = new EmbedBuilder()
                    .setTitle('📊 خريطة المستويات والتقدم (Roadmap)')
                    .setDescription(`مستواك الحالي: **Level ${player.level}**\nالخبرة: \`${player.xp} / ${player.level * 100} XP\`\n\n**المحتوى المفتوح بالمستويات:**`)
                    .addFields(
                        { name: '🔹 Level 1 (مبتدئ)', value: '• الجهاز: وعاء التفاعل\n• التفاعل: تخليق ملح الطعام والماء' },
                        { name: '🔹 Level 2 (باحث)', value: '• الجهاز: الفرن الحراري\n• التفاعل: التفكك الحراري لحجر الجير' },
                        { name: '🔹 Level 3 (خبير كيميائي)', value: '• الجهاز: جهاز التقطير\n• التفاعل: تقطير حمض الهيدروكلوريك المركز' }
                    )
                    .setColor(0xe74c3c);

                return i.followUp({ embeds: [roadmapEmbed], ephemeral: true });
            }

            // 4. المتجر التفاعلي
            if (i.customId === 'btn_open_shop') {
                await i.deferUpdate();
                const shopOptions = Object.entries(labData.items)
                    .filter(([_, item]) => item.buyable)
                    .map(([id, item]) => ({
                        label: item.name,
                        description: `السعر: ${item.price} Valence`,
                        value: id
                    }));

                const shopSelect = new StringSelectMenuBuilder()
                    .setCustomId('select_shop_item')
                    .setPlaceholder('🛒 اختر مادة خام لشرائها...')
                    .addOptions(shopOptions);

                const shopRow = new ActionRowBuilder().addComponents(shopSelect);
                return i.followUp({ content: `💰 **رصيدك الحالي:** \`${player.coins} Valence\``, components: [shopRow], ephemeral: true });
            }

            // إتمام عملية الشراء من المتجر
            if (i.isStringSelectMenu() && i.customId === 'select_shop_item') {
                await i.deferUpdate();
                const itemId = i.values[0];
                const item = labData.items[itemId];

                if (player.coins < item.price) {
                    return i.followUp({ content: `❌ لا تملك **Valence** كافي! سعر المادة: \`${item.price} Valence\``, ephemeral: true });
                }

                player.coins -= item.price;
                player.inv[itemId] = (player.inv[itemId] || 0) + 1;
                updatePlayerData(user.id, player);

                return i.followUp({ content: `✅ تم شراء **1x ${item.name}** بنجاح مقابل \`${item.price} Valence\`!`, ephemeral: true });
            }

            // 5. بيع النواتج
            if (i.customId === 'btn_sell_all') {
                await i.deferUpdate();
                let totalEarned = 0;
                const sellables = ['nacl', 'cao', 'co2', 'hcl_pure'];
                
                sellables.forEach(id => {
                    if (player.inv[id]) {
                        totalEarned += player.inv[id] * labData.items[id].price;
                        delete player.inv[id];
                    }
                });

                if (totalEarned === 0) {
                    return i.followUp({ content: '⚠️ لا تملك أي نواتج مُصنّعة لبيعها حالياً!', ephemeral: true });
                }

                player.coins += totalEarned;
                updatePlayerData(user.id, player);

                return i.followUp({ content: `💵 تم بيع جميع المركبات المصنعة وحصلت على **${totalEarned} Valence**!`, ephemeral: true });
            }

            // 6. اختيار تفاعل وفتح شاشة لوحة المعايرة الحية
            if (i.isStringSelectMenu() && i.customId === 'select_reaction') {
                await i.deferUpdate();
                selectedReactionId = i.values[0];
                const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                // إعادة تعيين المعايرة الافتراضية
                currentTemp = 25;
                currentPress = 1;

                const buildControlPanel = () => {
                    const embed = new EmbedBuilder()
                        .setTitle(`🎛️ لوحة التحكم والمعايرة: ${reaction.name}`)
                        .setDescription(`الجهاز المستعمل: **[${labData.equipment[reaction.tool].name}]**\nاضبط الحرارة والضغط المناسبين ثم اضغط على زر **بدء التفاعل**!`)
                        .setColor(0xf39c12)
                        .addFields(
                            { name: '🔥 الحرارة المعايرة حالياً', value: `\`${currentTemp} °C\``, inline: true },
                            { name: '💨 الضغط المعاير حالياً', value: `\`${currentPress} atm\``, inline: true }
                        );

                    const tempMenu = new StringSelectMenuBuilder()
                        .setCustomId('change_temp')
                        .setPlaceholder('🔥 تغيير درجة الحرارة...')
                        .addOptions([
                            { label: '25 °C (حرارة الغرفة)', value: '25' },
                            { label: '110 °C (غليان وتكثيف)', value: '110' },
                            { label: '900 °C (صهر حراري)', value: '900' }
                        ]);

                    const pressMenu = new StringSelectMenuBuilder()
                        .setCustomId('change_press')
                        .setPlaceholder('💨 تغيير مقدار الضغط...')
                        .addOptions([
                            { label: '1 atm (ضغط جوي عادي)', value: '1' },
                            { label: '2 atm (ضغط مضاعف)', value: '2' },
                            { label: '10 atm (ضغط عالي جدًا)', value: '10' }
                        ]);

                    const startBtn = new ButtonBuilder().setCustomId('btn_start_reaction').setLabel('🚀 بدء التفاعل').setStyle(ButtonStyle.Success);

                    return {
                        embeds: [embed],
                        components: [
                            new ActionRowBuilder().addComponents(tempMenu),
                            new ActionRowBuilder().addComponents(pressMenu),
                            new ActionRowBuilder().addComponents(startBtn)
                        ]
                    };
                };

                return i.followUp({ ...buildControlPanel(), ephemeral: true });
            }

            // تغيير الحرارة مباشرة
            if (i.isStringSelectMenu() && i.customId === 'change_temp') {
                await i.deferUpdate();
                currentTemp = parseInt(i.values[0]);
                const reaction = labData.reactions.find(r => r.id === selectedReactionId);
                
                const updatedEmbed = new EmbedBuilder()
                    .setTitle(`🎛️ لوحة التحكم والمعايرة: ${reaction.name}`)
                    .setDescription(`تم تحديث درجة الحرارة! اضبط الضغط واضغط بدء التفاعل.`)
                    .setColor(0xf39c12)
                    .addFields(
                        { name: '🔥 الحرارة المعايرة حالياً', value: `\`${currentTemp} °C\``, inline: true },
                        { name: '💨 الضغط المعاير حالياً', value: `\`${currentPress} atm\``, inline: true }
                    );

                return i.editReply({ embeds: [updatedEmbed] });
            }

            // تغيير الضغط مباشرة
            if (i.isStringSelectMenu() && i.customId === 'change_press') {
                await i.deferUpdate();
                currentPress = parseInt(i.values[0]);
                const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                const updatedEmbed = new EmbedBuilder()
                    .setTitle(`🎛️ لوحة التحكم والمعايرة: ${reaction.name}`)
                    .setDescription(`تم تحديث الضغط! اضبط الحرارة واضغط بدء التفاعل.`)
                    .setColor(0xf39c12)
                    .addFields(
                        { name: '🔥 الحرارة المعايرة حالياً', value: `\`${currentTemp} °C\``, inline: true },
                        { name: '💨 الضغط المعاير حالياً', value: `\`${currentPress} atm\``, inline: true }
                    );

                return i.editReply({ embeds: [updatedEmbed] });
            }

            // زر بدء التفاعل بعد الفحص النهائي للمعايرة والمواد
            if (i.customId === 'btn_start_reaction') {
                await i.deferUpdate();
                const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                // فحص المواد
                let hasMaterials = true;
                for (const [mat, qty] of Object.entries(reaction.req)) {
                    if (!player.inv[mat] || player.inv[mat] < qty) {
                        hasMaterials = false;
                        break;
                    }
                }

                if (!hasMaterials) {
                    return i.followUp({ content: `❌ **لا تملك المواد الكافية لإتمام التفاعل!**`, ephemeral: true });
                }

                // خصم المواد
                for (const [mat, qty] of Object.entries(reaction.req)) {
                    player.inv[mat] -= qty;
                    if (player.inv[mat] <= 0) delete player.inv[mat];
                }

                // فحص دقة ضبط الحرارة والضغط
                if (currentTemp !== reaction.targetTemp || currentPress !== reaction.targetPress) {
                    updatePlayerData(user.id, player);
                    return i.editReply({
                        content: `💥 **حدث انحراف في المعايرة وتفجر التفاعل!**\nالقيم المدخلة (\`${currentTemp}°C\`, \`${currentPress}atm\`) غير مناسبة لـ ${reaction.name}. خسرت المواد المستخدمة!`,
                        embeds: [], components: []
                    });
                }

                // نجاح المعايرة وتطبيق الانتظار الزمني
                player.busyUntil = currentNow + reaction.timeSec;
                player.pendingYield = { yield: reaction.yield, xp: reaction.xp };
                updatePlayerData(user.id, player);

                return i.editReply({
                    content: `⏳ **بدأ التفاعل بنجاح في [${labData.equipment[reaction.tool].name}]!**\nالوقت المتوقع للإنجاز: **${reaction.timeSec} ثانية**.`,
                    embeds: [], components: []
                });
            }
        });
    }
};

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

// حفظ الملف مباشرة في نفس المجلد الحالي
const dataPath = path.join(__dirname, 'labData.json');

// بيانات مختبر الكيمياء الأولية
const labData = {
    items: {
        na: { name: 'الصوديوم (Na)', price: 15, buyable: true },
        cl: { name: 'الكلور (Cl)', price: 15, buyable: true },
        caco3: { name: 'حجر الجير (CaCO3)', price: 30, buyable: true },
        h2o_imp: { name: 'ماء غير نقي (H2O)', price: 20, buyable: true },
        hcl_raw: { name: 'حمض الهيدروكلوريك الخام', price: 40, buyable: true },
        nacl: { name: 'ملح الطعام (NaCl)', price: 50, buyable: false },
        cao: { name: 'الجير الحي (CaO)', price: 80, buyable: false },
        co2: { name: 'ثاني أكسيد الكربون (CO2)', price: 40, buyable: false },
        hcl_pure: { name: 'حمض الهيدروكلوريك المركز', price: 120, buyable: false }
    },
    equipment: {
        beaker: { name: 'وعاء التفاعل (Beaker)', reqLevel: 1 },
        furnace: { name: 'الفرن الحراري (Furnace)', reqLevel: 2 },
        still: { name: 'جهاز التقطير (Distillation Unit)', reqLevel: 3 }
    },
    reactions: [
        {
            id: 'r_nacl',
            name: 'تخليق ملح الطعام (NaCl)',
            tool: 'beaker',
            req: { na: 1, cl: 1 },
            targetTemp: 25,
            targetPress: 1,
            timeSec: 10,
            yield: { nacl: 1 },
            xp: 25
        },
        {
            id: 'r_cao',
            name: 'التفكك الحراري لحجر الجير',
            tool: 'furnace',
            req: { caco3: 1 },
            targetTemp: 900,
            targetPress: 1,
            timeSec: 20,
            yield: { cao: 1, co2: 1 },
            xp: 60
        },
        {
            id: 'r_hcl',
            name: 'تقطير حمض الهيدروكلوريك المركز',
            tool: 'still',
            req: { hcl_raw: 1, h2o_imp: 1 },
            targetTemp: 110,
            targetPress: 2,
            timeSec: 30,
            yield: { hcl_pure: 1 },
            xp: 100
        }
    ]
};

// التعامل مع قراءة وتحقق الملف تلقائياً
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
            coins: 100,
            inv: { na: 2, cl: 2 },
            busyUntil: 0,
            pendingYield: null
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
        .setDescription('The Lab v1.2'),

    async execute(interaction) {
        const user = interaction.user;
        let player = getPlayerData(user.id);
        const currentNow = Math.floor(Date.now() / 1000);

        if (player.busyUntil > 0 && currentNow >= player.busyUntil) {
            if (player.pendingYield) {
                for (const [itemId, qty] of Object.entries(player.pendingYield.yield)) {
                    player.inv[itemId] = (player.inv[itemId] || 0) + qty;
                }
                player.xp += player.pendingYield.xp;

                const xpNeeded = player.level * 100;
                if (player.xp >= xpNeeded) {
                    player.level += 1;
                    player.xp -= xpNeeded;
                }
            }
            player.busyUntil = 0;
            player.pendingYield = null;
            updatePlayerData(user.id, player);
        }

        const mainEmbed = new EmbedBuilder()
            .setTitle('🧪 واجهة مختبر الكيمياء | The Lab v1.2')
            .setDescription(`مرحباً بك **${user.username}** في المختبر!\nاختر أحد الخيارات أدناه للمعايرة والتفاعل أو إدارة المستودع والمتجر.`)
            .setColor(0x2ecc71)
            .addFields(
                { name: '👤 المستوى', value: `\`Lv.${player.level}\``, inline: true },
                { name: '✨ الخبرة', value: `\`${player.xp} / ${player.level * 100} XP\``, inline: true },
                { name: '💰 رصيد Valence', value: `\`${player.coins}\``, inline: true }
            );

        if (player.busyUntil > currentNow) {
            const timeLeft = player.busyUntil - currentNow;
            mainEmbed.addFields({ 
                name: '⏳ تفاعل قيد التشغيل', 
                value: `متبقي **${timeLeft} ثانية** على انتهاء التفاعل الحالي.` 
            });
        }

        const reactionOptions = labData.reactions.map(r => {
            const reqEquipment = labData.equipment[r.tool];
            const isUnlocked = player.level >= reqEquipment.reqLevel;
            return {
                label: r.name,
                description: `${reqEquipment.name} (طلب Lv.${reqEquipment.reqLevel})`,
                value: r.id,
                disabled: !isUnlocked
            };
        });

        const reactionSelect = new StringSelectMenuBuilder()
            .setCustomId('select_reaction')
            .setPlaceholder('⚗️ اختر تفاعلاً كيميائياً للبدء...')
            .addOptions(reactionOptions);

        const row1 = new ActionRowBuilder().addComponents(reactionSelect);
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_inv').setLabel('🎒 المستودع').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_open_shop').setLabel('🛒 المتجر').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('btn_sell_all').setLabel('💵 بيع النواتج').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('btn_open_equip').setLabel('🧰 الأجهزة').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('btn_open_roadmap').setLabel('📊 المستويات').setStyle(ButtonStyle.Secondary)
        );

        const responseMsg = await interaction.reply({
            embeds: [mainEmbed],
            components: [row1, row2],
            fetchReply: true
        });

        let selectedReactionId = null;
        let currentTemp = 25;
        let currentPress = 1;

        const collector = responseMsg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== user.id) {
                return i.reply({ content: '❌ هذه الواجهة مخصصة لشخص آخر!', ephemeral: true });
            }

            player = getPlayerData(user.id);
            const now = Math.floor(Date.now() / 1000);

            if (i.customId === 'btn_open_inv') {
                await i.deferReply();
                const invList = Object.keys(player.inv).length > 0 
                    ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: ${qty}`).join('\n')
                    : '_المستودع فارغ حالياً_';

                const invEmbed = new EmbedBuilder()
                    .setTitle(`🎒 مستودع المواد الخاص بـ ${user.username}`)
                    .setDescription(invList)
                    .setColor(0x3498db);

                return i.editReply({ embeds: [invEmbed] });
            }

            if (i.customId === 'btn_open_equip') {
                await i.deferReply();
                const equipList = Object.values(labData.equipment)
                    .map(e => `• **${e.name}** - (مطلوب: Lv.${e.reqLevel}) ${player.level >= e.reqLevel ? '✅' : '🔒'}`)
                    .join('\n');
                
                const equipEmbed = new EmbedBuilder()
                    .setTitle('🧰 الأجهزة المتاحة في المختبر')
                    .setDescription(equipList)
                    .setColor(0x9b59b6);

                return i.editReply({ embeds: [equipEmbed] });
            }

            if (i.customId === 'btn_open_roadmap') {
                await i.deferReply();
                const roadmapEmbed = new EmbedBuilder()
                    .setTitle('📊 خريطة المستويات والتقدم')
                    .setDescription(`مستوى **${user.username}** الحالي: **Level ${player.level}**\nالخبرة: \`${player.xp} / ${player.level * 100} XP\`\n\n**المحتوى المفتوح بالمستويات:**`)
                    .addFields(
                        { name: '🔹 Level 1 (مبتدئ)', value: '• الجهاز: وعاء التفاعل\n• التفاعل: تخليق ملح الطعام' },
                        { name: '🔹 Level 2 (باحث)', value: '• الجهاز: الفرن الحراري\n• التفاعل: التفكك الحراري لحجر الجير' },
                        { name: '🔹 Level 3 (خبير كيميائي)', value: '• الجهاز: جهاز التقطير\n• التفاعل: تقطير حمض الهيدروكلوريك المركز' }
                    )
                    .setColor(0xe74c3c);

                return i.editReply({ embeds: [roadmapEmbed] });
            }

            if (i.customId === 'btn_open_shop') {
                await i.deferReply();
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
                return i.editReply({ content: `💰 **رصيد ${user.username}:** \`${player.coins} Valence\``, components: [shopRow] });
            }

            if (i.isStringSelectMenu() && i.customId === 'select_shop_item') {
                await i.deferReply();
                const itemId = i.values[0];
                const item = labData.items[itemId];

                if (player.coins < item.price) {
                    return i.editReply({ content: `❌ يا <@${user.id}>، لا تملك **Valence** كافي! سعر المادة: \`${item.price} Valence\`` });
                }

                player.coins -= item.price;
                player.inv[itemId] = (player.inv[itemId] || 0) + 1;
                updatePlayerData(user.id, player);

                return i.editReply({ content: `✅ تم شراء **1x ${item.name}** بنجاح بواسطة <@${user.id}> مقابل \`${item.price} Valence\`!` });
            }

            if (i.customId === 'btn_sell_all') {
                await i.deferReply();
                let totalEarned = 0;
                const sellables = ['nacl', 'cao', 'co2', 'hcl_pure'];
                
                sellables.forEach(id => {
                    if (player.inv[id]) {
                        totalEarned += player.inv[id] * labData.items[id].price;
                        delete player.inv[id];
                    }
                });

                if (totalEarned === 0) {
                    return i.editReply({ content: `⚠️ يا <@${user.id}>، لا تملك أي نواتج مُصنّعة لبيعها حالياً!` });
                }

                player.coins += totalEarned;
                updatePlayerData(user.id, player);

                return i.editReply({ content: `💵 تم بيع جميع المركبات المصنعة لـ <@${user.id}> وحصل على **${totalEarned} Valence**!` });
            }

            if (i.isStringSelectMenu() && i.customId === 'select_reaction') {
                await i.deferReply();
                selectedReactionId = i.values[0];
                const reaction = labData.reactions.find(r => r.id === selectedReactionId);

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

                return i.editReply({ ...buildControlPanel() });
            }

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

            if (i.customId === 'btn_start_reaction') {
                await i.deferUpdate();
                const reaction = labData.reactions.find(r => r.id === selectedReactionId);

                let hasMaterials = true;
                for (const [mat, qty] of Object.entries(reaction.req)) {
                    if (!player.inv[mat] || player.inv[mat] < qty) {
                        hasMaterials = false;
                        break;
                    }
                }

                if (!hasMaterials) {
                    return i.editReply({ content: `❌ **لا تملك المواد الكافية لإتمام التفاعل!**`, embeds: [], components: [] });
                }

                for (const [mat, qty] of Object.entries(reaction.req)) {
                    player.inv[mat] -= qty;
                    if (player.inv[mat] <= 0) delete player.inv[mat];
                }

                if (currentTemp !== reaction.targetTemp || currentPress !== reaction.targetPress) {
                    updatePlayerData(user.id, player);
                    return i.editReply({
                        content: `💥 **حدث انحراف في المعايرة وتفجر التفاعل!**\nالقيم المدخلة (\`${currentTemp}°C\`, \`${currentPress}atm\`) غير مناسبة لـ ${reaction.name}. خسرت المواد المستخدمة!`,
                        embeds: [], components: []
                    });
                }

                player.busyUntil = now + reaction.timeSec;
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

const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'labData.json');

const labData = {
    items: {
        // --- مواد أولية قابلة للشراء ---
        na: { name: 'الصوديوم (Na)', price: 15, buyable: true, state: '🪨 صلب' },
        cl: { name: 'الكلور (Cl)', price: 15, buyable: true, state: '💨 غاز' },
        caco3: { name: 'حجر الجير (CaCO3)', price: 30, buyable: true, state: '🪨 صلب' },
        h2o_imp: { name: 'ماء غير نقي (H2O)', price: 20, buyable: true, state: '💧 سائل' },
        fe: { name: 'الحديد (Fe)', price: 35, buyable: true, state: '🪨 صلب' },
        o2: { name: 'الأكسجين (O2)', price: 25, buyable: true, state: '💨 غاز' },
        h2: { name: 'الهيدروجين (H2)', price: 25, buyable: true, state: '💨 غاز' },
        so2: { name: 'ثاني أكسيد الكبريت (SO2)', price: 40, buyable: true, state: '💨 غاز' },
        cu: { name: 'النحاس (Cu)', price: 50, buyable: true, state: '🪨 صلب' },
        hno3: { name: 'حمض النيتريك (HNO3)', price: 75, buyable: true, state: '💧 سائل' },

        // --- النواتج القابلة للبيع ---
        nacl: { name: 'ملح الطعام (NaCl)', price: 50, buyable: false, state: '🪨 صلب', desc: 'مركب أيوني ناتج من تفاعل الصوديوم والكلور.' },
        cao: { name: 'الجير الحي (CaO)', price: 80, buyable: false, state: '🪨 صلب', desc: 'ينتج عن التفكك الحراري لحجر الجير.' },
        co2: { name: 'ثاني أكسيد الكربون (CO2)', price: 40, buyable: false, state: '💨 غاز', desc: 'غاز ينطلق كناتج ثانوي.' },
        h2o_pure: { name: 'ماء نقي 💧 (Pure H2O)', price: 45, buyable: false, state: '💧 سائل', desc: 'ماء مقطر عالي النقاوة.' },
        fe2o3: { name: 'أكسيد الحديد (Fe2O3)', price: 90, buyable: false, state: '🪨 صلب', desc: 'مركب ناتج من أكسدة الحديد العالية.' },
        h2so4: { name: 'حمض الكبريتيك (H2SO4)', price: 150, buyable: false, state: '💧 سائل', desc: 'حمض شديد التآكل.' },
        cuno3_2: { name: 'نترات النحاس Cu(NO3)2', price: 180, buyable: false, state: '🪨 بلورات', desc: 'مركب كيميائي عالي القيمة مستخدم في الطلاء.' },
        n2: { name: 'غاز النيتروجين النقي (N2)', price: 210, buyable: false, state: '💨 غاز', desc: 'غاز خامل ممتاز للتطبيقات الصناعية.' }
    },
    equipment: {
        beaker: { name: 'وعاء التفاعل (Beaker)', reqLevel: 1 },
        electrolysis: { name: 'جهاز التحليل الكهربائي', reqLevel: 2 },
        still: { name: 'جهاز التقطير (Distillation)', reqLevel: 3 },
        combustion: { name: 'مفاعل الأكسدة', reqLevel: 4 },
        furnace: { name: 'الفرن الحراري (Furnace)', reqLevel: 5 },
        oxidation_tower: { name: 'برج الأكسدة الكيميائية', reqLevel: 6 },
        autoclave: { name: 'مفاعل الضغط العالي (Autoclave)', reqLevel: 7 },
        reflux_sys: { name: 'غرفة التكثيف والتبخير (Reflux)', reqLevel: 8 }
    },
    upgrades: {
        speed: { id: 'up_speed', name: '⚡ المسرع الكيميائي (سرعة x2)', price: 200, desc: 'يخفض زمن التفاعلات 50%' },
        shield: { id: 'up_shield', name: '🛡️ درع الحماية من الانفجار', price: 150, desc: 'يحميك من خسارة المواد عند الخطأ' }
    },
    reactions: [
        { id: 'r_nacl', name: '🧪 تخليق ملح الطعام (NaCl)', tool: 'beaker', reqLevel: 1, costAbility: 1, req: { na: 1, cl: 1 }, targetTemp: 25, targetPress: 1, timeSec: 10, yield: { nacl: 1 }, xp: 25 },
        { id: 'r_electrolysis_h2o', name: '⚡ تحليل الماء كهروبيائياً (H2 + O2)', tool: 'electrolysis', reqLevel: 2, costAbility: 2, req: { h2o_imp: 2 }, targetTemp: 25, targetPress: 1, timeSec: 12, yield: { h2: 2, o2: 1 }, xp: 40 },
        { id: 'r_h2o', name: '💧 تنقية وتقطير الماء (H2O)', tool: 'still', reqLevel: 3, costAbility: 2, req: { h2o_imp: 1 }, targetTemp: 110, targetPress: 1, timeSec: 15, yield: { h2o_pure: 1 }, xp: 35 },
        { id: 'r_fe2o3', name: '🔥 أكسدة الحديد وتكوين أكسيد الحديد', tool: 'combustion', reqLevel: 4, costAbility: 3, req: { fe: 2, o2: 1 }, targetTemp: 500, targetPress: 2, timeSec: 18, yield: { fe2o3: 1 }, xp: 70 },
        { id: 'r_cao', name: '🔥 التفكك الحراري لحجر الجير', tool: 'furnace', reqLevel: 5, costAbility: 4, req: { caco3: 1 }, targetTemp: 900, targetPress: 1, timeSec: 20, yield: { cao: 1, co2: 1 }, xp: 60 },
        { id: 'r_h2so4_prep', name: '💨 أكسدة الكبريت المتقدمة (H2SO4)', tool: 'oxidation_tower', reqLevel: 6, costAbility: 4, req: { so2: 1, o2: 1, h2o_pure: 1 }, targetTemp: 500, targetPress: 2, timeSec: 22, yield: { h2so4: 1 }, xp: 85 },
        { id: 'r_cuno3', name: '⚗️ تفاعل النحاس مع حمض النيتريك', tool: 'autoclave', reqLevel: 7, costAbility: 5, req: { cu: 1, hno3: 2 }, targetTemp: 110, targetPress: 3, timeSec: 25, yield: { cuno3_2: 1 }, xp: 100 },
        { id: 'r_nitrogen_prod', name: '💥 التفكك الانفجاري المحكوم لإنتاج النيتروجين', tool: 'reflux_sys', reqLevel: 8, costAbility: 5, req: { hno3: 2, fe: 1 }, targetTemp: 900, targetPress: 3, timeSec: 30, yield: { n2: 2 }, xp: 120 }
    ]
};

const TEMP_STEPS = [25, 110, 500, 900];
const PRESS_STEPS = [1, 2, 3];

function ensureDataFile() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
}

function getPlayerData(userId) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }

    if (!db[userId]) {
        db[userId] = {
            level: 1, xp: 0, coins: 200, abilityPoints: 2,
            unlockedReactions: ['r_nacl'],
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1 },
            codex: [], upgrades: { speed: false, shield: false },
            quest: { item: 'h2o_pure', count: 2, progress: 0, rewardCoins: 100, rewardXp: 50, completed: false },
            pendingQueue: []
        };
        fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    }
    if (db[userId].abilityPoints === undefined) db[userId].abilityPoints = 1;
    if (!db[userId].unlockedReactions) db[userId].unlockedReactions = ['r_nacl'];

    return db[userId];
}

function updatePlayerData(userId, data) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }
    db[userId] = data;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
}

// 🌐 1. القائمة الرئيسية المبسطة
function buildMainMenu(user, player) {
    const embed = new EmbedBuilder()
        .setTitle('🧪 Lab v1.3')
        .setDescription(`مرحباً بك **${user.username}** 👋`)
        .setColor(0x2ecc71)
        .addFields(
            { name: '👤 المستوى', value: `\`Lv.${player.level} / 100\``, inline: true },
            { name: '✨ الخبرة', value: `\`${player.xp} / ${player.level * 100} XP\``, inline: true },
            { name: '⚡ نقاط القدرة', value: `\`${player.abilityPoints} نقطة\``, inline: true },
            { name: '💰 Valence', value: `\`${player.coins} 🪙\``, inline: true },
            { name: '📘 الموسوعة', value: `\`${player.codex.length} / 8\``, inline: true },
            { name: '🛡️ الحماية', value: player.upgrades.shield ? '`مفعل ✅`' : '`غير مفعل ❌`', inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: 'اختر إجراءً سريعاً أو فتح القائمة الإضافية' });

    if (player.pendingQueue && player.pendingQueue.length > 0) {
        embed.addFields({ name: '⏳ تفاعلات جارية', value: `عدد التفاعلات قيد التنفيذ: **${player.pendingQueue.length}**` });
    }

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_reactions').setLabel('غرفة التفاعلات').setEmoji('⚗️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_shop').setLabel('المتجر').setEmoji('🛒').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_sell_all').setLabel('بيع النواتج').setEmoji('💵').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('القائمة الإضافية 📂').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

// 📂 2. قائمة الفرعيات (More Menu)
function buildMoreMenu(user, player) {
    const embed = new EmbedBuilder()
        .setTitle('📂 القائمة الإضافية - المختبر')
        .setDescription('اختر القسم الذي تريد استعراضه من الخيارات التالية:')
        .setColor(0x7289da)
        .addFields(
            { name: '📜 القدرات والمستويات', value: 'تصفح التفاعلات المتاحة وافتح تفاعلات جديدة بنقاط القدرة.', inline: false },
            { name: '📋 المهام اليومية', value: 'استعرض أهدافك اليومية واستلم المكافآت عند الإنجاز.', inline: false },
            { name: '🎒 المستودع', value: 'استعرض كافة المواد الأولية والمركبات المتوفرة لديك.', inline: false },
            { name: '📘 الموسوعة الكيميائية', value: 'تصفح المركبات الكيميائية التي تم اكتشافها وتصنيعها.', inline: false }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_levels').setLabel('المستويات').setEmoji('📜').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_quest').setLabel('المهام').setEmoji('📋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_codex').setLabel('الموسوعة').setEmoji('📘').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرجوع للرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2] };
}

// 📜 3. شاشة القدرات والمستويات (نظام أسهم)
function buildLevelScreen(player, index) {
    const reaction = labData.reactions[index];
    const isUnlocked = player.unlockedReactions.includes(reaction.id);
    const isLevelReached = player.level >= reaction.reqLevel;

    const reqList = Object.entries(reaction.req)
        .map(([id, qty]) => `• ${labData.items[id]?.name || id}: \`${qty}\``)
        .join('\n');

    const yieldList = Object.entries(reaction.yield)
        .map(([id, qty]) => `• ${labData.items[id]?.name || id}: \`${qty}\``)
        .join('\n');

    let statusText = '🔒 مغلق (المستوى غير كافي)';
    let btnStyle = ButtonStyle.Secondary;
    let btnDisabled = true;
    let btnLabel = '🔒 غير متاح للفتح';

    if (isUnlocked) {
        statusText = '✅ مفتوح وجاهز للاستخدام';
        btnLabel = '✅ تم الفتح بالكامل';
    } else if (isLevelReached) {
        statusText = `🟡 متاح للفتح! (التكلفة: ${reaction.costAbility} ⚡)`;
        btnStyle = ButtonStyle.Success;
        btnDisabled = player.abilityPoints < reaction.costAbility;
        btnLabel = `🔓 فتح التفاعل (${reaction.costAbility} ⚡)`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📜 تفاعل: ${reaction.name}`)
        .setDescription(`**الحالة:** ${statusText}\n\n**الجهاز المطلوب:** ${labData.equipment[reaction.tool]?.name}`)
        .setColor(isUnlocked ? 0x2ecc71 : (isLevelReached ? 0xf1c40f : 0xe74c3c))
        .addFields(
            { name: '🎯 المستوى المطلوب', value: `\`Lv.${reaction.reqLevel}\``, inline: true },
            { name: '⚡ تكلفة القدرة', value: `\`${reaction.costAbility} نقطة\``, inline: true },
            { name: '⭐ خبرة التفاعل', value: `\`+${reaction.xp} XP\``, inline: true },
            { name: '🧪 المواد المطلوبة', value: reqList || 'لا يوجد', inline: true },
            { name: '✨ النواتج المتوقعة', value: yieldList || 'لا يوجد', inline: true }
        )
        .setFooter({ text: `نقاط القدرة لديك: ${player.abilityPoints} ⚡ | تفاعل ${index + 1} من ${labData.reactions.length}` });

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_lvl_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_unlock_reaction_${reaction.id}`).setLabel(btnLabel).setStyle(btnStyle).setDisabled(btnDisabled),
        new ButtonBuilder().setCustomId('btn_lvl_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === labData.reactions.length - 1),
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

// 🛒 4. شاشة المتجر والترقيات (نظام أسهم)
function buildShopScreen(player, index) {
    const shopList = [
        ...Object.entries(labData.items).filter(([_, item]) => item.buyable).map(([id, item]) => ({ type: 'item', id, ...item })),
        ...Object.values(labData.upgrades).map(up => ({ type: 'upgrade', ...up }))
    ];

    const currentItem = shopList[index];
    let buyBtnDisabled = false;
    let buyBtnLabel = `🛒 شراء بـ ${currentItem.price} Valence`;

    if (currentItem.type === 'upgrade') {
        const isOwned = player.upgrades[currentItem.id.replace('up_', '')];
        if (isOwned) {
            buyBtnDisabled = true;
            buyBtnLabel = '✅ تمتلك هذه الترقية';
        } else if (player.coins < currentItem.price) {
            buyBtnDisabled = true;
            buyBtnLabel = `❌ الرصيد غير كافي (${currentItem.price} Valence)`;
        }
    } else {
        if (player.coins < currentItem.price) {
            buyBtnDisabled = true;
            buyBtnLabel = `❌ الرصيد غير كافي (${currentItem.price} Valence)`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛒 المتجر: ${currentItem.name}`)
        .setDescription(currentItem.desc || `عنصر كيميائي أولي يستعمل في التفاعلات المخبرية.\n**الحالة الفيزيائية:** ${currentItem.state || 'غير محدد'}`)
        .setColor(0xf1c40f)
        .addFields(
            { name: '💵 السعر', value: `\`${currentItem.price} Valence 🪙\``, inline: true },
            { name: '🎒 الكمية الحالية لديك', value: currentItem.type === 'item' ? `\`${player.inv[currentItem.id] || 0}\`` : (player.upgrades[currentItem.id.replace('up_', '')] ? '`مفعّل`' : '`غير مفعّل`'), inline: true }
        )
        .setFooter({ text: `رصيدك الحالي: ${player.coins} Valence 🪙 | عنصر ${index + 1} من ${shopList.length}` });

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_shop_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_buy_shop_${currentItem.type}_${currentItem.id}`).setLabel(buyBtnLabel).setStyle(ButtonStyle.Success).setDisabled(buyBtnDisabled),
        new ButtonBuilder().setCustomId('btn_shop_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === shopList.length - 1),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

// 🎛️ 5. شاشة معايرة التفاعل
function buildCalibScreen(reaction, tempIndex, pressIndex) {
    const currentTemp = TEMP_STEPS[tempIndex];
    const currentPress = PRESS_STEPS[pressIndex];

    const reqList = Object.entries(reaction.req)
        .map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``)
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
        .setDescription(`**الجهاز المستخدم:** ${labData.equipment[reaction.tool]?.name}\nاضبط الحرارة والضغط بالأسهم ثم اضغط **بدء التفاعل**.`)
        .setColor(0xe74c3c)
        .addFields(
            { name: '🔥 درجة الحرارة الحالية', value: `\`${currentTemp} °C\``, inline: true },
            { name: '💨 الضغط الجوي الحالي', value: `\`${currentPress} atm\``, inline: true },
            { name: '🧪 المواد المطلوبة', value: reqList, inline: false }
        );

    const tempRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_temp_down').setLabel('🔥 حرارة ➖').setStyle(ButtonStyle.Primary).setDisabled(tempIndex === 0),
        new ButtonBuilder().setCustomId('btn_temp_val').setLabel(`🔥 ${currentTemp} °C`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('btn_temp_up').setLabel('🔥 حرارة ➕').setStyle(ButtonStyle.Primary).setDisabled(tempIndex === TEMP_STEPS.length - 1)
    );

    const pressRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_press_down').setLabel('💨 ضغط ➖').setStyle(ButtonStyle.Primary).setDisabled(pressIndex === 0),
        new ButtonBuilder().setCustomId('btn_press_val').setLabel(`💨 ${currentPress} atm`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('btn_press_up').setLabel('💨 ضغط ➕').setStyle(ButtonStyle.Primary).setDisabled(pressIndex === PRESS_STEPS.length - 1)
    );

    const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_start_reaction').setLabel('🚀 بدء التفاعل').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_open_reactions').setLabel('↩️ إلغاء').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [tempRow, pressRow, actionRow] };
}

// ⚗️ 6. شاشة تصفح التفاعلات المتاحة
function buildReactionsScreen(player, index) {
    const unlockedList = labData.reactions.filter(r => player.unlockedReactions.includes(r.id));

    if (unlockedList.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('⚗️ غرفة التفاعلات')
            .setDescription('❌ لا تملك أي تفاعلات مفتوحة حالياً! افتح **شجرة القدرات والمستويات** لفتح تفاعلاتك الأولى.')
            .setColor(0xe74c3c);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_levels').setLabel('فتح القدرات').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [emptyEmbed], components: [row] };
    }

    const reaction = unlockedList[index];
    const reqList = Object.entries(reaction.req)
        .map(([id, qty]) => `• ${labData.items[id]?.name || id}: \`${qty}\` (لديك: \`${player.inv[id] || 0}\`)`)
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`⚗️ اختر تفاعلاً: ${reaction.name}`)
        .setDescription(`**الجهاز:** ${labData.equipment[reaction.tool]?.name}\n**الوقت المطلوب:** \`${player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec} ثانية\``)
        .setColor(0x3498db)
        .addFields(
            { name: '🧪 المواد المطلوبة للتفاعل', value: reqList },
            { name: '⭐ خبرة التفاعل', value: `\`+${reaction.xp} XP\``, inline: true }
        )
        .setFooter({ text: `تفاعل ${index + 1} من ${unlockedList.length}` });

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_react_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_select_calib_${reaction.id}`).setLabel('🎛️ بدء المعايرة').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_react_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === unlockedList.length - 1),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

// 📘 7. شاشة الموسوعة الكيميائية (Codex)
function buildCodexScreen(player) {
    const discovered = player.codex || [];
    let codexList = '';

    const allProducts = ['nacl', 'cao', 'co2', 'h2o_pure', 'fe2o3', 'h2so4', 'cuno3_2', 'n2'];

    allProducts.forEach(id => {
        const item = labData.items[id];
        if (discovered.includes(id)) {
            codexList += `✅ **${item.name}** (${item.state})\n_${item.desc}_\n\n`;
        } else {
            codexList += `❓ **مركب مجهول** - (لم تقم بتصنيعه بعد)\n\n`;
        }
    });

    const embed = new EmbedBuilder()
        .setTitle('📘 الموسوعة الكيميائية (Codex)')
        .setDescription(codexList)
        .setColor(0x9b59b6)
        .setFooter({ text: `تم اكتشاف ${discovered.length} من أصل 8 مركبات` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

// 🧠 8. معالج الجلسة التفاعلي
async function handleLabSession(context, user) {
    let player = getPlayerData(user.id);
    const channel = context.channel;
    const currentNow = Math.floor(Date.now() / 1000);

    // معالجة التفاعلات المكتملة في الخلفية
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
                player.abilityPoints += 1;
                
                if (player.xp >= player.level * 100) {
                    player.level += 1;
                    player.xp -= player.level * 100;
                    player.abilityPoints += 2;
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

    // حالات التصفح المحلية للجلسة
    let lvlIndex = 0;
    let shopIndex = 0;
    let reactIndex = 0;
    let selectedReaction = null;
    let tempIndex = 0;
    let pressIndex = 0;

    const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
        if (i.user.id !== user.id) return i.reply({ content: '❌ هذه اللوحة غير مخصصة لك!', ephemeral: true });

        player = getPlayerData(user.id);

        const backMoreBtnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('الرجوع للقائمة الإضافية ↩️').setStyle(ButtonStyle.Secondary)
        );

        // --- 🏠 Navigation Control ---
        if (i.customId === 'btn_back_main') {
            return await i.update(buildMainMenu(user, player));
        }

        if (i.customId === 'btn_open_more_menu') {
            return await i.update(buildMoreMenu(user, player));
        }

        // --- 🎒 المستودع ---
        if (i.customId === 'btn_open_inv') {
            const invList = Object.keys(player.inv).length > 0 
                ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``).join('\n')
                : '_المستودع فارغ حالياً_';

            const invEmbed = new EmbedBuilder()
                .setTitle(`🎒 مستودع المواد - ${user.username}`)
                .setDescription(invList)
                .setColor(0x3498db);

            return await i.update({ embeds: [invEmbed], components: [backMoreBtnRow] });
        }

        // --- 📘 الموسوعة الكيميائية ---
        if (i.customId === 'btn_open_codex') {
            return await i.update(buildCodexScreen(player));
        }

        // --- 📜 القدرات والمستويات ---
        if (i.customId === 'btn_open_levels') {
            lvlIndex = 0;
            return await i.update(buildLevelScreen(player, lvlIndex));
        }
        if (i.customId === 'btn_lvl_prev') {
            lvlIndex--;
            return await i.update(buildLevelScreen(player, lvlIndex));
        }
        if (i.customId === 'btn_lvl_next') {
            lvlIndex++;
            return await i.update(buildLevelScreen(player, lvlIndex));
        }
        if (i.customId.startsWith('btn_unlock_reaction_')) {
            const rId = i.customId.replace('btn_unlock_reaction_', '');
            const reaction = labData.reactions.find(r => r.id === rId);

            if (player.abilityPoints >= reaction.costAbility) {
                player.abilityPoints -= reaction.costAbility;
                player.unlockedReactions.push(reaction.id);
                updatePlayerData(user.id, player);
                await i.reply({ content: `✅ **تم فتح (${reaction.name}) بنجاح!**`, ephemeral: true });
                return await i.message.edit(buildLevelScreen(player, lvlIndex));
            } else {
                return await i.reply({ content: '❌ لا تملك نقاط قدرة كافية!', ephemeral: true });
            }
        }

        // --- 🛒 المتجر والترقيات ---
        if (i.customId === 'btn_open_shop') {
            shopIndex = 0;
            return await i.update(buildShopScreen(player, shopIndex));
        }
        if (i.customId === 'btn_shop_prev') {
            shopIndex--;
            return await i.update(buildShopScreen(player, shopIndex));
        }
        if (i.customId === 'btn_shop_next') {
            shopIndex++;
            return await i.update(buildShopScreen(player, shopIndex));
        }
        if (i.customId.startsWith('btn_buy_shop_')) {
            const parts = i.customId.replace('btn_buy_shop_', '').split('_');
            const type = parts[0];
            const id = parts.slice(1).join('_');

            if (type === 'upgrade') {
                const upItem = labData.upgrades[id];
                if (player.coins >= upItem.price) {
                    player.coins -= upItem.price;
                    player.upgrades[id] = true;
                    updatePlayerData(user.id, player);
                    await i.reply({ content: `🎉 **تم شراء الترقية (${upItem.name}) بنجاح!**`, ephemeral: true });
                }
            } else {
                const item = labData.items[id];
                if (player.coins >= item.price) {
                    player.coins -= item.price;
                    player.inv[id] = (player.inv[id] || 0) + 1;
                    updatePlayerData(user.id, player);
                    await i.reply({ content: `🛒 **تم شراء 1x (${item.name}) بنجاح!**`, ephemeral: true });
                }
            }
            return await i.message.edit(buildShopScreen(player, shopIndex));
        }

        // --- ⚗️ غرفة التفاعلات والمعايرة ---
        if (i.customId === 'btn_open_reactions') {
            reactIndex = 0;
            return await i.update(buildReactionsScreen(player, reactIndex));
        }
        if (i.customId === 'btn_react_prev') {
            reactIndex--;
            return await i.update(buildReactionsScreen(player, reactIndex));
        }
        if (i.customId === 'btn_react_next') {
            reactIndex++;
            return await i.update(buildReactionsScreen(player, reactIndex));
        }
        if (i.customId.startsWith('btn_select_calib_')) {
            const rId = i.customId.replace('btn_select_calib_', '');
            selectedReaction = labData.reactions.find(r => r.id === rId);
            tempIndex = 0;
            pressIndex = 0;
            return await i.update(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }

        // أزرار التحكم بالحرارة والضغط
        if (i.customId === 'btn_temp_down') {
            tempIndex--;
            return await i.update(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_temp_up') {
            tempIndex++;
            return await i.update(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_press_down') {
            pressIndex--;
            return await i.update(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_press_up') {
            pressIndex++;
            return await i.update(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }

        // بدء التفاعل الكيميائي
        if (i.customId === 'btn_start_reaction') {
            const reaction = selectedReaction;

            // التحقق من توفر المواد
            for (const [mat, qty] of Object.entries(reaction.req)) {
                if (!player.inv[mat] || player.inv[mat] < qty) {
                    return await i.reply({ content: `❌ لا تملك المواد الكافية! تحتاج إلى (${labData.items[mat]?.name || mat} x${qty})`, ephemeral: true });
                }
            }

            const currentTemp = TEMP_STEPS[tempIndex];
            const currentPress = PRESS_STEPS[pressIndex];

            // خصم المواد
            for (const [mat, qty] of Object.entries(reaction.req)) {
                player.inv[mat] -= qty;
                if (player.inv[mat] <= 0) delete player.inv[mat];
            }

            // فحص صحة المعايرة
            if (currentTemp !== reaction.targetTemp || currentPress !== reaction.targetPress) {
                if (!player.upgrades.shield) {
                    updatePlayerData(user.id, player);
                    await i.reply({ content: '💥 **حدث انفجار مخبري بسبب ضبط درجات حرارة أو ضغط خاطئة! خسرت المواد.**', ephemeral: true });
                } else {
                    updatePlayerData(user.id, player);
                    await i.reply({ content: '🛡️ **فشل التفاعل بسبب المعايرة الخاطئة، ولكن درع الحماية منع انفجار المواد!**', ephemeral: true });
                }
                return await i.message.edit(buildMainMenu(user, player));
            }

            let duration = player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec;
            player.pendingQueue.push({ busyUntil: Math.floor(Date.now() / 1000) + duration, yield: reaction.yield, xp: reaction.xp });
            updatePlayerData(user.id, player);

            setTimeout(() => {
                channel.send(`🎉 <@${user.id}> **اكتمل التفاعل الكيميائي (${reaction.name})! افتح المختبر لاستلام نتائجك.**`).catch(() => {});
            }, duration * 1000);

            await i.reply({ content: `🚀 **بدأ تفاعل (${reaction.name})! سينتهي بعد ${duration} ثانية.**`, ephemeral: true });
            return await i.message.edit(buildMainMenu(user, player));
        }

        // --- 📋 المهام اليومية ---
        if (i.customId === 'btn_open_quest') {
            const q = player.quest;
            const itemNeeded = labData.items[q.item];
            
            const questEmbed = new EmbedBuilder()
                .setTitle('📜 المهام اليومية')
                .addFields(
                    { name: '🎯 المطلوب', value: `إنتاج **${q.count}x ${itemNeeded?.name || q.item}**`, inline: true },
                    { name: '📊 التقدم الحالي', value: `\`${q.progress} / ${q.count}\``, inline: true },
                    { name: '🎁 المكافأة', value: `\`+${q.rewardCoins} Valence\` | \`+${q.rewardXp} XP\``, inline: true }
                )
                .setColor(0xe67e22);

            const claimBtn = new ButtonBuilder()
                .setCustomId('btn_claim_quest')
                .setLabel('تسليم المهمة')
                .setStyle(ButtonStyle.Success)
                .setDisabled(q.completed || q.progress < q.count);

            const questRow = new ActionRowBuilder().addComponents(claimBtn, backMoreBtnRow.components[0]);
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

        // --- 💵 بيع النواتج ---
        if (i.customId === 'btn_sell_all') {
            let totalEarned = 0;
            let soldList = [];
            const sellableItems = ['nacl', 'cao', 'co2', 'h2o_pure', 'fe2o3', 'h2so4', 'cuno3_2', 'n2'];

            sellableItems.forEach(id => {
                if (player.inv[id] && player.inv[id] > 0) {
                    const qty = player.inv[id];
                    const price = labData.items[id].price * qty;
                    totalEarned += price;
                    soldList.push(`• **${labData.items[id].name}** (x${qty}) ➔ \`+${price} Valence\``);
                    delete player.inv[id];
                }
            });

            if (totalEarned === 0) {
                return await i.reply({ content: '⚠️ لا تملك أي مواد مُصنّعة قابلة للبيع حالياً!', ephemeral: true });
            }

            player.coins += totalEarned;
            updatePlayerData(user.id, player);

            await i.reply({
                content: `💵 **تمت عملية البيع بنجاح!**\n${soldList.join('\n')}\n\n💰 الإجمالي المضاف لرصيدك: **+${totalEarned} Valence** 🪙`,
                ephemeral: true
            });

            return await i.message.edit(buildMainMenu(user, player));
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder().setName('lab').setDescription('مختبر v1.3'),
    async execute(interaction) {
        await handleLabSession(interaction, interaction.user);
    },
    handleLabSession
};

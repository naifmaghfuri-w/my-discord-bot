const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'labData.json');

const labData = {
    items: {
        // --- مواد أولية قابلة للشراء (المستويات 1 - 5) ---
        na: { name: 'الصوديوم (Na)', price: 15, buyable: true, state: '🪨 صلب' },
        cl: { name: 'الكلور (Cl)', price: 15, buyable: true, state: '💨 غاز' },
        caco3: { name: 'حجر الجير (CaCO3)', price: 30, buyable: true, state: '🪨 صلب' },
        h2o_imp: { name: 'ماء غير نقي (H2O)', price: 20, buyable: true, state: '💧 سائل' },
        fe: { name: 'الحديد (Fe)', price: 35, buyable: true, state: '🪨 صلب' },
        o2: { name: 'الأكسجين (O2)', price: 25, buyable: true, state: '💨 غاز' },
        h2: { name: 'الهيدروجين (H2)', price: 25, buyable: true, state: '💨 غاز' },
        so2: { name: 'ثاني أكسيد الكبريت (SO2)', price: 40, buyable: true, state: '💨 غاز' },
        cu: { name: 'النحاس (Cu)', price: 50, buyable: true, state: '🪨 صلب' },
        hno3: { name: 'حمض النيتريك (HNO3)', price: 75, buyable: true, state: '💧 سائل', shelfLife: 3600 },

        // --- مواد أولية (المستويات 6 - 15) ---
        hno3_dilute: { name: 'حمض النيتريك المخفف (HNO3)', price: 50, buyable: true, state: '💧 سائل', shelfLife: 4800, reqLevel: 6 },
        zn: { name: 'مسحوق الزنك (Zn)', price: 65, buyable: true, state: '🪨 مسحوق', reqLevel: 7 },
        nh3: { name: 'محلول الأمونيا (NH3)', price: 80, buyable: true, state: '💧 سائل', shelfLife: 3600, reqLevel: 8 },
        cuso4: { name: 'كبريتات النحاس (CuSO4)', price: 110, buyable: true, state: '🪨 بلورات', reqLevel: 9 },
        ethanol: { name: 'إيثانول (C2H5OH)', price: 140, buyable: true, state: '💧 سائل', shelfLife: 7200, reqLevel: 10 },
        naoh: { name: 'هيدروكسيد الصوديوم (NaOH)', price: 170, buyable: true, state: '🪨 صلب', reqLevel: 11 },
        ch3cooh: { name: 'حمض الاستيك (CH3COOH)', price: 200, buyable: true, state: '💧 سائل', shelfLife: 5400, reqLevel: 12 },
        oxalic: { name: 'حمض الأوكزاليك (C2H2O4)', price: 280, buyable: true, state: '🪨 صلب', reqLevel: 14 },

        // --- مواد v1.5 (المستويات 16 - 25) ---
        au_ore: { name: 'خام الذهب (Au Ore)', price: 500, buyable: true, state: '🪨 خام', reqLevel: 16 },
        pt_ore: { name: 'خام البلاتين (Pt Ore)', price: 750, buyable: true, state: '🪨 خام', reqLevel: 18 },
        benzene_raw: { name: 'قطران الفحم (مصدر البنزين)', price: 350, buyable: true, state: '💧 سائل', reqLevel: 17 },

        // --- النواتج ---
        nacl: { name: 'ملح الطعام (NaCl)', price: 50, buyable: false, state: '🪨 صلب', desc: 'مركب أيوني ناتج من تفاعل الصوديوم والكلور.' },
        cao: { name: 'الجير الحي (CaO)', price: 80, buyable: false, state: '🪨 صلب', desc: 'ينتج عن التفكك الحراري لحجر الجير.' },
        co2: { name: 'ثاني أكسيد الكربون (CO2)', price: 40, buyable: false, state: '💨 غاز', desc: 'غاز ينطلق كناتج ثانوي.' },
        h2o_pure: { name: 'ماء نقي 💧 (Pure H2O)', price: 45, buyable: false, state: '💧 سائل', desc: 'ماء مقطر عالي النقاوة.' },
        fe2o3: { name: 'أكسيد الحديد (Fe2O3)', price: 90, buyable: false, state: '🪨 صلب', desc: 'مركب ناتج من أكسدة الحديد العالية.' },
        h2so4: { name: 'حمض الكبريتيك (H2SO4)', price: 150, buyable: false, state: '💧 سائل', desc: 'حمض شديد التآكل.', shelfLife: 2700 },
        cuno3_2: { name: 'نترات النحاس Cu(NO3)2', price: 180, buyable: false, state: '🪨 بلورات', desc: 'مركب كيميائي عالي القيمة مستخدم في الطلاء.' },
        n2: { name: 'غاز النيتروجين النقي (N2)', price: 210, buyable: false, state: '💨 غاز', desc: 'غاز خامل ممتاز للتطبيقات الصناعية.' },
        zn_no3: { name: 'نترات الزنك Zn(NO3)2', price: 180, buyable: false, state: '🪨 بلورات', desc: 'مركب ناتج عن تفاعل الزنك مع حمض النيتريك المخفف.' },
        nh4no3: { name: 'نترات الأمونيوم (NH4NO3)', price: 260, buyable: false, state: '🪨 بلورات', desc: 'سماد نتروجيني مركب عالي التركيز.' },
        copper_cryst: { name: 'بلورات النحاس المنقاة', price: 340, buyable: false, state: '🪨 بلورات', desc: 'بلورات نحاسية زرقاء نقية جداً.' },
        pure_ethanol: { name: 'إيثانول منقى 100%', price: 450, buyable: false, state: '💧 سائل', desc: 'مذيب عضوي عالي النقاء مستخلص بالتقطير.' },
        salt_neutral: { name: 'محلول ملحي متعادل', price: 520, buyable: false, state: '💧 سائل', desc: 'ناتج تفاعل التعادل بين حمض وقاعدة قوية.' },
        ethyl_acetate: { name: 'إيثيل أسيتات', price: 680, buyable: false, state: '💧 سائل', desc: 'مذيب عضوي عطري ذو استخدامات صناعية واسعة.' },
        dry_precipitate: { name: 'مسحوق جاف فائق النقاء', price: 1100, buyable: false, state: '🪨 مسحوق', desc: 'ناتج تجفيف المترسبات المعقدة في الفرن الزجاجي.' },
        secret_compound: { name: 'المركب السري النادر ✨', price: 2500, buyable: false, state: '✨ طاقة', desc: 'اكتشاف نادر جداً ناتج عن الخلط العشوائي للمواد.' },
        pure_gold: { name: 'الذهب النقي (Au)', price: 2200, buyable: false, state: '✨ معدن نفيس', desc: 'سبائك ذهب عالية النقاوة مستخلصة كيميائياً.' },
        pure_platinum: { name: 'البلاتين الصافي (Pt)', price: 3500, buyable: false, state: '✨ معدن نفيس', desc: 'عنصر البلاتين النادر المستخرج عبر تحليل كهرومغناطيسي.' },
        benzene: { name: 'مركب البنزين العطري (C6H6)', price: 1200, buyable: false, state: '💧 سائل', desc: 'مركب عضوي حلقي أساسي في الصناعات المتقدمة.' },
        nitroglycerin: { name: 'النيتروجليسرين (C3H5N3O9)', price: 1800, buyable: false, state: '💥 مركب حسّاس', desc: 'مركب عضوي شديد الانفجار وقيمته عالية جداً.' },
        toxic_waste: { name: 'النفايات الكيميائية ☣️', price: 0, buyable: false, state: '☣️ نفايات', desc: 'نفايات ضارة تسبب تلف المواد إذا لم يتم تصريفها.' }
    },
    equipment: {
        beaker: { name: 'وعاء التفاعل (Beaker)', reqLevel: 1, price: 100 },
        electrolysis: { name: 'جهاز التحليل الكهربائي', reqLevel: 2, price: 200 },
        still: { name: 'جهاز التقطير (Distillation)', reqLevel: 3, price: 300 },
        combustion: { name: 'مفاعل الأكسدة', reqLevel: 4, price: 400 },
        furnace: { name: 'الفرن الحراري (Furnace)', reqLevel: 5, price: 500 },
        ph_meter: { name: 'مقياس الحموضة الرقمي (Digital pH Meter)', reqLevel: 6, price: 300 },
        stirrer: { name: 'المخلاط المغناطيسي (Magnetic Stirrer)', reqLevel: 7, price: 450 },
        fume_hood: { name: 'مظلة سحب الأبخرة (Fume Hood)', reqLevel: 8, price: 700 },
        analytical_bal: { name: 'الميزان التحليلي الدقيق', reqLevel: 9, price: 950 },
        distil_setup: { name: 'جهاز التقطير البسيط', reqLevel: 10, price: 1500 },
        burette: { name: 'صحاحة قياسية (Burette)', reqLevel: 11, price: 1800 },
        water_bath: { name: 'حمام مائي حراري (Water Bath)', reqLevel: 12, price: 2200 },
        vacuum_filter: { name: 'جهاز الترشيح المفرغ', reqLevel: 13, price: 2800 },
        drying_oven: { name: 'فرن تجفيف زجاجي (Drying Oven)', reqLevel: 15, price: 3800 },
        auto_reactor: { name: 'المفاعل الآلي (Automation Module)', reqLevel: 20, price: 5000 }
    },
    upgrades: {
        speed: { id: 'up_speed', name: '⚡ المسرع الكيميائي (سرعة x2)', price: 200, desc: 'يخفض زمن التفاعلات 50%' },
        shield: { id: 'up_shield', name: '🛡️ درع الحماية من الانفجار', price: 150, desc: 'يحميك من خسارة المواد عند الخطأ' }
    },
    achievements: {
        cautious: { id: 'cautious', name: '🧪 الكيميائي الحذر', desc: 'إجراء 10 تفاعلات بدون خطأ معايرة', reward: 300 },
        trader: { id: 'trader', name: '💵 تاجر المواد', desc: 'بيع نواتج بقيمة 1000 Valence', reward: 500 },
        explorer: { id: 'explorer', name: '🔍 المكتشف السري', desc: 'اكتشاف مركب سري ناتج عن الخلط العشوائي', reward: 1000 }
    },
    reactions: [
        { id: 'r_nacl', name: '🧪 تخليق ملح الطعام (NaCl)', tool: 'beaker', reqLevel: 1, costAbility: 1, req: { na: 1, cl: 1 }, targetTemp: 25, targetPress: 1, timeSec: 10, yield: { nacl: 1 }, xp: 25 },
        { id: 'r_electrolysis_h2o', name: '⚡ تحليل الماء كهروبيائياً (H2 + O2)', tool: 'electrolysis', reqLevel: 2, costAbility: 2, req: { h2o_imp: 2 }, targetTemp: 25, targetPress: 1, timeSec: 12, yield: { h2: 2, o2: 1 }, xp: 40 },
        { id: 'r_h2o', name: '💧 تنقية وتقطير الماء (H2O)', tool: 'still', reqLevel: 3, costAbility: 2, req: { h2o_imp: 1 }, targetTemp: 110, targetPress: 1, timeSec: 15, yield: { h2o_pure: 1 }, xp: 35 },
        { id: 'r_fe2o3', name: '🔥 أكسدة الحديد وتكوين أكسيد الحديد', tool: 'combustion', reqLevel: 4, costAbility: 3, req: { fe: 2, o2: 1 }, targetTemp: 500, targetPress: 2, timeSec: 18, yield: { fe2o3: 1 }, xp: 70 },
        { id: 'r_cao', name: '🔥 التفكك الحراري لحجر الجير', tool: 'furnace', reqLevel: 5, costAbility: 4, req: { caco3: 1 }, targetTemp: 900, targetPress: 1, timeSec: 20, yield: { cao: 1, co2: 1 }, xp: 60 },
        { id: 'r_h2so4_prep', name: '💨 أكسدة الكبريت المتقدمة (H2SO4)', tool: 'fume_hood', reqLevel: 6, costAbility: 4, req: { so2: 1, o2: 1, h2o_pure: 1 }, targetTemp: 500, targetPress: 2, timeSec: 22, yield: { h2so4: 1 }, xp: 85 },
        { id: 'r_zn_no3', name: '🧪 تفاعل الزنك مع حمض النيتريك', tool: 'stirrer', reqLevel: 7, costAbility: 4, req: { zn: 1, hno3_dilute: 1 }, targetTemp: 110, targetPress: 1, timeSec: 18, yield: { zn_no3: 1 }, xp: 90 },
        { id: 'r_nh4no3', name: '💥 إنتاج نترات الأمونيوم', tool: 'fume_hood', reqLevel: 8, costAbility: 5, req: { nh3: 1, hno3_dilute: 1 }, targetTemp: 110, targetPress: 2, timeSec: 20, yield: { nh4no3: 1 }, xp: 110 },
        { id: 'r_copper_cryst', name: '💎 تنقية وتكريس بلورات النحاس', tool: 'analytical_bal', reqLevel: 9, costAbility: 5, req: { cuso4: 1, h2o_pure: 1 }, targetTemp: 110, targetPress: 1, timeSec: 25, yield: { copper_cryst: 1 }, xp: 130 },
        { id: 'r_pure_ethanol', name: '🍾 تقطير وحفظ الإيثانول النقي', tool: 'distil_setup', reqLevel: 10, costAbility: 5, req: { ethanol: 1, h2o_pure: 1 }, targetTemp: 110, targetPress: 1, timeSec: 25, yield: { pure_ethanol: 1 }, xp: 150 },
        { id: 'r_neutral_salt', name: '⚖️ معايرة حمض وقاعدة (تفاعل تعادل)', tool: 'burette', reqLevel: 11, costAbility: 6, req: { hno3_dilute: 1, naoh: 1 }, targetTemp: 25, targetPress: 1, timeSec: 20, yield: { salt_neutral: 1 }, xp: 170 },
        { id: 'r_ethyl_acetate', name: '🌸 تصنيع الإيثيل أسيتات العطري', tool: 'water_bath', reqLevel: 12, costAbility: 6, req: { ethanol: 1, ch3cooh: 1 }, targetTemp: 110, targetPress: 2, timeSec: 28, yield: { ethyl_acetate: 1 }, xp: 200 },
        { id: 'r_dry_powder', name: '🔥 تجفيف المترسبات الصلبة', tool: 'drying_oven', reqLevel: 15, costAbility: 7, req: { oxalic: 1, zn: 1 }, targetTemp: 500, targetPress: 3, timeSec: 35, yield: { dry_precipitate: 1, toxic_waste: 1 }, xp: 280 },
        { id: 'r_gold_refine', name: '✨ استخلاص الذهب النقي (Au)', tool: 'furnace', reqLevel: 16, costAbility: 8, req: { au_ore: 2, hno3: 1 }, targetTemp: 900, targetPress: 2, timeSec: 40, yield: { pure_gold: 1, toxic_waste: 1 }, xp: 350 },
        { id: 'r_benzene_synth', name: '🧪 تقطير مركب البنزين (C6H6)', tool: 'distil_setup', reqLevel: 17, costAbility: 8, req: { benzene_raw: 2 }, targetTemp: 110, targetPress: 1, timeSec: 30, yield: { benzene: 1 }, xp: 380 },
        { id: 'r_nitroglycerin', name: '💥 تخليق النيتروجليسرين (C3H5N3O9)', tool: 'water_bath', reqLevel: 20, costAbility: 10, req: { hno3: 2, h2so4: 1 }, targetTemp: 25, targetPress: 1, timeSec: 45, yield: { nitroglycerin: 1, toxic_waste: 2 }, xp: 500 }
    ]
};

const TEMP_STEPS = [25, 110, 500, 900];
const PRESS_STEPS = [1, 2, 3];

function ensureDataFile() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
}

function generateDailyQuest(playerLevel) {
    const targetItems = Object.entries(labData.items).filter(([_, item]) => !item.buyable && item.price > 0);
    const randomItem = targetItems[Math.floor(Math.random() * targetItems.length)][0];
    const count = Math.floor(Math.random() * 2) + 1;
    return {
        item: randomItem,
        count: count,
        progress: 0,
        rewardCoins: count * 150 + playerLevel * 20,
        rewardXp: count * 40 + playerLevel * 10,
        completed: false,
        lastReset: Date.now()
    };
}

function processItemStabilityAndDecay(player) {
    if (!player.itemTimestamps) player.itemTimestamps = {};
    const now = Date.now();
    let decayedItems = [];

    for (const [itemId, qty] of Object.entries(player.inv)) {
        const itemInfo = labData.items[itemId];
        if (itemInfo && itemInfo.shelfLife) {
            if (!player.itemTimestamps[itemId]) {
                player.itemTimestamps[itemId] = now;
            } else if (now - player.itemTimestamps[itemId] > itemInfo.shelfLife * 1000) {
                delete player.inv[itemId];
                delete player.itemTimestamps[itemId];
                player.inv['h2o_imp'] = (player.inv['h2o_imp'] || 0) + qty;
                decayedItems.push(itemInfo.name);
            }
        }
    }
    return decayedItems;
}

function getPlayerData(userId) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }

    if (!db[userId]) {
        db[userId] = {
            level: 1, xp: 0, coins: 200, abilityPoints: 2, academicReputation: 0,
            unlockedReactions: ['r_nacl'],
            ownedEquipment: { beaker: 1 },
            equipmentLevels: { beaker: 1 },
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1 },
            itemTimestamps: {},
            codex: [], upgrades: { speed: false, shield: false },
            achievements: { cautious: 0, trader: 0, explorer: false },
            unlockedBadges: [],
            automatedProduct: null,
            lastAutoClaim: Date.now(),
            quest: generateDailyQuest(1),
            pendingQueue: []
        };
        fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    }
    
    if (!db[userId].quest || (Date.now() - (db[userId].quest.lastReset || 0)) > 86400000) {
        db[userId].quest = generateDailyQuest(db[userId].level || 1);
    }
    if (!db[userId].equipmentLevels) db[userId].equipmentLevels = { beaker: 1 };
    if (!db[userId].achievements) db[userId].achievements = { cautious: 0, trader: 0, explorer: false };
    if (!db[userId].unlockedBadges) db[userId].unlockedBadges = [];

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
    const embed = new EmbedBuilder()
        .setTitle('🧪 Lab v1.5 - المختبر الكيميائي')
        .setDescription(`مرحباً بك **${user.username}** 👋`)
        .setColor(0x2ecc71)
        .addFields(
            { name: '👤 المستوى', value: `\`Lv.${player.level} / 25\``, inline: true },
            { name: '✨ الخبرة', value: `\`${player.xp} / ${player.level * 100} XP\``, inline: true },
            { name: '⚡ نقاط القدرة', value: `\`${player.abilityPoints} نقطة\``, inline: true },
            { name: '💰 Valence', value: `\`${player.coins} 🪙\``, inline: true },
            { name: '📜 السمعة الأكاديمية', value: `\`${player.academicReputation || 0} pts\``, inline: true },
            { name: '📘 الموسوعة', value: `\`${player.codex.length} / ${Object.keys(labData.items).length}\``, inline: true }
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
        new ButtonBuilder().setCustomId('btn_open_secret_mix').setLabel('خلط عشوائي 🧪').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('القائمة الإضافية 📂').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

function buildMoreMenu(user, player) {
    const embed = new EmbedBuilder()
        .setTitle('📂 القائمة الإضافية - v1.5')
        .setDescription('استعرض الأقسام المتاحة للتطوير والاقتصاد والأنشطة التنافسية:')
        .setColor(0x7289da)
        .addFields(
            { name: '📜 المستويات والقدرات', value: 'فتح التفاعلات المتاحة حتى Lv.25.', inline: true },
            { name: '🏭 الورشة الآلية', value: 'خط إنتاج تلقائي للمركبات (Lv.20+).', inline: true },
            { name: '📈 البورصة والسوق', value: 'تداول العروض والاستثمار في المواد.', inline: true },
            { name: '📄 الأوراق البحثية', value: 'تقديم الأبحاث لكسب السمعة الأكاديمية.', inline: true },
            { name: '⚔️ تحدي الرموز', value: 'اختبار سرعة كتابة الرموز الكيميائية.', inline: true },
            { name: '☣️ إدارة النفايات', value: 'تنظيف وتدوير النفايات الكيميائية.', inline: true },
            { name: '🎁 نظام الإهداء', value: 'إرسال Valence أو المواد للأصدقاء.', inline: true },
            { name: '📋 المهام اليومية', value: 'أهداف متجددة ورصيد مكافآت.', inline: true },
            { name: '🎒 المستودع والموسوعة', value: 'استعراض مخزونك والمركبات المكتشفة.', inline: true }
        );

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_levels').setLabel('المستويات').setEmoji('📜').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_automation').setLabel('الورشة الآلية').setEmoji('🏭').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_market').setLabel('البورصة').setEmoji('📈').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_research').setLabel('الأبحاث').setEmoji('📄').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_duels').setLabel('تحدي الرموز').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_open_hazards').setLabel('النفايات البيئية').setEmoji('☣️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_open_gift').setLabel('إهداء لاعب').setEmoji('🎁').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_open_quest').setLabel('المهام').setEmoji('📋').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_codex').setLabel('الموسوعة').setEmoji('📘').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرجوع للرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

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
        .setDescription(`**الحالة:** ${statusText}\n\n**الجهاز المطلوب:** ${labData.equipment[reaction.tool]?.name || reaction.tool}`)
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

function buildShopScreen(player, index) {
    const shopList = [
        ...Object.entries(labData.items).filter(([_, item]) => item.buyable && (item.reqLevel || 1) <= player.level).map(([id, item]) => ({ type: 'item', id, ...item })),
        ...Object.entries(labData.equipment).filter(([_, eq]) => eq.reqLevel <= player.level).map(([id, eq]) => ({ type: 'equipment', id, ...eq })),
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
    } else if (currentItem.type === 'equipment') {
        const isOwned = player.ownedEquipment && player.ownedEquipment[currentItem.id];
        if (isOwned) {
            buyBtnDisabled = true;
            buyBtnLabel = '✅ تمتلك هذا الجهاز بالفعل';
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
        .setDescription(currentItem.desc || `عنصر كيميائي أو جهاز مخبري متقدم.\n**الحالة الفيزيائية/المستوى:** ${currentItem.state || 'مستوى ' + (currentItem.reqLevel || 1)}`)
        .setColor(0xf1c40f)
        .addFields(
            { name: '💵 السعر', value: `\`${currentItem.price} Valence 🪙\``, inline: true },
            { name: '🎒 الكمية / الحالة لديك', value: currentItem.type === 'item' ? `\`${player.inv[currentItem.id] || 0}\`` : (currentItem.type === 'equipment' ? (player.ownedEquipment[currentItem.id] ? '`مملوك`' : '`غير مملوك`') : (player.upgrades[currentItem.id.replace('up_', '')] ? '`مفعّل`' : '`غير مفعّل`')), inline: true }
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

function buildCalibScreen(reaction, tempIndex, pressIndex) {
    const currentTemp = TEMP_STEPS[tempIndex];
    const currentPress = PRESS_STEPS[pressIndex];

    const reqList = Object.entries(reaction.req)
        .map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``)
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
        .setDescription(`**الجهاز المستخدم:** ${labData.equipment[reaction.tool]?.name || reaction.tool}\nاضبط الحرارة والضغط بالأسهم ثم اضغط **بدء التفاعل**.`)
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

    const equipOwned = player.ownedEquipment && player.ownedEquipment[reaction.tool];
    const equipName = labData.equipment[reaction.tool]?.name || reaction.tool;

    const embed = new EmbedBuilder()
        .setTitle(`⚗️ اختر تفاعلاً: ${reaction.name}`)
        .setDescription(`**الجهاز المطلوب:** ${equipName} ${equipOwned ? '✅' : '❌ (غير مملوك)'}\n**الوقت المطلوب:** \`${player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec} ثانية\``)
        .setColor(0x3498db)
        .addFields(
            { name: '🧪 المواد المطلوبة للتفاعل', value: reqList },
            { name: '⭐ خبرة التفاعل', value: `\`+${reaction.xp} XP\``, inline: true }
        )
        .setFooter({ text: `تفاعل ${index + 1} من ${unlockedList.length}` });

    const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_react_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_select_calib_${reaction.id}`).setLabel('🎛️ بدء المعايرة').setStyle(ButtonStyle.Success).setDisabled(!equipOwned),
        new ButtonBuilder().setCustomId('btn_react_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === unlockedList.length - 1),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

function buildCodexScreen(player) {
    const discovered = player.codex || [];
    let codexList = '';

    Object.keys(labData.items).forEach(id => {
        const item = labData.items[id];
        if (discovered.includes(id)) {
            codexList += `✅ **${item.name}** (${item.state})\n_${item.desc || 'مادة كيميائية مخبرية'}_\n\n`;
        } else {
            codexList += `❓ **مركب مجهول** - (لم تقم بتصنيعه أو اكتشافه بعد)\n\n`;
        }
    });

    const embed = new EmbedBuilder()
        .setTitle('📘 الموسوعة الكيميائية (Codex)')
        .setDescription(codexList.length > 2000 ? codexList.slice(0, 1900) + '...\n_(تابع الاكتشاف)_' : codexList)
        .setColor(0x9b59b6)
        .setFooter({ text: `تم اكتشاف ${discovered.length} من أصل ${Object.keys(labData.items).length} مركبات` });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

function buildEquipUpgradeScreen(player) {
    let equipList = '';
    const owned = player.ownedEquipment || {};

    Object.entries(labData.equipment).forEach(([id, eq]) => {
        if (owned[id]) {
            const currentLv = player.equipmentLevels[id] || 1;
            const upgradeCost = currentLv * 250;
            equipList += `⚙️ **${eq.name}** (مستوى Lv.${currentLv})\n• كفاءة الجهاز: \`+${currentLv * 10}%\` | تكلفة الترقية التالية: \`${upgradeCost} Valence\`\n\n`;
        }
    });

    if (!equipList) equipList = '_لا تملك أي أجهزة قابلة للترقية حالياً! اشتر الأجهزة من المتجر أولاً._';

    const embed = new EmbedBuilder()
        .setTitle('⚙️ تطوير وترقية أجهزة المختبر')
        .setDescription(equipList)
        .setColor(0x34495e);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

function buildAchievementsScreen(player) {
    let achList = '';

    Object.entries(labData.achievements).forEach(([id, ach]) => {
        const isUnlocked = player.unlockedBadges.includes(id);
        achList += `${isUnlocked ? '✅' : '🔒'} **${ach.name}**\n_${ach.desc}_\n💰 المكافأة: \`${ach.reward} Valence\` ${isUnlocked ? '(تمت المطالبة)' : ''}\n\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('🎖️ الإنجازات والألقاب الكيميائية')
        .setDescription(achList)
        .setColor(0xe67e22);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

async function handleLabSession(context, user) {
    let player = getPlayerData(user.id);
    const decayedNames = processItemStabilityAndDecay(player);
    const currentNow = Math.floor(Date.now() / 1000);

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
                
                if (player.xp >= player.level * 100 && player.level < 25) {
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

    if (decayedNames.length > 0 && context.channel) {
        context.channel.send({ content: `⚠️ <@${user.id}> **تنبيه استقرار المواد:** تحللت المواد التالية لانتهاء صلاحيتها في المستودع: (${decayedNames.join(', ')})` }).catch(() => {});
    }

    let lvlIndex = 0;
    let shopIndex = 0;
    let reactIndex = 0;
    let selectedReaction = null;
    let tempIndex = 0;
    let pressIndex = 0;

    const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async i => {
        if (i.user.id !== user.id) {
            return i.reply({ content: '❌ هذه اللوحة غير مخصصة لك!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        player = getPlayerData(user.id);
        const backMoreBtnRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('الرجوع للقائمة الإضافية ↩️').setStyle(ButtonStyle.Secondary)
        );

        const updateScreen = async (data) => {
            if (!i.replied && !i.deferred) {
                await i.update(data).catch(() => {});
            } else {
                await i.message.edit(data).catch(() => {});
            }
        };

        const notifyOnly = async (contentStr) => {
            if (!i.replied && !i.deferred) {
                await i.reply({ content: contentStr, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await i.followUp({ content: contentStr, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        };

        // Navigation
        if (i.customId === 'btn_back_main') return await updateScreen(buildMainMenu(user, player));
        if (i.customId === 'btn_open_more_menu') return await updateScreen(buildMoreMenu(user, player));

        // Sections
        if (i.customId === 'btn_open_inv') {
            const invList = Object.keys(player.inv).length > 0 
                ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``).join('\n')
                : '_المستودع فارغ حالياً_';

            const invEmbed = new EmbedBuilder()
                .setTitle(`🎒 مستودع المواد - ${user.username}`)
                .setDescription(invList)
                .setColor(0x3498db);

            return await updateScreen({ embeds: [invEmbed], components: [backMoreBtnRow] });
        }

        if (i.customId === 'btn_open_codex') return await updateScreen(buildCodexScreen(player));
        if (i.customId === 'btn_open_equip_upgrade') return await updateScreen(buildEquipUpgradeScreen(player));
        if (i.customId === 'btn_open_achievements') return await updateScreen(buildAchievementsScreen(player));

        // Automation
        if (i.customId === 'btn_open_automation') {
            if (player.level < 20) {
                return await notifyOnly('🔒 يتطلب فتح الورشة الآلية الوصول إلى **المستوى 20**!');
            }

            const now = Date.now();
            const minutesPassed = Math.floor((now - (player.lastAutoClaim || now)) / 60000);
            let claimedText = "لم تقم بضبط خط إنتاج آلي بعد.";

            if (player.automatedProduct && minutesPassed > 0) {
                const producedQty = Math.min(minutesPassed, 50);
                player.inv[player.automatedProduct] = (player.inv[player.automatedProduct] || 0) + producedQty;
                player.lastAutoClaim = now;
                updatePlayerData(user.id, player);
                claimedText = `✅ قامت الورشة بإنتاج **${producedQty}** من **${labData.items[player.automatedProduct]?.name || player.automatedProduct}**!`;
            }

            const autoEmbed = new EmbedBuilder()
                .setTitle('🏭 الورشة والمفاعل الآلي (Automation Lab)')
                .setDescription(`${claimedText}\n\n**خط الإنتاج الحالي:** ${labData.items[player.automatedProduct]?.name || 'غير محدد'}\n**معدل الإنتاج:** 1 وحدة / دقيقة.`)
                .setColor(0xe91e63);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_set_auto_gold').setLabel('إنتاج الذهب (Au)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_set_auto_benzene').setLabel('إنتاج البنزين (C6H6)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
            );

            return await updateScreen({ embeds: [autoEmbed], components: [row] });
        }

        if (i.customId === 'btn_set_auto_gold' || i.customId === 'btn_set_auto_benzene') {
            player.automatedProduct = i.customId === 'btn_set_auto_gold' ? 'pure_gold' : 'benzene';
            player.lastAutoClaim = Date.now();
            updatePlayerData(user.id, player);
            await notifyOnly(`⚙️ تم ضبط الورشة لإنتاج **${labData.items[player.automatedProduct].name}** بنجاح!`);
            return await i.message.edit(buildMoreMenu(user, player));
        }

        if (i.customId === 'btn_open_market') {
            const marketEmbed = new EmbedBuilder()
                .setTitle('📈 البورصة وسوق التداول الكيميائي')
                .setDescription('مؤشرات الأسعار اليومية متقلبة، قم ببيع نواتجك في أوقات الارتفاع لتحقيق أقصى أرباح Valence!')
                .setColor(0xf1c40f);

            return await updateScreen({ embeds: [marketEmbed], components: [backMoreBtnRow] });
        }

        if (i.customId === 'btn_open_research') {
            const researchEmbed = new EmbedBuilder()
                .setTitle('📄 نشر الأوراق البحثية والمجلات العلمية')
                .setDescription(`نقاط السمعة الأكاديمية الحالية: **${player.academicReputation || 0} pts**\n\nقدم مركباتك النادرة لمجلة المختبر العلمية لرفع سمعتك الأكاديمية!`)
                .setColor(0x2ecc71);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_submit_paper').setLabel('📤 تقديم ورقة النيتروجليسرين').setStyle(ButtonStyle.Success),
                backMoreBtnRow.components[0]
            );

            return await updateScreen({ embeds: [researchEmbed], components: [row] });
        }

        if (i.customId === 'btn_submit_paper') {
            if ((player.inv['nitroglycerin'] || 0) < 1) {
                return await notifyOnly('❌ لا تملك مركب **النيتروجليسرين** لنشر هذا البحث!');
            }
            player.inv['nitroglycerin'] -= 1;
            player.academicReputation = (player.academicReputation || 0) + 50;
            updatePlayerData(user.id, player);
            await notifyOnly('🎉 تم نشر الورقة البحثية بنجاح! حصلت على **+50 نقطة سمعة أكاديمية**.');
            return await i.message.edit(buildMoreMenu(user, player));
        }

        if (i.customId === 'btn_open_duels') {
            const duelEmbed = new EmbedBuilder()
                .setTitle('⚔️ تحدي الرموز الكيميائية السريعة')
                .setDescription('اختبر سرعتك! اكتب الرموز الصحيحة للعناصر (مثل: صوديوم -> Na | ذهب -> Au) لربح الـ Valence والخبرة.')
                .setColor(0xe74c3c);

            return await updateScreen({ embeds: [duelEmbed], components: [backMoreBtnRow] });
        }

        if (i.customId === 'btn_open_hazards') {
            const wasteQty = player.inv['toxic_waste'] || 0;
            const wasteEmbed = new EmbedBuilder()
                .setTitle('☣️ نظام السلامة وإدارة النفايات')
                .setDescription(`كمية النفايات الكيميائية في مستودعك: **${wasteQty} وحدة**`)
                .setColor(0x9b59b6);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_clean_waste').setLabel('🧹 تصريف النفايات (100V)').setStyle(ButtonStyle.Primary),
                backMoreBtnRow.components[0]
            );

            return await updateScreen({ embeds: [wasteEmbed], components: [row] });
        }

        if (i.customId === 'btn_clean_waste') {
            if (player.coins < 100) return await notifyOnly('❌ لا تملك Valence كافي!');
            player.coins -= 100;
            player.inv['toxic_waste'] = 0;
            updatePlayerData(user.id, player);
            await notifyOnly('✅ تم تنظيف المستودع وتصريف النفايات بنجاح!');
            return await i.message.edit(buildMoreMenu(user, player));
        }

        if (i.customId === 'btn_open_gift') {
            const giftEmbed = new EmbedBuilder()
                .setTitle('🎁 نظام إهداء الأصدقاء')
                .setDescription('يمكنك إهداء رصيد Valence أو المواد والمركبات الكيميائية من مستودعك لأي عضو في السيرفر.')
                .setColor(0xf39c12);

            return await updateScreen({ embeds: [giftEmbed], components: [backMoreBtnRow] });
        }

        if (i.customId === 'btn_open_secret_mix') {
            const userMaterials = Object.keys(player.inv);
            if (userMaterials.length < 2) {
                return await notifyOnly('❌ تحتاج إلى مادتين كيميائيتين على الأقل في مستودعك لإجراء خلط عشوائي!');
            }

            const mat1 = userMaterials[0];
            const mat2 = userMaterials[1];

            player.inv[mat1]--; if (player.inv[mat1] <= 0) delete player.inv[mat1];
            player.inv[mat2]--; if (player.inv[mat2] <= 0) delete player.inv[mat2];

            const successChance = Math.random();
            if (successChance > 0.75) {
                player.inv['secret_compound'] = (player.inv['secret_compound'] || 0) + 1;
                if (!player.codex.includes('secret_compound')) player.codex.push('secret_compound');
                if (!player.unlockedBadges.includes('explorer')) {
                    player.unlockedBadges.push('explorer');
                    player.coins += labData.achievements.explorer.reward;
                }
                player.xp += 200;
                updatePlayerData(user.id, player);
                await notifyOnly('✨ **نجاح مبهر! قمت باكتشاف (المركب السري النادر ✨) عبر الخلط العشوائي!**');
            } else {
                if (!player.upgrades.shield) {
                    updatePlayerData(user.id, player);
                    await notifyOnly('💥 **حدث انفجار كيميائي غير متوقع أثناء الخلط العشوائي! خسرت المواد.**');
                } else {
                    updatePlayerData(user.id, player);
                    await notifyOnly('🛡️ **فشل التفاعل العشوائي ولكن درع الحماية منع أضرار الانفجار!**');
                }
            }
            return await i.message.edit(buildMainMenu(user, player));
        }

        // Levels
        if (i.customId === 'btn_open_levels') {
            lvlIndex = 0;
            return await updateScreen(buildLevelScreen(player, lvlIndex));
        }
        if (i.customId === 'btn_lvl_prev') {
            lvlIndex--;
            return await updateScreen(buildLevelScreen(player, lvlIndex));
        }
        if (i.customId === 'btn_lvl_next') {
            lvlIndex++;
            return await updateScreen(buildLevelScreen(player, lvlIndex));
        }
        if (i.customId.startsWith('btn_unlock_reaction_')) {
            const rId = i.customId.replace('btn_unlock_reaction_', '');
            const reaction = labData.reactions.find(r => r.id === rId);

            if (player.abilityPoints >= reaction.costAbility) {
                player.abilityPoints -= reaction.costAbility;
                player.unlockedReactions.push(reaction.id);
                updatePlayerData(user.id, player);
                await notifyOnly(`✅ **تم فتح (${reaction.name}) بنجاح!**`);
                return await i.message.edit(buildLevelScreen(player, lvlIndex));
            } else {
                return await notifyOnly('❌ لا تملك نقاط قدرة كافية!');
            }
        }

        // Shop
        if (i.customId === 'btn_open_shop') {
            shopIndex = 0;
            return await updateScreen(buildShopScreen(player, shopIndex));
        }
        if (i.customId === 'btn_shop_prev') {
            shopIndex--;
            return await updateScreen(buildShopScreen(player, shopIndex));
        }
        if (i.customId === 'btn_shop_next') {
            shopIndex++;
            return await updateScreen(buildShopScreen(player, shopIndex));
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
                    await notifyOnly(`🎉 **تم شراء الترقية (${upItem.name}) بنجاح!**`);
                }
            } else if (type === 'equipment') {
                const eqItem = labData.equipment[id];
                if (player.coins >= eqItem.price) {
                    player.coins -= eqItem.price;
                    if (!player.ownedEquipment) player.ownedEquipment = {};
                    player.ownedEquipment[id] = true;
                    player.equipmentLevels[id] = 1;
                    updatePlayerData(user.id, player);
                    await notifyOnly(`🎉 **تم شراء الجهاز (${eqItem.name}) بنجاح!**`);
                }
            } else {
                const item = labData.items[id];
                if (player.coins >= item.price) {
                    player.coins -= item.price;
                    player.inv[id] = (player.inv[id] || 0) + 1;
                    if (item.shelfLife) player.itemTimestamps[id] = Date.now();
                    updatePlayerData(user.id, player);
                    await notifyOnly(`🛒 **تم شراء 1x (${item.name}) بنجاح!**`);
                }
            }
            // تحديث واجهة المتجر الأصلية القائمة بنفس الرسالة
            return await i.message.edit(buildShopScreen(player, shopIndex));
        }

        // Reactions & Calibration
        if (i.customId === 'btn_open_reactions') {
            reactIndex = 0;
            return await updateScreen(buildReactionsScreen(player, reactIndex));
        }
        if (i.customId === 'btn_react_prev') {
            reactIndex--;
            return await updateScreen(buildReactionsScreen(player, reactIndex));
        }
        if (i.customId === 'btn_react_next') {
            reactIndex++;
            return await updateScreen(buildReactionsScreen(player, reactIndex));
        }
        if (i.customId.startsWith('btn_select_calib_')) {
            const rId = i.customId.replace('btn_select_calib_', '');
            selectedReaction = labData.reactions.find(r => r.id === rId);
            tempIndex = 0;
            pressIndex = 0;
            return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }

        if (i.customId === 'btn_temp_down') {
            tempIndex--;
            return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_temp_up') {
            tempIndex++;
            return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_press_down') {
            pressIndex--;
            return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_press_up') {
            pressIndex++;
            return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }

        // --- 🧪 بدء التفاعل الكيميائي ---
        if (i.customId === 'btn_start_reaction') {
            const reaction = selectedReaction;

            for (const [mat, qty] of Object.entries(reaction.req)) {
                if (!player.inv[mat] || player.inv[mat] < qty) {
                    return await notifyOnly(`❌ لا تملك المواد الكافية! تحتاج إلى (${labData.items[mat]?.name || mat} x${qty})`);
                }
            }

            const currentTemp = TEMP_STEPS[tempIndex];
            const currentPress = PRESS_STEPS[pressIndex];

            for (const [mat, qty] of Object.entries(reaction.req)) {
                player.inv[mat] -= qty;
                if (player.inv[mat] <= 0) delete player.inv[mat];
            }

            if (currentTemp !== reaction.targetTemp || currentPress !== reaction.targetPress) {
                player.achievements.cautious = 0;
                if (!player.upgrades.shield) {
                    updatePlayerData(user.id, player);
                    await notifyOnly('💥 **حدث انفجار مخبري بسبب ضبط درجات حرارة أو ضغط خاطئة! خسرت المواد.**');
                } else {
                    updatePlayerData(user.id, player);
                    await notifyOnly('🛡️ **فشل التفاعل بسبب المعايرة الخاطئة، ولكن درع الحماية منع انفجار المواد!**');
                }
                return await i.message.edit(buildMainMenu(user, player));
            }

            player.achievements.cautious = (player.achievements.cautious || 0) + 1;
            if (player.achievements.cautious >= 10 && !player.unlockedBadges.includes('cautious')) {
                player.unlockedBadges.push('cautious');
                player.coins += labData.achievements.cautious.reward;
            }

            let duration = player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec;
            player.pendingQueue.push({ busyUntil: Math.floor(Date.now() / 1000) + duration, yield: reaction.yield, xp: reaction.xp });
            updatePlayerData(user.id, player);

            setTimeout(() => {
                if (i.channel) {
                    i.channel.send({ content: `🎉 <@${user.id}> **اكتمل التفاعل الكيميائي (${reaction.name})! افتح المختبر لاستلام نتائجك.**` }).catch(() => {});
                }
            }, duration * 1000);

            await notifyOnly(`🚀 **بدأ تفاعل (${reaction.name})! سينتهي بعد ${duration} ثانية.**`);
            return await i.message.edit(buildMainMenu(user, player));
        }

        // Quests & Sales
        if (i.customId === 'btn_open_quest') {
            const q = player.quest;
            const itemNeeded = labData.items[q.item];
            
            const questEmbed = new EmbedBuilder()
                .setTitle('📜 المهام اليومية المتجددة')
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
            return await updateScreen({ embeds: [questEmbed], components: [questRow] });
        }

        if (i.customId === 'btn_claim_quest') {
            if (player.quest.progress >= player.quest.count && !player.quest.completed) {
                player.coins += player.quest.rewardCoins;
                player.xp += player.quest.rewardXp;
                player.quest.completed = true;
                updatePlayerData(user.id, player);
                await notifyOnly('🎉 **تم تسليم المهمة بنجاح واستلام المكافأة!**');
                return await i.message.edit(buildMainMenu(user, player));
            }
        }

        if (i.customId === 'btn_sell_all') {
            let totalEarned = 0;
            let soldList = [];

            Object.keys(player.inv).forEach(id => {
                const itemInfo = labData.items[id];
                if (itemInfo && !itemInfo.buyable && player.inv[id] > 0 && itemInfo.price > 0) {
                    const qty = player.inv[id];
                    const price = itemInfo.price * qty;
                    totalEarned += price;
                    soldList.push(`• **${itemInfo.name}** (x${qty}) ➔ \`+${price} Valence\``);
                    delete player.inv[id];
                }
            });

            if (totalEarned === 0) {
                return await notifyOnly('⚠️ لا تملك أي مواد مُصنّعة قابلة للبيع حالياً!');
            }

            player.coins += totalEarned;
            player.achievements.trader = (player.achievements.trader || 0) + totalEarned;
            if (player.achievements.trader >= 1000 && !player.unlockedBadges.includes('trader')) {
                player.unlockedBadges.push('trader');
                player.coins += labData.achievements.trader.reward;
            }

            updatePlayerData(user.id, player);
            await notifyOnly(`💵 **تمت عملية البيع بنجاح!**\n${soldList.join('\n')}\n\n💰 الإجمالي المضاف لرصيدك: **+${totalEarned} Valence** 🪙`);
            return await i.message.edit(buildMainMenu(user, player));
        }
    });
}

module.exports = {
    data: new SlashCommandBuilder().setName('lab').setDescription('مختبر v1.5 - الكيمياء المتقدمة والتفاعلات الاقتصادية'),
    async execute(interaction) {
        await handleLabSession(interaction, interaction.user);
    },
    handleLabSession
};

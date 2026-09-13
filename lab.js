// lab.js - Ultimate Chemistry Lab Engine (v1.5 Compatible with Discord.js v14)
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, 'labData.json');

// ----------------------------------------------------
// 1. قاموس الرموز والعناصر الكيميائية
// ----------------------------------------------------
const ELEMENT_NAMES = {
    "na": "الصوديوم (Na)",
    "cl": "الكلور (Cl)",
    "caco3": "حجر الجير (CaCO3)",
    "h2o_imp": "ماء غير نقي (H2O)",
    "fe": "الحديد (Fe)",
    "o2": "الأكسجين (O2)",
    "h2": "الهيدروجين (H2)",
    "so2": "ثاني أكسيد الكبريت (SO2)",
    "cu": "النحاس (Cu)",
    "hno3": "حمض النيتريك (HNO3)",
    "hno3_dilute": "حمض النيتريك المخفف (HNO3)",
    "zn": "مسحوق الزنك (Zn)",
    "nh3": "محلول الأمونيا (NH3)",
    "cuso4": "كبريتات النحاس (CuSO4)",
    "ethanol": "إيثانول (C2H5OH)",
    "naoh": "هيدروكسيد الصوديوم (NaOH)",
    "ch3cooh": "حمض الاستيك (CH3COOH)",
    "oxalic": "حمض الأوكزاليك (C2H2O4)",
    "nacl": "ملح الطعام (NaCl)",
    "cao": "الجير الحي (CaO)",
    "co2": "ثاني أكسيد الكربون (CO2)",
    "h2o_pure": "ماء نقي (Pure H2O)",
    "fe2o3": "أكسيد الحديد (Fe2O3)",
    "h2so4": "حمض الكبريتيك (H2SO4)",
    "cuno3_2": "نترات النحاس Cu(NO3)2",
    "n2": "غاز النيتروجين النقي (N2)",
    "zn_no3": "نترات الزنك Zn(NO3)2",
    "nh4no3": "نترات الأمونيوم (NH4NO3)",
    "copper_cryst": "بلورات النحاس المنقاة",
    "pure_ethanol": "إيثانول منقى 100%",
    "salt_neutral": "محلول ملحي متعادل",
    "ethyl_acetate": "إيثيل أسيتات",
    "dry_precipitate": "مسحوق جاف فائق النقاء",
    "secret_compound": "المركب السري النادر ✨",
    "Au": "الذهب النقي (Au)",
    "C6H6": "البنزين العطري (C6H6)",
    "C3H5N3O9": "النيتروجليسرين (C3H5N3O9)",
    "Toxic Waste": "نفايات كيميائية ☣️"
};

const labData = {
    items: {
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
        hno3_dilute: { name: 'حمض النيتريك المخفف (HNO3)', price: 50, buyable: true, state: '💧 سائل', shelfLife: 4800, reqLevel: 6 },
        zn: { name: 'مسحوق الزنك (Zn)', price: 65, buyable: true, state: '🪨 مسحوق', reqLevel: 7 },
        nh3: { name: 'محلول الأمونيا (NH3)', price: 80, buyable: true, state: '💧 سائل', shelfLife: 3600, reqLevel: 8 },
        cuso4: { name: 'كبريتات النحاس (CuSO4)', price: 110, buyable: true, state: '🪨 بلورات', reqLevel: 9 },
        ethanol: { name: 'إيثانول (C2H5OH)', price: 140, buyable: true, state: '💧 سائل', shelfLife: 7200, reqLevel: 10 },
        naoh: { name: 'هيدروكسيد الصوديوم (NaOH)', price: 170, buyable: true, state: '🪨 صلب', reqLevel: 11 },
        ch3cooh: { name: 'حمض الاستيك (CH3COOH)', price: 200, buyable: true, state: '💧 سائل', shelfLife: 5400, reqLevel: 12 },
        oxalic: { name: 'حمض الأوكزاليك (C2H2O4)', price: 280, buyable: true, state: '🪨 صلب', reqLevel: 14 },
        nacl: { name: 'ملح الطعام (NaCl)', price: 50, buyable: false, state: '🪨 صلب' },
        cao: { name: 'الجير الحي (CaO)', price: 80, buyable: false, state: '🪨 صلب' },
        co2: { name: 'ثاني أكسيد الكربون (CO2)', price: 40, buyable: false, state: '💨 غاز' },
        h2o_pure: { name: 'ماء نقي 💧 (Pure H2O)', price: 45, buyable: false, state: '💧 سائل' },
        fe2o3: { name: 'أكسيد الحديد (Fe2O3)', price: 90, buyable: false, state: '🪨 صلب' },
        h2so4: { name: 'حمض الكبريتيك (H2SO4)', price: 150, buyable: false, state: '💧 سائل' },
        cuno3_2: { name: 'نترات النحاس Cu(NO3)2', price: 180, buyable: false, state: '🪨 بلورات' },
        n2: { name: 'غاز النيتروجين النقي (N2)', price: 210, buyable: false, state: '💨 غاز' },
        zn_no3: { name: 'نترات الزنك Zn(NO3)2', price: 180, buyable: false, state: '🪨 بلورات' },
        nh4no3: { name: 'نترات الأمونيوم (NH4NO3)', price: 260, buyable: false, state: '🪨 بلورات' },
        copper_cryst: { name: 'بلورات النحاس المنقاة', price: 340, buyable: false, state: '🪨 بلورات' },
        pure_ethanol: { name: 'إيثانول منقى 100%', price: 450, buyable: false, state: '💧 سائل' },
        salt_neutral: { name: 'محلول ملحي متعادل', price: 520, buyable: false, state: '💧 سائل' },
        ethyl_acetate: { name: 'إيثيل أسيتات', price: 680, buyable: false, state: '💧 سائل' },
        dry_precipitate: { name: 'مسحوق جاف فائق النقاء', price: 1100, buyable: false, state: '🪨 مسحوق' },
        secret_compound: { name: 'المركب السري النادر ✨', price: 2500, buyable: false, state: '✨ طاقة' },
        Au: { name: 'الذهب النقي (Au)', price: 3000, buyable: false, state: '✨ معدن نفيس' },
        C6H6: { name: 'البنزين العطري (C6H6)', price: 800, buyable: false, state: '💧 سائل' },
        C3H5N3O9: { name: 'النيتروجليسرين (C3H5N3O9)', price: 1500, buyable: false, state: '💥 مركب متفجر' }
    }
};

const giftSessions = new Map();

function ensureDataFile() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
}

function getPlayerData(userId) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }

    if (!db[userId]) {
        db[userId] = {
            level: 1, xp: 0, coins: 500, academicReputation: 0,
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1, Au: 1, C3H5N3O9: 1 },
            codex: [], automatedProduct: null, lastAutoClaim: Date.now()
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

// ----------------------------------------------------
// UI Builders (Discord.js v14)
// ----------------------------------------------------
function buildMainMenuEmbed(user, player) {
    return new EmbedBuilder()
        .setTitle('🧪 المختبر الكيميائي - v1.5')
        .setDescription(`أهلاً بك **${user.username}** 👋`)
        .setColor(0x2ecc71)
        .addFields(
            { name: '👤 المستوى', value: `\`Lv.${player.level} / 25\``, inline: true },
            { name: '✨ الخبرة', value: `\`${player.xp} / ${player.level * 100} XP\``, inline: true },
            { name: '💰 Valence', value: `\`${player.coins} 🪙\``, inline: true },
            { name: '📜 السمعة الأكاديمية', value: `\`${player.academicReputation || 0} pts\``, inline: true },
            { name: '☣️ النفايات', value: `\`${player.inv['Toxic Waste'] || 0} وحدة\``, inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: 'اختر إجراءً من الأزرار التالية:' });
}

function buildMainRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_lab_synth').setLabel('إجراء تفاعل').setEmoji('⚗️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('القائمة الإضافية 📂').setStyle(ButtonStyle.Success)
    );
}

function buildMoreMenuRows() {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_automation').setLabel('الورشة الآلية (Lv.20)').setEmoji('🏭').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_marketplace').setLabel('البورصة والسوق').setEmoji('📈').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_research').setLabel('نشر الأوراق البحثية').setEmoji('📄').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_gift_menu').setLabel('إهداء صديق').setEmoji('🎁').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_duels').setLabel('تحدي الرموز').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_hazards').setLabel('إدارة النفايات').setEmoji('☣️').setStyle(ButtonStyle.Danger)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Secondary)
    );

    return [row1, row2, row3];
}

async function buildMemberSelectMenu(guild, currentUserId, selectCustomId, placeholder) {
    let options = [];
    try {
        if (guild) {
            const fetched = await guild.members.fetch({ limit: 50 });
            options = fetched.filter(m => !m.user.bot && m.id !== currentUserId).map(m => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(m.displayName || m.user.username)
                    .setValue(m.id)
                    .setDescription(`إرسال الهدية إلى ${m.user.tag}`)
            ).slice(0, 25);
        }
    } catch (e) {
        console.error("Guild fetch error:", e);
    }

    if (options.length === 0) {
        options.push(
            new StringSelectMenuOptionBuilder()
                .setLabel("لا يوجد أعضاء آخرين متاحين")
                .setValue("none")
                .setDescription("تأكد من وجود أعضاء في السيرفر")
        );
    }

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(selectCustomId)
            .setPlaceholder(placeholder)
            .addOptions(options)
    );
}

// ----------------------------------------------------
// 🧠 2. معالج الجلسة والتفاعلات (Session Handler)
// ----------------------------------------------------
async function handleLabSession(context, user) {
    let player = getPlayerData(user.id);

    // التشغيل الأولي من الرسالة النصية أو السلاش
    if (!context.isButton && !context.isStringSelectMenu) {
        const embed = buildMainMenuEmbed(user, player);
        const row = buildMainRow();
        if (context.reply) {
            return await context.reply({ embeds: [embed], components: [row] });
        } else {
            return await context.channel.send({ embeds: [embed], components: [row] });
        }
    }

    const interaction = context;
    if (interaction.user.id !== user.id) {
        return interaction.reply({ content: '❌ هذه اللوحة غير مخصصة لك!', flags: MessageFlags.Ephemeral });
    }

    const { customId, guild } = interaction;

    // --- Navigation Control ---
    if (customId === 'btn_back_main') {
        return await interaction.update({ embeds: [buildMainMenuEmbed(user, player)], components: [buildMainRow()] });
    }

    if (customId === 'btn_open_more_menu') {
        const embed = new EmbedBuilder()
            .setTitle('📂 القائمة الإضافية - v1.5')
            .setDescription('اختر القسم الذي تريد الوصول إليه من الأزرار المتاحة أدناه:')
            .setColor(0x7289da);

        return await interaction.update({ embeds: [embed], components: buildMoreMenuRows() });
    }

    // --- 🎒 المستودع ---
    if (customId === 'btn_open_inv') {
        const invList = Object.keys(player.inv).length > 0 
            ? Object.entries(player.inv).map(([id, qty]) => `• **${ELEMENT_NAMES[id] || labData.items[id]?.name || id}**: \`${qty}\``).join('\n')
            : '_المستودع فارغ حالياً_';

        const invEmbed = new EmbedBuilder()
            .setTitle(`🎒 مستودع المواد - ${user.username}`)
            .setDescription(invList)
            .setColor(0x3498db);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [invEmbed], components: [row] });
    }

    // --- ⚗️ إجراء تفاعل ---
    if (customId === 'btn_lab_synth') {
        player.coins += 50;
        player.xp += 25;

        if (player.xp >= player.level * 100 && player.level < 25) {
            player.level += 1;
            player.xp = 0;
        }
        updatePlayerData(user.id, player);

        const synthEmbed = new EmbedBuilder()
            .setTitle('⚗️ إجراء تفاعل كيميائي ناجح!')
            .setDescription(`قمت بإجراء تفاعل مخبري ناجح واستخلاص نواتج عالية النقاوة!\n\n💰 المكافأة: **+50 Valence**\n✨ الخبرة: **+25 XP**`)
            .setColor(0x2ecc71);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle(ButtonStyle.Primary)
        );

        return await interaction.update({ embeds: [synthEmbed], components: [row] });
    }

    // --- 🏭 الورشة الآلية (Lv.20+) ---
    if (customId === 'btn_automation') {
        if (player.level < 20) {
            return await interaction.reply({ content: '🔒 يتطلب فتح الورشة الآلية الوصول إلى **المستوى 20**!', flags: MessageFlags.Ephemeral });
        }

        const now = Date.now();
        const minutesPassed = Math.floor((now - player.lastAutoClaim) / 60000);
        let claimedText = "لم تقم بضبط خط إنتاج آلي بعد.";

        if (player.automatedProduct && minutesPassed > 0) {
            const producedQty = Math.min(minutesPassed, 50);
            player.inv[player.automatedProduct] = (player.inv[player.automatedProduct] || 0) + producedQty;
            player.lastAutoClaim = now;
            updatePlayerData(user.id, player);
            claimedText = `✅ قامت الورشة بإنتاج **${producedQty}** من **${ELEMENT_NAMES[player.automatedProduct] || player.automatedProduct}**!`;
        }

        const embed = new EmbedBuilder()
            .setColor(0xe91e63)
            .setTitle('🏭 الورشة والمفاعل الآلي (Automation Lab)')
            .setDescription(`${claimedText}\n\n**خط الإنتاج الحالي:** ${ELEMENT_NAMES[player.automatedProduct] || 'غير محدد'}\n**معدل الإنتاج:** 1 وحدة / دقيقة.`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_set_auto_gold').setLabel('إنتاج الذهب (Au)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_set_auto_benzene').setLabel('إنتاج البنزين (C6H6)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_set_auto_gold' || customId === 'btn_set_auto_benzene') {
        player.automatedProduct = customId === 'btn_set_auto_gold' ? 'Au' : 'C6H6';
        player.lastAutoClaim = Date.now();
        updatePlayerData(user.id, player);
        return await interaction.reply({ content: `⚙️ تم ضبط الورشة الآلية لإنتاج **${ELEMENT_NAMES[player.automatedProduct]}** بنجاح!`, flags: MessageFlags.Ephemeral });
    }

    // --- 📈 البورصة وسوق التداول ---
    if (customId === 'btn_marketplace') {
        const embed = new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle('📈 البورصة وسوق التداول بين اللاعبين')
            .setDescription(`مؤشر البورصة اليومي متقلب، يمنحك فرصاً لبيع المنتجات بأسعار عالية!`)
            .addFields({ name: '💡 النصيحة', value: 'اشترِ المواد الخام بسعر منخفض وقم بإنتاج المركبات المعقدة لبيعها عند ارتفاع السوق.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ عودة للرئيسية').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // --- 📄 نشر الأوراق البحثية ---
    if (customId === 'btn_research') {
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('📄 نشر الأوراق البحثية والمجلات العلمية')
            .setDescription(`نقاط السمعة الأكاديمية الحالية: **${player.academicReputation || 0} pts**`)
            .addFields({ name: '🔬 التقديم المتاح', value: 'نشر ورقة بحثية عن النيتروجليسرين ➔ +50 السمعة العلميّة.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_submit_paper').setLabel('📤 تقديم ورقة بحثية').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_submit_paper') {
        if ((player.inv["C3H5N3O9"] || 0) < 1) {
            return await interaction.reply({ content: '❌ لا تملك مركب **النيتروجليسرين** لنشر هذا البحث!', flags: MessageFlags.Ephemeral });
        }
        player.inv["C3H5N3O9"] -= 1;
        player.academicReputation = (player.academicReputation || 0) + 50;
        updatePlayerData(user.id, player);
        return await interaction.reply({ content: '🎉 تم نشر الورقة البحثية بنجاح! حصلت على **+50 نقطة سمعة أكاديمية**.', flags: MessageFlags.Ephemeral });
    }

    // --- ☣️ إدارة النفايات ---
    if (customId === 'btn_hazards') {
        const wasteCount = player.inv["Toxic Waste"] || 0;
        const embed = new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('☣️ نظام السلامة وإدارة النفايات البيئية')
            .setDescription(`كمية النفايات الكيميائية في مستودعك: **${wasteCount} وحدة**`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_clean_waste').setLabel('🧹 تصريف النفايات (100V)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_clean_waste') {
        if (player.coins < 100) return await interaction.reply({ content: '❌ لا تملك رصيد Valence كافٍ!', flags: MessageFlags.Ephemeral });
        player.coins -= 100;
        player.inv["Toxic Waste"] = 0;
        updatePlayerData(user.id, player);
        return await interaction.reply({ content: '✅ تم تنظيف مستودعك وتصريف النفايات بنجاح!', flags: MessageFlags.Ephemeral });
    }

    // --- ⚔️ التحديات ---
    if (customId === 'btn_duels') {
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('⚔️ تحدي الرموز الكيميائية السريعة')
            .setDescription('تنافس مع الأعضاء في كتابة الرموز الصحيحة للعناصر (صوديوم -> Na | ذهب -> Au)!');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // --- 🎁 نظام الإهداء ---
    if (customId === 'btn_gift_menu') {
        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('🎁 نظام الإهداء الكيميائي')
            .setDescription('اختر نوع الهدية المراد إرسالها لأحد أعضاء السيرفر:');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_gift_valence').setLabel('إهداء Valence').setEmoji('💳').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_gift_item').setLabel('إهداء مادة').setEmoji('📦').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ عودة').setStyle(ButtonStyle.Secondary)
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_gift_valence') {
        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('💳 إهداء رصيد Valence')
            .setDescription('اختر العضو المستلم من القائمة:');

        const selectRow = await buildMemberSelectMenu(guild, user.id, 'select_gift_target_valence', '👤 اختر المستلم...');
        const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_gift_menu').setLabel('↩️ إلغاء').setStyle(ButtonStyle.Secondary));

        return await interaction.update({ embeds: [embed], components: [selectRow, backRow] });
    }

    if (interaction.isStringSelectMenu() && customId === 'select_gift_target_valence') {
        const targetUserId = interaction.values[0];
        if (targetUserId === 'none') return await interaction.reply({ content: '❌ مستلم غير صالح!', flags: MessageFlags.Ephemeral });

        giftSessions.set(user.id, { targetUserId });

        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('💳 اختر كمية Valence للإهداء:')
            .setDescription(`المستلم المختار: <@${targetUserId}>`);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('select_valence_amount').setPlaceholder('💰 اختر المبلغ...').addOptions(
                new StringSelectMenuOptionBuilder().setLabel('50 Valence').setValue('50'),
                new StringSelectMenuOptionBuilder().setLabel('100 Valence').setValue('100'),
                new StringSelectMenuOptionBuilder().setLabel('250 Valence').setValue('250'),
                new StringSelectMenuOptionBuilder().setLabel('500 Valence').setValue('500')
            )
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isStringSelectMenu() && customId === 'select_valence_amount') {
        const amount = parseInt(interaction.values[0]);
        const session = giftSessions.get(user.id);

        if (!session || !session.targetUserId) return await interaction.reply({ content: '❌ انتهت الجلسة!', flags: MessageFlags.Ephemeral });
        if (player.coins < amount) return await interaction.reply({ content: '❌ لا تملك رصيد كافٍ!', flags: MessageFlags.Ephemeral });

        const targetProfile = getPlayerData(session.targetUserId);
        player.coins -= amount;
        targetProfile.coins += amount;
        updatePlayerData(user.id, player);
        updatePlayerData(session.targetUserId, targetProfile);
        giftSessions.delete(user.id);

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎁 تم الإهداء بنجاح!')
            .setDescription(`تم إرسال **${amount} Valence** بنجاح إلى <@${session.targetUserId}>!`);

        return await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Primary))] });
    }

    if (customId === 'btn_gift_item') {
        const userItems = Object.keys(player.inv).filter(item => player.inv[item] > 0 && item !== "Toxic Waste").slice(0, 25);
        if (userItems.length === 0) return await interaction.reply({ content: '🎒 مستودعك فارغ من المواد!', flags: MessageFlags.Ephemeral });

        const options = userItems.map(item => 
            new StringSelectMenuOptionBuilder()
                .setLabel(`${ELEMENT_NAMES[item] || item} (المتوفر: ${player.inv[item]})`)
                .setValue(item)
        );

        const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle('📦 اختر المادة للإهداء:');
        const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('select_gift_item_type').setPlaceholder('📦 اختر المادة...').addOptions(options));
        
        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isStringSelectMenu() && customId === 'select_gift_item_type') {
        const selectedItem = interaction.values[0];
        giftSessions.set(user.id, { itemType: selectedItem });

        const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle(`🎁 إهداء مادة: ${ELEMENT_NAMES[selectedItem] || selectedItem}`).setDescription('اختر المستلم:');
        const selectRow = await buildMemberSelectMenu(guild, user.id, 'confirm_gift_item_target', '👤 اختر المستلم...');

        return await interaction.update({ embeds: [embed], components: [selectRow] });
    }

    if (interaction.isStringSelectMenu() && customId === 'confirm_gift_item_target') {
        const targetUserId = interaction.values[0];
        const session = giftSessions.get(user.id);

        if (targetUserId === 'none' || !session || !session.itemType) return await interaction.reply({ content: '❌ حدث خطأ بالجلسة!', flags: MessageFlags.Ephemeral });
        
        const itemKey = session.itemType;
        if ((player.inv[itemKey] || 0) < 1) return await interaction.reply({ content: '❌ لا تملك المادة!', flags: MessageFlags.Ephemeral });

        const targetProfile = getPlayerData(targetUserId);
        player.inv[itemKey] -= 1;
        targetProfile.inv[itemKey] = (targetProfile.inv[itemKey] || 0) + 1;
        updatePlayerData(user.id, player);
        updatePlayerData(targetUserId, targetProfile);
        giftSessions.delete(user.id);

        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('🎁 تم إرسال المادة بنجاح!')
            .setDescription(`تم نقل **1x ${ELEMENT_NAMES[itemKey] || itemKey}** إلى <@${targetUserId}>!`);

        return await interaction.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Primary))] });
    }
}

module.exports = {
    data: new SlashCommandBuilder().setName('lab').setDescription('فتح المختبر الكيميائي v1.5'),
    async execute(interaction) {
        await handleLabSession(interaction, interaction.user);
    },
    handleLabSession
};

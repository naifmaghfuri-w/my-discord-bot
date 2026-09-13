// lab.js - Ultimate Lab Discord Bot Engine (v1.5 Fully Corrected & Stable)
const { 
    MessageActionRow, 
    MessageButton, 
    MessageEmbed, 
    MessageSelectMenu 
} = require('discord.js');

// ----------------------------------------------------
// Database Sim / In-Memory Data Stores
// ----------------------------------------------------
const userProfiles = new Map();
const giftSessions = new Map(); // userId -> { targetUserId, itemType }

// Dictionary for Chemical Symbols to Arabic Names
const ELEMENT_NAMES = {
    "C": "كربون (C)",
    "H": "هيدروجين (H)",
    "O": "أكسجين (O)",
    "Au": "ذهب (Au)",
    "Pt": "بلاتين (Pt)",
    "Ag": "فضة (Ag)",
    "C6H6": "بنزين (C6H6)",
    "C3H5N3O9": "نيتروجليسرين (C3H5N3O9)",
    "Toxic Waste": "نفايات كيميائية ☣️"
};

// ----------------------------------------------------
// 1. Expanded Level Definitions (Lv.1 to Lv.25)
// ----------------------------------------------------
const LEVEL_DATA = {
    1: { title: "مبتدئ مختبر" },
    5: { title: "كيميائي طامح" },
    10: { title: "مساعد باحث" },
    15: { title: "خبير تفاعلات" },
    16: { title: "كيميائي عضوي" },
    18: { title: "متخصص معادن نفيسة" },
    20: { title: "مهندس مفاعلات آلية" },
    22: { title: "باحث أكاديمي متقدم" },
    25: { title: "بروفيسور المادة والتصنيع" }
};

let currentMarketFluctuation = 1.0;
function updateMarketPrices() {
    currentMarketFluctuation = parseFloat((0.8 + Math.random() * 0.5).toFixed(2));
}
setInterval(updateMarketPrices, 3600000);

function getProfile(userId) {
    if (!userProfiles.has(userId)) {
        userProfiles.set(userId, {
            level: 1,
            xp: 0,
            valence: 500,
            academicReputation: 0,
            inventory: { "C": 10, "H": 10, "O": 10, "Au": 2, "C6H6": 1, "C3H5N3O9": 1, "Toxic Waste": 0 },
            automatedProduct: null,
            lastAutoClaim: Date.now()
        });
    }
    return userProfiles.get(userId);
}

// ----------------------------------------------------
// UI Component Generators
// ----------------------------------------------------
function buildMainMenuEmbed(user) {
    const profile = getProfile(user.id);
    const title = LEVEL_DATA[profile.level]?.title || "كيميائي";

    return new MessageEmbed()
        .setColor('#0099ff')
        .setTitle(`🧪 المختبر الكيميائي - التحديث v1.5`)
        .setDescription(`أهلاً بك يا **${user.username}**!\n**اللقب الحالي:** ${title}\n**المستوى:** ${profile.level}/25`)
        .addField('💳 رصيد Valence', `${profile.valence} V`, true)
        .addField('📜 السمعة الأكاديمية', `${profile.academicReputation} pts`, true)
        .addField('☣️ النفايات الكيميائية', `${profile.inventory["Toxic Waste"] || 0} وحدة`, true)
        .setFooter({ text: 'استخدم الأزرار أدناه للتنقل وإدارة مختبرك' });
}

function buildMainRow() {
    return new MessageActionRow().addComponents(
        new MessageButton().setCustomId('btn_lab_synth').setLabel('⚗️ إجراء تفاعل').setStyle('PRIMARY'),
        new MessageButton().setCustomId('btn_inventory').setLabel('🎒 المستودع').setStyle('SECONDARY'),
        new MessageButton().setCustomId('btn_more_menu').setLabel('➕ القائمة الإضافية').setStyle('SUCCESS')
    );
}

function buildMoreMenuRows() {
    const row1 = new MessageActionRow().addComponents(
        new MessageButton().setCustomId('btn_automation').setLabel('🏭 الورشة الآلية (Lv.20)').setStyle('PRIMARY'),
        new MessageButton().setCustomId('btn_marketplace').setLabel('📈 البورصة والسوق').setStyle('PRIMARY'),
        new MessageButton().setCustomId('btn_research').setLabel('📄 نشر الأوراق البحثية').setStyle('SUCCESS')
    );

    const row2 = new MessageActionRow().addComponents(
        new MessageButton().setCustomId('btn_gift_menu').setLabel('🎁 إهداء صديق').setStyle('SUCCESS'),
        new MessageButton().setCustomId('btn_duels').setLabel('⚔️ تحدي الرموز الكيميائية').setStyle('DANGER'),
        new MessageButton().setCustomId('btn_hazards').setLabel('☣️ إدارة النفايات').setStyle('DANGER')
    );

    const row3 = new MessageActionRow().addComponents(
        new MessageButton().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle('SECONDARY')
    );

    return [row1, row2, row3];
}

async function buildMemberSelectMenu(guild, currentUserId, selectCustomId, placeholder) {
    let options = [];
    try {
        if (guild) {
            const fetched = await guild.members.fetch({ limit: 50 });
            options = fetched.filter(m => !m.user.bot && m.id !== currentUserId).map(m => ({
                label: m.displayName || m.user.username,
                value: m.id,
                description: `إرسال الهدية إلى ${m.user.tag}`
            })).slice(0, 25);
        }
    } catch (e) {
        console.error("Guild fetch error:", e);
    }

    if (options.length === 0) {
        options.push({
            label: "لا يوجد أعضاء آخرين متاحين",
            value: "none",
            description: "تأكد من وجود أعضاء في السيرفر"
        });
    }

    return new MessageActionRow().addComponents(
        new MessageSelectMenu()
            .setCustomId(selectCustomId)
            .setPlaceholder(placeholder)
            .addOptions(options)
    );
}

// ----------------------------------------------------
// Unified Interaction Handler
// ----------------------------------------------------
async function handleLabSession(interaction) {
    if (!interaction.isButton() && !interaction.isSelectMenu()) return;

    const { customId, user, guild } = interaction;
    const profile = getProfile(user.id);

    // Navigation Actions
    if (customId === 'btn_back_main') {
        return await interaction.update({ embeds: [buildMainMenuEmbed(user)], components: [buildMainRow()] });
    }

    if (customId === 'btn_more_menu') {
        const embed = new MessageEmbed()
            .setColor('#7289da')
            .setTitle('➕ القائمة الإضافية - v1.5')
            .setDescription('اختر القسم المطلوب من الأزرار المتاحة أدناه:');

        return await interaction.update({ embeds: [embed], components: buildMoreMenuRows() });
    }

    // 🎒 Inventory
    if (customId === 'btn_inventory') {
        const invList = Object.entries(profile.inventory)
            .filter(([_, qty]) => qty > 0)
            .map(([item, qty]) => `• **${ELEMENT_NAMES[item] || item}**: \`${qty}\``)
            .join('\n') || '_المستودع فارغ_';

        const embed = new MessageEmbed()
            .setColor('#3498db')
            .setTitle(`🎒 مستودع المواد - ${user.username}`)
            .setDescription(invList);

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_back_main').setLabel('↩️ العودة للرئيسية').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // ⚗️ Synthesis Reaction
    if (customId === 'btn_lab_synth') {
        profile.valence += 50;
        profile.xp += 20;
        if (profile.xp >= profile.level * 100 && profile.level < 25) {
            profile.level += 1;
            profile.xp = 0;
        }

        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle('⚗️ نتائج التفاعل الكيميائي')
            .setDescription(`تم إجراء التفاعل بنجاح!\n• المكافأة: **+50 Valence** 🪙\n• الخبرة: **+20 XP** ✨`);

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle('PRIMARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // Automation Lab
    if (customId === 'btn_automation') {
        if (profile.level < 20) {
            return await interaction.reply({ content: '🔒 يتطلب فتح الورشة الآلية الوصول إلى **المستوى 20**!', ephemeral: true });
        }

        const now = Date.now();
        const minutesPassed = Math.floor((now - profile.lastAutoClaim) / 60000);
        let claimedText = "لم تقم بضبط خط إنتاج آلي بعد.";

        if (profile.automatedProduct && minutesPassed > 0) {
            const producedQty = Math.min(minutesPassed, 50);
            profile.inventory[profile.automatedProduct] = (profile.inventory[profile.automatedProduct] || 0) + producedQty;
            profile.lastAutoClaim = now;
            claimedText = `✅ قامت الورشة بإنتاج **${producedQty}** من **${ELEMENT_NAMES[profile.automatedProduct]}**!`;
        }

        const embed = new MessageEmbed()
            .setColor('#e91e63')
            .setTitle('🏭 الورشة والمفاعل الآلي (Automation Lab)')
            .setDescription(`${claimedText}\n\n**خط الإنتاج الحالي:** ${ELEMENT_NAMES[profile.automatedProduct] || 'غير محدد'}\n**معدل الإنتاج:** 1 وحدة / دقيقة.`);

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_set_auto_gold').setLabel('إنتاج الذهب (Au)').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_set_auto_benzene').setLabel('إنتاج البنزين (C6H6)').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_set_auto_gold' || customId === 'btn_set_auto_benzene') {
        profile.automatedProduct = customId === 'btn_set_auto_gold' ? 'Au' : 'C6H6';
        profile.lastAutoClaim = Date.now();
        return await interaction.reply({ content: `⚙️ تم ضبط الورشة لإنتاج **${ELEMENT_NAMES[profile.automatedProduct]}** بنجاح!`, ephemeral: true });
    }

    // Marketplace
    if (customId === 'btn_marketplace') {
        const embed = new MessageEmbed()
            .setColor('#f1c40f')
            .setTitle('📈 البورصة وسوق التداول بين اللاعبين')
            .setDescription(`**مؤشر البورصة اليومي:** ${currentMarketFluctuation}x\nتتغير أسعار الشراء والبيع في المتجر بناءً على حالة السوق!`);

        return await interaction.update({ embeds: [embed], components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_back_main').setLabel('↩️ عودة للرئيسية').setStyle('SECONDARY'))] });
    }

    // Research Papers
    if (customId === 'btn_research') {
        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle('📄 نشر الأوراق البحثية والمجلات العلمية')
            .setDescription(`نقاط السمعة الأكاديمية الحالية: **${profile.academicReputation} pts**`)
            .addField('🔬 التقديم المتاح', 'نشر ورقة بحثية عن النيتروجليسرين ➔ +50 السمعة العلميّة.');

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_submit_paper').setLabel('📤 تقديم ورقة بحثية').setStyle('SUCCESS'),
            new MessageButton().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_submit_paper') {
        if ((profile.inventory["C3H5N3O9"] || 0) < 1) {
            return await interaction.reply({ content: '❌ لا تملك مركب **النيتروجليسرين** لنشر هذا البحث!', ephemeral: true });
        }
        profile.inventory["C3H5N3O9"] -= 1;
        profile.academicReputation += 50;
        return await interaction.reply({ content: '🎉 تم نشر الورقة البحثية بنجاح! حصلت على **+50 نقطة سمعة أكاديمية**.', ephemeral: true });
    }

    // Hazards
    if (customId === 'btn_hazards') {
        const wasteCount = profile.inventory["Toxic Waste"] || 0;
        const embed = new MessageEmbed()
            .setColor('#9b59b6')
            .setTitle('☣️ نظام السلامة وإدارة النفايات البيئية')
            .setDescription(`كمية النفايات الكيميائية في مستودعك: **${wasteCount} وحدة**`);

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_clean_waste').setLabel('🧹 تصريف النفايات (100V)').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (customId === 'btn_clean_waste') {
        if (profile.valence < 100) return await interaction.reply({ content: '❌ لا تملك Valence كافي!', ephemeral: true });
        profile.valence -= 100;
        profile.inventory["Toxic Waste"] = 0;
        return await interaction.reply({ content: '✅ تم تنظيف مستودعك وتصريف النفايات بنجاح!', ephemeral: true });
    }

    // Duels
    if (customId === 'btn_duels') {
        const embed = new MessageEmbed()
            .setColor('#e74c3c')
            .setTitle('⚔️ تحدي الرموز الكيميائية السريعة')
            .setDescription('اكتب الرمز الصحيح للعناصر التالية بالفاتورة: (صوديوم -> Na | ذهب -> Au)');

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_back_main').setLabel('↩️ عودة').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // Gifting Menu
    if (customId === 'btn_gift_menu') {
        const embed = new MessageEmbed()
            .setColor('#f39c12')
            .setTitle('🎁 نظام الإهداء')
            .setDescription('اختر نوع الهدية المراد إرسالها:');

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_gift_valence').setLabel('💳 إهداء Valence').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_gift_item').setLabel('📦 إهداء مادة').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_more_menu').setLabel('↩️ عودة').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // Gift Valence - Target
    if (customId === 'btn_gift_valence') {
        const embed = new MessageEmbed()
            .setColor('#f39c12')
            .setTitle('💳 إهداء رصيد Valence')
            .setDescription('اختر العضو المستلم من القائمة:');

        const selectRow = await buildMemberSelectMenu(guild, user.id, 'select_gift_target_valence', '👤 اختر المستلم...');
        const backRow = new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_gift_menu').setLabel('↩️ إلغاء').setStyle('SECONDARY'));

        return await interaction.update({ embeds: [embed], components: [selectRow, backRow] });
    }

    if (interaction.isSelectMenu() && customId === 'select_gift_target_valence') {
        const targetUserId = interaction.values[0];
        if (targetUserId === 'none') return await interaction.reply({ content: '❌ مستلم غير صالح!', ephemeral: true });

        giftSessions.set(user.id, { targetUserId });

        const embed = new MessageEmbed()
            .setColor('#f39c12')
            .setTitle('💳 اختر كمية Valence للإهداء:')
            .setDescription(`المستلم المختار: <@${targetUserId}>`);

        const row = new MessageActionRow().addComponents(
            new MessageSelectMenu().setCustomId('select_valence_amount').setPlaceholder('💰 اختر المبلغ...').addOptions([
                { label: '50 Valence', value: '50' },
                { label: '100 Valence', value: '100' },
                { label: '250 Valence', value: '250' },
                { label: '500 Valence', value: '500' }
            ])
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isSelectMenu() && customId === 'select_valence_amount') {
        const amount = parseInt(interaction.values[0]);
        const session = giftSessions.get(user.id);

        if (!session || !session.targetUserId) return await interaction.reply({ content: '❌ انتهت الجلسة!', ephemeral: true });
        if (profile.valence < amount) return await interaction.reply({ content: '❌ لا تملك رصيد كافٍ!', ephemeral: true });

        const targetProfile = getProfile(session.targetUserId);
        profile.valence -= amount;
        targetProfile.valence += amount;
        giftSessions.delete(user.id);

        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle('🎁 تم الإهداء بنجاح!')
            .setDescription(`تم إرسال **${amount} Valence** بنجاح إلى <@${session.targetUserId}>!`);

        return await interaction.update({ embeds: [embed], components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle('PRIMARY'))] });
    }

    // Gift Item
    if (customId === 'btn_gift_item') {
        const userItems = Object.keys(profile.inventory).filter(item => profile.inventory[item] > 0 && item !== "Toxic Waste").slice(0, 25);
        if (userItems.length === 0) return await interaction.reply({ content: '🎒 مستودعك فارغ من المواد!', ephemeral: true });

        const options = userItems.map(item => ({
            label: `${ELEMENT_NAMES[item] || item} (المتوفر: ${profile.inventory[item]})`,
            value: item
        }));

        const embed = new MessageEmbed().setColor('#2ecc71').setTitle('📦 اختر المادة للإهداء:');
        const row = new MessageActionRow().addComponents(new MessageSelectMenu().setCustomId('select_gift_item_type').setPlaceholder('📦 اختر المادة...').addOptions(options));
        
        return await interaction.update({ embeds: [embed], components: [row] });
    }

    if (interaction.isSelectMenu() && customId === 'select_gift_item_type') {
        const selectedItem = interaction.values[0];
        giftSessions.set(user.id, { itemType: selectedItem });

        const embed = new MessageEmbed().setColor('#2ecc71').setTitle(`🎁 إهداء مادة: ${ELEMENT_NAMES[selectedItem] || selectedItem}`).setDescription('اختر المستلم:');
        const selectRow = await buildMemberSelectMenu(guild, user.id, 'confirm_gift_item_target', '👤 اختر المستلم...');

        return await interaction.update({ embeds: [embed], components: [selectRow] });
    }

    if (interaction.isSelectMenu() && customId === 'confirm_gift_item_target') {
        const targetUserId = interaction.values[0];
        const session = giftSessions.get(user.id);

        if (targetUserId === 'none' || !session || !session.itemType) return await interaction.reply({ content: '❌ حدث خطأ بالجلسة!', ephemeral: true });
        
        const itemKey = session.itemType;
        if ((profile.inventory[itemKey] || 0) < 1) return await interaction.reply({ content: '❌ لا تملك المادة!', ephemeral: true });

        const targetProfile = getProfile(targetUserId);
        profile.inventory[itemKey] -= 1;
        targetProfile.inventory[itemKey] = (targetProfile.inventory[itemKey] || 0) + 1;
        giftSessions.delete(user.id);

        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle('🎁 تم إرسال المادة بنجاح!')
            .setDescription(`تم نقل **1x ${ELEMENT_NAMES[itemKey] || itemKey}** إلى <@${targetUserId}>!`);

        return await interaction.update({ embeds: [embed], components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle('PRIMARY'))] });
    }
}

module.exports = {
    buildMainMenuEmbed,
    buildMainRow,
    handleLabSession
};

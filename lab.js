// lab.js - Minecraft / Chemistry Discord Bot Engine (v1.5 Complete & Polished)
const { 
    MessageActionRow, 
    MessageButton, 
    MessageEmbed, 
    MessageSelectMenu,
    Modal,
    TextInputComponent,
    ModalSubmitInteraction
} = require('discord.js');

// ----------------------------------------------------
// Database Sim / In-Memory Data Stores
// ----------------------------------------------------
const userProfiles = new Map();
const marketListings = []; // P2P Market Listings
const giftSessions = new Map(); // Store temporary state for Modals: userId -> { targetUserId, itemType }

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
    1: { title: "مبتدئ مختبر", maxEnergy: 100 },
    5: { title: "كيميائي طامح", maxEnergy: 150 },
    10: { title: "مساعد باحث", maxEnergy: 200 },
    15: { title: "خبير تفاعلات", maxEnergy: 250 },
    16: { title: "كيميائي عضوي", maxEnergy: 270 },
    18: { title: "متخصص معادن نفيسة", maxEnergy: 300 },
    20: { title: "مهندس مفاعلات آلية", maxEnergy: 350 },
    22: { title: "باحث أكاديمي متقدم", maxEnergy: 400 },
    25: { title: "بروفيسور المادة والتصنيع", maxEnergy: 500 }
};

// Market Fluctuation Multiplier
let currentMarketFluctuation = 1.0;
function updateMarketPrices() {
    currentMarketFluctuation = parseFloat((0.8 + Math.random() * 0.5).toFixed(2));
}
setInterval(updateMarketPrices, 3600000); // Hourly

// Helper: Fetch or initialize user profile
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
    let members = [];
    try {
        const fetched = await guild.members.fetch({ limit: 50 });
        members = fetched.filter(m => !m.user.bot && m.id !== currentUserId);
    } catch (e) {
        console.error("Failed to fetch guild members:", e);
    }

    const options = members.map(m => ({
        label: m.displayName || m.user.username,
        value: m.id,
        description: `إرسال الهدية إلى ${m.user.tag}`
    })).slice(0, 25); // Cap at 25 max items

    if (options.length === 0) {
        options.push({
            label: "لا يوجد أعضاء متاحون حالياً",
            value: "none",
            description: "تأكد من وجود أعضاء آخرين في السيرفر"
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
    // ----------------------------------------------------
    // Modal Submissions (Processing Custom Amounts)
    // ----------------------------------------------------
    if (interaction.isModalSubmit()) {
        const profile = getProfile(interaction.user.id);
        const session = giftSessions.get(interaction.user.id);

        if (interaction.customId === 'modal_gift_valence') {
            const amountInput = interaction.fields.getTextInputValue('input_gift_amount');
            const amount = parseInt(amountInput);

            if (isNaN(amount) || amount <= 0) {
                return await interaction.reply({ content: '❌ يرجى إدخال مبلغ رقمي صحيح!', ephemeral: true });
            }
            if (profile.valence < amount) {
                return await interaction.reply({ content: `❌ لا تملك رصيد كافٍ! رصيدك الحالي: **${profile.valence} Valence**.`, ephemeral: true });
            }
            if (!session || !session.targetUserId) {
                return await interaction.reply({ content: '❌ انتهت الجلسة، يرجى إعادة محاولة الإهداء.', ephemeral: true });
            }

            const targetProfile = getProfile(session.targetUserId);
            profile.valence -= amount;
            targetProfile.valence += amount;
            giftSessions.delete(interaction.user.id);

            return await interaction.reply({
                content: `🎉 تم إهداء **${amount} Valence** بنجاح إلى <@${session.targetUserId}>!`,
                ephemeral: false
            });
        }

        if (interaction.customId === 'modal_gift_item') {
            const qtyInput = interaction.fields.getTextInputValue('input_item_qty');
            const quantity = parseInt(qtyInput);
            const itemKey = session?.itemType;

            if (isNaN(quantity) || quantity <= 0) {
                return await interaction.reply({ content: '❌ يرجى إدخال كمية رقمية صحيحة!', ephemeral: true });
            }
            const currentQty = profile.inventory[itemKey] || 0;
            if (currentQty < quantity) {
                return await interaction.reply({ content: `❌ لا تملك كمية كافية من **${ELEMENT_NAMES[itemKey] || itemKey}**! المتوفر لديك: ${currentQty}.`, ephemeral: true });
            }

            const targetProfile = getProfile(session.targetUserId);
            profile.inventory[itemKey] -= quantity;
            targetProfile.inventory[itemKey] = (targetProfile.inventory[itemKey] || 0) + quantity;
            giftSessions.delete(interaction.user.id);

            return await interaction.reply({
                content: `📦 تم إرسال **${quantity}x ${ELEMENT_NAMES[itemKey] || itemKey}** بنجاح إلى <@${session.targetUserId}>!`,
                ephemeral: false
            });
        }
    }

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
            .setDescription('اختر القسم المطلوب للوصول للميزات الاقتصادية، البحثية، والإهداء الجديدة:');

        return await interaction.update({ embeds: [embed], components: buildMoreMenuRows() });
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
            claimedText = `✅ قامت الورشة بإنتاج **${producedQty}** من **${ELEMENT_NAMES[profile.automatedProduct] || profile.automatedProduct}**!`;
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
        return await interaction.reply({ content: `⚙️ تم ضبط الورشة الآلية لإنتاج **${ELEMENT_NAMES[profile.automatedProduct]}** بنجاح!`, ephemeral: true });
    }

    // Marketplace
    if (customId === 'btn_marketplace') {
        const embed = new MessageEmbed()
            .setColor('#f1c40f')
            .setTitle('📈 البورصة وسوق التداول بين اللاعبين')
            .setDescription(`**مؤشر البورصة اليومي:** ${currentMarketFluctuation}x\nتتغير أسعار الشراء والبيع في المتجر بناءً على حالة السوق!`)
            .addField('💡 نصيحة الاستثمار', 'اشترِ المركبات عندما يكون المؤشر منخفضاً وبعها في أوقات الارتفاع لتحقيق أرباح Valence عاليّة.');

        return await interaction.update({ embeds: [embed], components: [new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_back_main').setLabel('↩️ عودة للرئيسية').setStyle('SECONDARY'))] });
    }

    // Research Papers
    if (customId === 'btn_research') {
        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle('📄 نشر الأوراق البحثية والمجلات العلمية')
            .setDescription(`نقاط السمعة الأكاديمية الحالية: **${profile.academicReputation} pts**`)
            .addField('🔬 التقديم المتاح', 'نشر ورقة بحثية عن النيتروجليسرين (C3H5N3O9) ➔ +50 السمعة العلميّة.');

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

    // Gifting Menu System
    if (customId === 'btn_gift_menu') {
        const embed = new MessageEmbed()
            .setColor('#f39c12')
            .setTitle('🎁 نظام الإهداء والكرم الكيميائي')
            .setDescription('اختر نوع الهدية المراد إرسالها لأحد أعضاء السيرفر:');

        const row = new MessageActionRow().addComponents(
            new MessageButton().setCustomId('btn_gift_valence').setLabel('💳 إهداء رصيد Valence').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_gift_item').setLabel('📦 إهداء مادة/عنصر').setStyle('PRIMARY'),
            new MessageButton().setCustomId('btn_more_menu').setLabel('↩️ عودة للقائمة').setStyle('SECONDARY')
        );

        return await interaction.update({ embeds: [embed], components: [row] });
    }

    // Gift Valence - Step 1: Select Member
    if (customId === 'btn_gift_valence') {
        const embed = new MessageEmbed()
            .setColor('#f39c12')
            .setTitle('💳 إهداء رصيد Valence')
            .setDescription('اختر العضو المراد تحويل الرصيد إليه:');

        const userSelectRow = await buildMemberSelectMenu(guild, user.id, 'select_gift_target_valence', '👤 اختر اللاعب المستلم...');
        const backRow = new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_gift_menu').setLabel('↩️ إلغاء وعودة').setStyle('SECONDARY'));

        return await interaction.update({ embeds: [embed], components: [userSelectRow, backRow] });
    }

    // Gift Valence - Step 2: Show Modal
    if (interaction.isSelectMenu() && customId === 'select_gift_target_valence') {
        const targetUserId = interaction.values[0];
        if (targetUserId === 'none') return await interaction.reply({ content: '❌ مستلم غير صالح!', ephemeral: true });

        giftSessions.set(user.id, { targetUserId });

        const modal = new Modal()
            .setCustomId('modal_gift_valence')
            .setTitle('💳 حدد مبلغ Valence للإهداء');

        const amountInput = new TextInputComponent()
            .setCustomId('input_gift_amount')
            .setLabel("المبلغ المراد إهداؤه:")
            .setStyle('SHORT')
            .setPlaceholder('مثال: 100')
            .setRequired(true);

        modal.addComponents(new MessageActionRow().addComponents(amountInput));
        return await interaction.showModal(modal);
    }

    // Gift Item - Step 1: Select Item
    if (customId === 'btn_gift_item') {
        const userItems = Object.keys(profile.inventory).filter(item => profile.inventory[item] > 0 && item !== "Toxic Waste").slice(0, 25);

        if (userItems.length === 0) {
            return await interaction.reply({ content: '🎒 مستودعك فارغ من المواد القابلة للإهداء!', ephemeral: true });
        }

        const itemOptions = userItems.map(item => ({
            label: `${ELEMENT_NAMES[item] || item} (المتوفر: ${profile.inventory[item]})`,
            value: item
        }));

        const itemSelectRow = new MessageActionRow().addComponents(
            new MessageSelectMenu().setCustomId('select_gift_item_type').setPlaceholder('📦 اختر المادة المراد إهداؤها...').addOptions(itemOptions)
        );

        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle('📦 إهداء مادة من المستودع')
            .setDescription('اختر المادة المراد تحويلها:');

        const backRow = new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_gift_menu').setLabel('↩️ إلغاء وعودة').setStyle('SECONDARY'));

        return await interaction.update({ embeds: [embed], components: [itemSelectRow, backRow] });
    }

    // Gift Item - Step 2: Select Target Member
    if (interaction.isSelectMenu() && customId === 'select_gift_item_type') {
        const selectedItem = interaction.values[0];
        giftSessions.set(user.id, { itemType: selectedItem });

        const embed = new MessageEmbed()
            .setColor('#2ecc71')
            .setTitle(`🎁 إهداء مادة: ${ELEMENT_NAMES[selectedItem] || selectedItem}`)
            .setDescription(`اختر العضو المستلم لنقل الشحنة إليه:`);

        const userSelectRow = await buildMemberSelectMenu(guild, user.id, 'confirm_gift_item_target', '👤 اختر اللاعب المستلم...');
        const backRow = new MessageActionRow().addComponents(new MessageButton().setCustomId('btn_gift_menu').setLabel('↩️ إلغاء وعودة').setStyle('SECONDARY'));

        return await interaction.update({ embeds: [embed], components: [userSelectRow, backRow] });
    }

    // Gift Item - Step 3: Show Quantity Modal
    if (interaction.isSelectMenu() && customId === 'confirm_gift_item_target') {
        const targetUserId = interaction.values[0];
        if (targetUserId === 'none') return await interaction.reply({ content: '❌ مستلم غير صالح!', ephemeral: true });

        const currentSession = giftSessions.get(user.id) || {};
        giftSessions.set(user.id, { ...currentSession, targetUserId });

        const modal = new Modal()
            .setCustomId('modal_gift_item')
            .setTitle('📦 حدد الكمية المراد إرسالها');

        const qtyInput = new TextInputComponent()
            .setCustomId('input_item_qty')
            .setLabel("الكمية:")
            .setStyle('SHORT')
            .setPlaceholder('مثال: 5')
            .setRequired(true);

        modal.addComponents(new MessageActionRow().addComponents(qtyInput));
        return await interaction.showModal(modal);
    }
}

module.exports = {
    buildMainMenuEmbed,
    buildMainRow,
    handleLabSession
};

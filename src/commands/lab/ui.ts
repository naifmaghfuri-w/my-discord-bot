import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    User 
} from 'discord.js';
import labData from './data';
import { PlayerData } from './helpers';

export interface ShopItem {
    type: 'item' | 'equipment' | 'upgrade';
    id: string;
    name: string;
    price: number;
    desc?: string;
    state?: string;
    reqLevel?: number;
    buyable?: boolean;
}

export interface LabReaction {
    id: string;
    name: string;
    tool: string;
    reqLevel: number;
    costAbility: number;
    xp: number;
    timeSec: number;
    targetTemp: number;
    targetPress: number;
    req: Record<string, number>;
    yield: Record<string, number>;
}

export interface MenuResponse {
    embeds: EmbedBuilder[];
    components: ActionRowBuilder<ButtonBuilder>[];
}

// 1. القائمة الرئيسية
export function buildMainMenu(user: User, player: PlayerData): MenuResponse {
    const totalItems = Object.keys(labData.items || {}).length;
    const embed = new EmbedBuilder()
        .setTitle('🧪 Lab v1.5')
        .setDescription(`أهلاً بك **${user.username}** 👋`)
        .setColor(0x2ecc71)
        .addFields(
            { name: '\u200B', value: `\`Level.${player.level}/25\``, inline: true },
            { name: '\u200B', value: `\`${player.xp} / ${player.level * 100} XP\``, inline: true },
            { name: ' ', value: `\`${player.abilityPoints} AP\``, inline: true },
            { name: '\u200B', value: `${player.coins} <:emoji_40:1548935096768274532>`, inline: true },
            { name: '📜 السمعة الأكاديمية', value: `\`${player.academicReputation || 0} pts\``, inline: true },
            { name: '📘 الموسوعة', value: `\`${(player.codex || []).length} / ${totalItems}\``, inline: true }
        )
        .setThumbnail(user.displayAvatarURL())
        .setFooter({ text: 'اختر إجراءً سريعاً أو افتح القائمة الإضافية' });

    if (player.pendingQueue && player.pendingQueue.length > 0) {
        embed.addFields({ name: '⏳ تفاعلات جارية', value: `عدد التفاعلات قيد التنفيذ: **${player.pendingQueue.length}**` });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('المعمل').setEmoji('🧪').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_shop').setLabel('المتجر').setEmoji('🛒').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_sell_all').setLabel('بيع النواتج').setEmoji('💵').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('القائمة الإضافية 📂').setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row1, row2] };
}

// 2. واجهة المعمل الكيميائي
export function buildLabHubScreen(): MenuResponse {
    const embed = new EmbedBuilder()
        .setTitle('🧪 المعمل الكيميائي')
        .setDescription('اختر القسم الذي تريد الانتقال إليه داخل المعمل:')
        .setColor(0x9b59b6)
        .addFields(
            { name: '🎒 المستودع', value: 'استعراض المواد والعناصر الموجودة في مخزونك.' },
            { name: '⚗️ غرفة التفاعلات', value: 'إجراء وتصنيع التفاعلات المفتوحة لديك.' },
            { name: '🧪 الخلط العشوائي', value: 'دمج المواد عشوائياً لاكتشاف مركبات سرية جديدة!' },
            { name: '☣️ النفايات البيئية', value: 'معالجة وتصنيع أو تنظيف النفايات الكيميائية.' }
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_inv').setLabel('المستودع').setEmoji('🎒').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_reactions').setLabel('غرفة التفاعلات').setEmoji('⚗️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_secret_mix').setLabel('خلط عشوائي').setEmoji('🧪').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_open_hazards').setLabel('النفايات البيئية').setEmoji('☣️').setStyle(ButtonStyle.Danger)
    );

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row, backRow] };
}

// 3. القائمة الإضافية
export function buildMoreMenu(user: User, player: PlayerData): MenuResponse {
    const embed = new EmbedBuilder()
        .setTitle('📂 القائمة الإضافية - v1.5')
        .setDescription('استعرض الأقسام المتاحة للتطوير والاقتصاد والأنشطة التنافسية:')
        .setColor(0x7289da)
        .addFields(
            { name: '📜 المستويات والقدرات', value: 'فتح التفاعلات المتاحة حتى Lv.25.', inline: true },
            { name: '🏭 الورشة الآلية', value: 'خط إنتاج تلقائي للمركبات (Lv.20+).', inline: true },
            { name: '📈 البورصة والسوق', value: 'تداول العروض والاستثمار المباشر.', inline: true },
            { name: '📄 الأوراق البحثية', value: 'تقديم الأبحاث لكسب السمعة الأكاديمية.', inline: true },
            { name: '⚔️ تحدي الرموز', value: 'تحدي كيميائي سريع ضد لاعب آخر.', inline: true },
            { name: '🎁 نظام الإهداء', value: 'إرسال النقاط أو المواد للأصدقاء.', inline: true },
            { name: '📋 المهام اليومية', value: 'أهداف متجددة ورصيد مكافآت.', inline: true },
            { name: '📘 الموسوعة الكيميائية', value: 'استعراض المركبات والعناصر المكتشفة.', inline: true }
        );

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_levels').setLabel('المستويات').setEmoji('📜').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_automation').setLabel('الورشة الآلية').setEmoji('🏭').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_market').setLabel('البورصة').setEmoji('📈').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_research').setLabel('الأبحاث').setEmoji('📄').setStyle(ButtonStyle.Success)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_duels').setLabel('تحدي الرموز').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('btn_open_gift').setLabel('إهداء لاعب').setEmoji('🎁').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_open_quest').setLabel('المهام').setEmoji('📋').setStyle(ButtonStyle.Primary)
    );

    const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_codex').setLabel('الموسوعة').setEmoji('📘').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرجوع للرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

// 4. شاشة المتجر
export function buildShopScreen(player: PlayerData, index: number): MenuResponse {
    const shopList: ShopItem[] = [
        ...Object.entries(labData.items || {})
            .filter(([_, item]: [string, any]) => item.buyable && (item.reqLevel || 1) <= player.level)
            .map(([id, item]: [string, any]) => ({ type: 'item' as const, id, ...item })),
        ...Object.entries(labData.equipment || {})
            .filter(([_, eq]: [string, any]) => eq.reqLevel <= player.level)
            .map(([id, eq]: [string, any]) => ({ type: 'equipment' as const, id, ...eq })),
        ...Object.values(labData.upgrades || {})
            .map((up: any) => ({ type: 'upgrade' as const, ...up }))
    ];

    if (shopList.length === 0) {
        const emptyEmbed = new EmbedBuilder().setTitle('🛒 المتجر').setDescription('لا توجد عناصر متاحة حالياً في المتجر لمستواك.').setColor(0xe74c3c);
        const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
        );
        return { embeds: [emptyEmbed], components: [navRow] };
    }

    const safeIndex = Math.min(Math.max(0, index), shopList.length - 1);
    const currentItem = shopList[safeIndex];
    let buyBtnDisabled = false;
    let buyBtnLabel = `🛒 شراء بـ ${currentItem.price}`;

    if (currentItem.type === 'upgrade') {
        const isOwned = (player.upgrades || {})[currentItem.id.replace('up_', '')];
        if (isOwned) {
            buyBtnDisabled = true;
            buyBtnLabel = '✅ تمتلك هذه الترقية';
        } else if (player.coins < currentItem.price) {
            buyBtnDisabled = true;
            buyBtnLabel = `❌ الرصيد غير كافي (${currentItem.price})`;
        }
    } else if (currentItem.type === 'equipment') {
        const isOwned = Boolean(player.ownedEquipment && player.ownedEquipment[currentItem.id]);
        if (isOwned) {
            buyBtnDisabled = true;
            buyBtnLabel = '✅ تمتلك هذا الجهاز بالفعل';
        } else if (player.coins < currentItem.price) {
            buyBtnDisabled = true;
            buyBtnLabel = `❌ الرصيد غير كافي (${currentItem.price})`;
        }
    } else {
        if (player.coins < currentItem.price) {
            buyBtnDisabled = true;
            buyBtnLabel = `❌ الرصيد غير كافي (${currentItem.price})`;
        }
    }

    const embed = new EmbedBuilder()
        .setTitle(`🛒 المتجر: ${currentItem.name}`)
        .setDescription(currentItem.desc || `عنصر كيميائي أو جهاز مخبري متقدم.\n**الحالة الفيزيائية/المستوى:** ${currentItem.state || 'مستوى ' + (currentItem.reqLevel || 1)}`)
        .setColor(0xf1c40f)
        .addFields(
            { name: '💵 السعر', value: `\`${currentItem.price} <:emoji_40:1548935096768274532>\``, inline: true },
            { 
                name: '🎒 الكمية / الحالة لديك', 
                value: currentItem.type === 'item' 
                    ? `\`${(player.inv || {})[currentItem.id] || 0}\`` 
                    : (currentItem.type === 'equipment' 
                        ? ((player.ownedEquipment || {})[currentItem.id] ? '`مملوك`' : '`غير مملوك`') 
                        : ((player.upgrades || {})[currentItem.id.replace('up_', '')] ? '`مفعّل`' : '`غير مفعّل`')), 
                inline: true 
            }
        )
        .setFooter({ text: `رصيدك الحالي: ${player.coins} <:emoji_40:1548935096768274532> | عنصر ${safeIndex + 1} من ${shopList.length}` });

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_shop_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(safeIndex === 0),
        new ButtonBuilder().setCustomId(`btn_buy_shop_${currentItem.type}_${currentItem.id}`).setLabel(buyBtnLabel).setStyle(ButtonStyle.Success).setDisabled(buyBtnDisabled),
        new ButtonBuilder().setCustomId('btn_shop_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(safeIndex === shopList.length - 1),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

// 5. شاشة شجرة القدرات والمستويات
export function buildLevelScreen(player: PlayerData, index: number): MenuResponse {
    const reaction: LabReaction = labData.reactions[index];
    const isUnlocked = (player.unlockedReactions || []).includes(reaction.id);
    const isLevelReached = player.level >= reaction.reqLevel;

    const reqList = Object.entries(reaction.req || {})
        .map(([id, qty]) => `• ${labData.items[id]?.name || id}: \`${qty}\``)
        .join('\n');

    const yieldList = Object.entries(reaction.yield || {})
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

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_lvl_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_unlock_reaction_${reaction.id}`).setLabel(btnLabel).setStyle(btnStyle).setDisabled(btnDisabled),
        new ButtonBuilder().setCustomId('btn_lvl_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === labData.reactions.length - 1)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_jump_to_level').setLabel('🔢 الانتقال لمستوى سريع').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row2, row1] };
}

// 6. شاشة غرفة التفاعلات
export function buildReactionsScreen(player: PlayerData, index: number): MenuResponse {
    const unlockedList: LabReaction[] = (labData.reactions || []).filter((r: LabReaction) => (player.unlockedReactions || []).includes(r.id));

    if (unlockedList.length === 0) {
        const emptyEmbed = new EmbedBuilder()
            .setTitle('⚗️ غرفة التفاعلات')
            .setDescription('❌ لا تملك أي تفاعلات مفتوحة حالياً! افتح **شجرة القدرات والمستويات** لفتح تفاعلاتك الأولى.')
            .setColor(0xe74c3c);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_open_levels').setLabel('فتح القدرات').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ المعمل').setStyle(ButtonStyle.Secondary)
        );
        return { embeds: [emptyEmbed], components: [row] };
    }

    const safeIndex = Math.min(Math.max(0, index), unlockedList.length - 1);
    const reaction = unlockedList[safeIndex];
    const reqList = Object.entries(reaction.req || {})
        .map(([id, qty]) => `• ${labData.items[id]?.name || id}: \`${qty}\` (لديك: \`${(player.inv || {})[id] || 0}\`)`)
        .join('\n');

    const equipOwned = Boolean(player.ownedEquipment && player.ownedEquipment[reaction.tool]);
    const equipName = labData.equipment[reaction.tool]?.name || reaction.tool;

    const embed = new EmbedBuilder()
        .setTitle(`⚗️ اختر تفاعلاً: ${reaction.name}`)
        .setDescription(`**الجهاز المطلوب:** ${equipName}${equipOwned ? ' ✅' : ' ❌ (غير مملوك)'}\n**الوقت المطلوب:** \`${(player.upgrades || {}).speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec} ثانية\``)
        .setColor(0x3498db)
        .addFields(
            { name: '🧪 المواد المطلوبة للتفاعل', value: reqList || 'لا يوجد' },
            { name: '⭐ خبرة التفاعل', value: `\`+${reaction.xp} XP\``, inline: true }
        )
        .setFooter({ text: `تفاعل ${safeIndex + 1} من ${unlockedList.length}` });

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_react_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(safeIndex === 0),
        new ButtonBuilder().setCustomId(`btn_select_calib_${reaction.id}`).setLabel('🎛️ بدء المعايرة').setStyle(ButtonStyle.Success).setDisabled(!equipOwned),
        new ButtonBuilder().setCustomId('btn_react_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(safeIndex === unlockedList.length - 1),
        new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ المعمل').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

// 7. شاشة المعايرة (الحرارة والضغط)
export function buildCalibScreen(reaction: LabReaction, tempIndex: number, pressIndex: number): MenuResponse {
    const currentTemp = labData.TEMP_STEPS[tempIndex];
    const currentPress = labData.PRESS_STEPS[pressIndex];

    const reqList = Object.entries(reaction.req || {})
        .map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``)
        .join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`🎛️ معايرة التفاعل: ${reaction.name}`)
        .setDescription(`**الجهاز المستخدم:** ${labData.equipment[reaction.tool]?.name || reaction.tool}\nاضبط الحرارة والضغط بالأسهم ثم اضغط **بدء التفاعل**.`)
        .setColor(0xe74c3c)
        .addFields(
            { name: '🔥 درجة الحرارة الحالية', value: `\`${currentTemp} °C\``, inline: true },
            { name: '💨 الضغط الجوي الحالي', value: `\`${currentPress} atm\``, inline: true },
            { name: '🧪 المواد المطلوبة', value: reqList || 'لا يوجد', inline: false }
        );

    const tempRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_temp_down').setLabel('🔥 حرارة ➖').setStyle(ButtonStyle.Primary).setDisabled(tempIndex === 0),
        new ButtonBuilder().setCustomId('btn_temp_val').setLabel(`🔥 ${currentTemp} °C`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('btn_temp_up').setLabel('🔥 حرارة ➕').setStyle(ButtonStyle.Primary).setDisabled(tempIndex === labData.TEMP_STEPS.length - 1)
    );

    const pressRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_press_down').setLabel('💨 ضغط ➖').setStyle(ButtonStyle.Primary).setDisabled(pressIndex === 0),
        new ButtonBuilder().setCustomId('btn_press_val').setLabel(`💨 ${currentPress} atm`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('btn_press_up').setLabel('💨 ضغط ➕').setStyle(ButtonStyle.Primary).setDisabled(pressIndex === labData.PRESS_STEPS.length - 1)
    );

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_start_reaction').setLabel('🚀 بدء التفاعل').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ إلغاء').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [tempRow, pressRow, actionRow] };
}

// 8. شاشة الموسوعة (Codex)
export function buildCodexScreen(player: PlayerData, page: number = 0): MenuResponse {
    const discovered = player.codex || [];
    const itemKeys = Object.keys(labData.items || {});
    const itemsPerPage = 6;
    const totalPages = Math.max(1, Math.ceil(itemKeys.length / itemsPerPage));

    const currentPageKeys = itemKeys.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    let codexList = '';

    currentPageKeys.forEach(id => {
        const item = labData.items[id];
        if (discovered.includes(id)) {
            codexList += `✅ **${item?.name || id}** (${item?.state || 'عادي'})\n_${item?.desc || 'مادة كيميائية مخبرية'}_\n\n`;
        } else {
            codexList += `❓ **مركب مجهول** - (لم تقم بتصنيعه أو اكتشافه بعد)\n\n`;
        }
    });

    const embed = new EmbedBuilder()
        .setTitle('📘 الموسوعة الكيميائية (Codex)')
        .setDescription(codexList || '_لا توجد عناصر في هذه الصفحة_')
        .setColor(0x9b59b6)
        .setFooter({ text: `الصفحة ${page + 1} من ${totalPages} | تم اكتشاف ${discovered.length} من أصل ${itemKeys.length} مركبات` });

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_codex_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('btn_codex_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

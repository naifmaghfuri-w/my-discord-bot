import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    User,
    CommandInteraction,
    MessageComponentInteraction,
    ModalSubmitInteraction,
    TextChannel,
    Message
} from 'discord.js';

// استيراد الملفات المساعدة (يرجى التأكد من إنشاء واجهاتها في ملفاتها الخاصة)
import labData from './data';
import { 
    getMarketPrices, 
    processItemStabilityAndDecay, 
    getPlayerData, 
    updatePlayerData 
} from './helpers';

// ==========================================
// 1. Interfaces & Types Definition
// ==========================================

export interface Inventory {
    [itemId: string]: number;
}

export interface PendingTask {
    busyUntil: number;
    yield: Record<string, number>;
    xp: number;
}

export interface Quest {
    item: string;
    count: number;
    progress: number;
    rewardCoins: number;
    rewardXp: number;
    completed: boolean;
}

export interface PlayerData {
    level: number;
    xp: number;
    abilityPoints: number;
    coins: number;
    academicReputation?: number;
    codex: string[];
    pendingQueue?: PendingTask[];
    unlockedReactions: string[];
    inv: Inventory;
    ownedEquipment: Record<string, boolean>;
    equipmentLevels: Record<string, number>;
    upgrades: Record<string, boolean>;
    unlockedBadges: string[];
    itemTimestamps: Record<string, number>;
    lastAutoClaim?: number;
    automatedProduct?: string;
    achievements: {
        cautious?: number;
        [key: string]: number | undefined;
    };
    quest: Quest;
}

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

type CommandContext = CommandInteraction | {
    replied?: boolean;
    deferred?: boolean;
    isCommand?: () => boolean;
    channel?: TextChannel | null;
    reply: (options: any) => Promise<Message>;
    followUp: (options: any) => Promise<Message>;
};

// ==========================================
// 2. Screen Builder Functions
// ==========================================

function buildMainMenu(user: User, player: PlayerData): MenuResponse {
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
            { name: '📘 الموسوعة', value: `\`${player.codex.length} / ${Object.keys(labData.items).length}\``, inline: true }
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

function buildLabHubScreen(): MenuResponse {
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

function buildMoreMenu(user: User, player: PlayerData): MenuResponse {
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

function buildLevelScreen(player: PlayerData, index: number): MenuResponse {
    const reaction: LabReaction = labData.reactions[index];
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

function buildShopScreen(player: PlayerData, index: number): MenuResponse {
    const shopList: ShopItem[] = [
        ...Object.entries(labData.items)
            .filter(([_, item]: [string, any]) => item.buyable && (item.reqLevel || 1) <= player.level)
            .map(([id, item]: [string, any]) => ({ type: 'item' as const, id, ...item })),
        ...Object.entries(labData.equipment)
            .filter(([_, eq]: [string, any]) => eq.reqLevel <= player.level)
            .map(([id, eq]: [string, any]) => ({ type: 'equipment' as const, id, ...eq })),
        ...Object.values(labData.upgrades)
            .map((up: any) => ({ type: 'upgrade' as const, ...up }))
    ];

    const currentItem = shopList[index];
    let buyBtnDisabled = false;
    let buyBtnLabel = `🛒 شراء بـ ${currentItem.price}`;

    if (currentItem.type === 'upgrade') {
        const isOwned = player.upgrades[currentItem.id.replace('up_', '')];
        if (isOwned) {
            buyBtnDisabled = true;
            buyBtnLabel = '✅ تمتلك هذه الترقية';
        } else if (player.coins < currentItem.price) {
            buyBtnDisabled = true;
            buyBtnLabel = `❌ الرصيد غير كافي (${currentItem.price})`;
        }
    } else if (currentItem.type === 'equipment') {
        const isOwned = player.ownedEquipment && player.ownedEquipment[currentItem.id];
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
                    ? `\`${player.inv[currentItem.id] || 0}\`` 
                    : (currentItem.type === 'equipment' 
                        ? (player.ownedEquipment[currentItem.id] ? '`مملوك`' : '`غير مملوك`') 
                        : (player.upgrades[currentItem.id.replace('up_', '')] ? '`مفعّل`' : '`غير مفعّل`')), 
                inline: true 
            }
        )
        .setFooter({ text: `رصيدك الحالي: ${player.coins} <:emoji_40:1548935096768274532> | عنصر ${index + 1} من ${shopList.length}` });

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_shop_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_buy_shop_${currentItem.type}_${currentItem.id}`).setLabel(buyBtnLabel).setStyle(ButtonStyle.Success).setDisabled(buyBtnDisabled),
        new ButtonBuilder().setCustomId('btn_shop_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === shopList.length - 1),
        new ButtonBuilder().setCustomId('btn_back_main').setLabel('↩️ الرئيسية').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

function buildCalibScreen(reaction: LabReaction, tempIndex: number, pressIndex: number): MenuResponse {
    const currentTemp = labData.TEMP_STEPS[tempIndex];
    const currentPress = labData.PRESS_STEPS[pressIndex];

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

function buildReactionsScreen(player: PlayerData, index: number): MenuResponse {
    const unlockedList: LabReaction[] = labData.reactions.filter((r: LabReaction) => player.unlockedReactions.includes(r.id));

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

    const reaction = unlockedList[index];
    const reqList = Object.entries(reaction.req)
        .map(([id, qty]) => `• ${labData.items[id]?.name || id}: \`${qty}\` (لديك: \`${player.inv[id] || 0}\`)`)
        .join('\n');

    const equipOwned = player.ownedEquipment && player.ownedEquipment[reaction.tool];
    const equipName = labData.equipment[reaction.tool]?.name || reaction.tool;

    const embed = new EmbedBuilder()
        .setTitle(`⚗️ اختر تفاعلاً: ${reaction.name}`)
        .setDescription(`**الجهاز المطلوب:** ${equipName}${equipOwned ? '✅' : '❌ (غير مملوك)'}\n**الوقت المطلوب:** \`${player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec} ثانية\``)
        .setColor(0x3498db)
        .addFields(
            { name: '🧪 المواد المطلوبة للتفاعل', value: reqList },
            { name: '⭐ خبرة التفاعل', value: `\`+${reaction.xp} XP\``, inline: true }
        )
        .setFooter({ text: `تفاعل ${index + 1} من ${unlockedList.length}` });

    const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_react_prev').setLabel('⬅️ السابق').setStyle(ButtonStyle.Secondary).setDisabled(index === 0),
        new ButtonBuilder().setCustomId(`btn_select_calib_${reaction.id}`).setLabel('🎛️ بدء المعايرة').setStyle(ButtonStyle.Success).setDisabled(!equipOwned),
        new ButtonBuilder().setCustomId('btn_react_next').setLabel('التالي ➡️').setStyle(ButtonStyle.Secondary).setDisabled(index === unlockedList.length - 1),
        new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ المعمل').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [navRow] };
}

function buildCodexScreen(player: PlayerData, page: number = 0): MenuResponse {
    const discovered = player.codex || [];
    const itemKeys = Object.keys(labData.items);
    const itemsPerPage = 6;
    const totalPages = Math.ceil(itemKeys.length / itemsPerPage);

    const currentPageKeys = itemKeys.slice(page * itemsPerPage, (page + 1) * itemsPerPage);
    let codexList = '';

    currentPageKeys.forEach(id => {
        const item = labData.items[id];
        if (discovered.includes(id)) {
            codexList += `✅ **${item.name}** (${item.state})\n_${item.desc || 'مادة كيميائية مخبرية'}_\n\n`;
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

function buildEquipUpgradeScreen(player: PlayerData): MenuResponse {
    let equipList = '';
    const owned = player.ownedEquipment || {};

    Object.entries(labData.equipment).forEach(([id, eq]: [string, any]) => {
        if (owned[id]) {
            const currentLv = player.equipmentLevels[id] || 1;
            const upgradeCost = currentLv * 250;
            equipList += `⚙️ **${eq.name}** (مستوى Lv.${currentLv})\n• كفاءة الجهاز: \`+${currentLv * 10}%\` | تكلفة الترقية التالية: \`${upgradeCost}\`\n\n`;
        }
    });

    if (!equipList) equipList = '_لا تملك أي أجهزة قابلة للترقية حالياً! اشتر الأجهزة من المتجر أولاً._';

    const embed = new EmbedBuilder()
        .setTitle('⚙️ تطوير وترقية أجهزة المختبر')
        .setDescription(equipList)
        .setColor(0x34495e);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

function buildAchievementsScreen(player: PlayerData): MenuResponse {
    let achList = '';

    Object.entries(labData.achievements).forEach(([id, ach]: [string, any]) => {
        const isUnlocked = player.unlockedBadges.includes(id);
        achList += `${isUnlocked ? '✅' : '🔒'} **${ach.name}**\n_${ach.desc}_\n💰 المكافأة: \`${ach.reward}\` ${isUnlocked ? '(تمت المطالبة)' : ''}\n\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle('🎖️ الإنجازات والألقاب الكيميائية')
        .setDescription(achList)
        .setColor(0xe67e22);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('↩️ قائمة الفرعيات').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row] };
}

// ==========================================
// 3. Main Session Handler
// ==========================================

export async function handleLabSession(context: CommandContext, user: User): Promise<void> {
    let player: PlayerData = getPlayerData(user.id);
    const decayedNames: string[] = processItemStabilityAndDecay(player);
    const currentNow = Math.floor(Date.now() / 1000);

    if (player.pendingQueue && player.pendingQueue.length > 0) {
        let updatedQueue: PendingTask[] = [];
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
    let responseMsg: Message;

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
    let codexPage = 0;
    let selectedReaction: LabReaction | null = null;
    let tempIndex = 0;
    let pressIndex = 0;

    const collector = responseMsg.createMessageComponentCollector({ time: 300000 });

    collector.on('collect', async (i: MessageComponentInteraction) => {
        if (i.user.id !== user.id) {
            return i.reply({ content: '❌ هذه اللوحة غير مخصصة لك!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        player = getPlayerData(user.id);
        const backMoreBtnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_open_more_menu').setLabel('الرجوع للقائمة الإضافية ↩️').setStyle(ButtonStyle.Secondary)
        );

        const backLabHubRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ المعمل').setStyle(ButtonStyle.Danger)
        );

        const updateScreen = async (data: MenuResponse) => {
            if (!i.replied && !i.deferred) {
                await i.update(data).catch(() => {});
            } else {
                await i.message.edit(data).catch(() => {});
            }
        };

        const notifyOnly = async (contentStr: string) => {
            if (!i.replied && !i.deferred) {
                await i.reply({ content: contentStr, flags: MessageFlags.Ephemeral }).catch(() => {});
            } else {
                await i.followUp({ content: contentStr, flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        };

        // Navigation
        if (i.customId === 'btn_back_main') return await updateScreen(buildMainMenu(user, player));
        if (i.customId === 'btn_open_more_menu') return await updateScreen(buildMoreMenu(user, player));
        if (i.customId === 'btn_open_lab_hub') return await updateScreen(buildLabHubScreen());

        // Inventory
        if (i.customId === 'btn_open_inv') {
            const invList = Object.keys(player.inv).length > 0 
                ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``).join('\n')
                : '_المستودع فارغ حالياً_';

            const invEmbed = new EmbedBuilder()
                .setTitle(`🎒 مستودع المواد - ${user.username}`)
                .setDescription(invList)
                .setColor(0x3498db);

            return await updateScreen({ embeds: [invEmbed], components: [backLabHubRow] });
        }

        // Codex Page Nav
        if (i.customId === 'btn_open_codex') {
            codexPage = 0;
            return await updateScreen(buildCodexScreen(player, codexPage));
        }
        if (i.customId === 'btn_codex_prev') {
            codexPage--;
            return await updateScreen(buildCodexScreen(player, codexPage));
        }
        if (i.customId === 'btn_codex_next') {
            codexPage++;
            return await updateScreen(buildCodexScreen(player, codexPage));
        }

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
                .setDescription(`${claimedText}\n\n**خط الإنتاج الحالي:** ${labData.items[player.automatedProduct || '']?.name || 'غير محدد'}\n**معدل الإنتاج:** 1 وحدة / دقيقة.`)
                .setColor(0xe91e63);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            return await updateScreen(buildMoreMenu(user, player));
        }

        // Market
        if (i.customId === 'btn_open_market') {
            const currentPrices = getMarketPrices();
            let priceListStr = Object.entries(currentPrices).slice(0, 7).map(([id, p]: [string, any]) => {
                const baseP = labData.items[id].price;
                const diff = p - baseP;
                const status = diff >= 0 ? `📈 (+${diff})` : `📉 (${diff})`;
                return `• **${labData.items[id].name}**: \`${p}\` ${status}`;
            }).join('\n');

            const marketEmbed = new EmbedBuilder()
                .setTitle('📈 البورصة الكيميائية للمضاربة')
                .setDescription(`تتغير أسعار البورصة تلقائياً كل 5 دقائق بناءً على حركة العرض والطلب!\n\n**أسعار التداول الحالية:**\n${priceListStr}`)
                .setColor(0xf1c40f)
                .addFields({ name: '💰 رصيدك الحالي', value: `\`${player.coins} <:emoji_40:1548935096768274532>\`` });

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_market_trade_modal').setLabel('📊 تداول مادة الآن').setStyle(ButtonStyle.Success),
                backMoreBtnRow.components[0]
            );

            return await updateScreen({ embeds: [marketEmbed], components: [row] });
        }

        if (i.customId === 'btn_market_trade_modal') {
            const modal = new ModalBuilder()
                .setCustomId('modal_market_trade')
                .setTitle('📈 تداول المواد في البورصة');

            const symbolInput = new TextInputBuilder()
                .setCustomId('input_trade_symbol')
                .setLabel('رمز أو اسم المادة (مثال: Au أو pure_gold)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: Au')
                .setRequired(true);

            const typeInput = new TextInputBuilder()
                .setCustomId('input_trade_type')
                .setLabel('نوع العملية (شراء / بيع)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('شراء أو بيع')
                .setRequired(true);

            const qtyInput = new TextInputBuilder()
                .setCustomId('input_trade_qty')
                .setLabel('الكمية')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 1')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(symbolInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(typeInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(qtyInput)
            );

            await i.showModal(modal);

            try {
                const submitted: ModalSubmitInteraction = await i.awaitModalSubmit({ 
                    time: 30000, 
                    filter: sub => sub.user.id === user.id 
                });
                
                const queryStr = submitted.fields.getTextInputValue('input_trade_symbol').toLowerCase().trim();
                const typeStr = submitted.fields.getTextInputValue('input_trade_type').trim();
                const qty = parseInt(submitted.fields.getTextInputValue('input_trade_qty'));

                if (isNaN(qty) || qty <= 0) {
                    return await submitted.reply({ content: '❌ يرجى كتابة كمية صحيحة!', flags: MessageFlags.Ephemeral });
                }

                const matchedItemEntry = Object.entries(labData.items).find(([id, item]: [string, any]) => 
                    id === queryStr || (item.symbol && item.symbol.toLowerCase() === queryStr)
                );

                if (!matchedItemEntry) {
                    return await submitted.reply({ content: '❌ مادة غير موجودة أو غير قابلة للتداول في البورصة!', flags: MessageFlags.Ephemeral });
                }

                const itemId = matchedItemEntry[0];
                const itemInfo = matchedItemEntry[1];
                const marketPrices = getMarketPrices();
                const currentPrice = marketPrices[itemId] || itemInfo.price;
                const totalCost = currentPrice * qty;

                if (typeStr.includes('شراء') || typeStr.toLowerCase() === 'buy') {
                    if (player.coins < totalCost) {
                        return await submitted.reply({ content: `❌ رصيدك غير كافٍ! التكلفة الإجمالية: \`${totalCost}\`.`, flags: MessageFlags.Ephemeral });
                    }
                    player.coins -= totalCost;
                    player.inv[itemId] = (player.inv[itemId] || 0) + qty;
                    updatePlayerData(user.id, player);

                    await submitted.reply({ content: `📈 **تم شراء ${qty}x من ${itemInfo.name} بسعر البورصة (${currentPrice}/وحدة) بنجاح!**`, flags: MessageFlags.Ephemeral });
                } else if (typeStr.includes('بيع') || typeStr.toLowerCase() === 'sell') {
                    if (!player.inv[itemId] || player.inv[itemId] < qty) {
                        return await submitted.reply({ content: `❌ لا تملك هذه الكمية من المادة في مستودعك!`, flags: MessageFlags.Ephemeral });
                    }
                    player.inv[itemId] -= qty;
                    if (player.inv[itemId] <= 0) delete player.inv[itemId];
                    player.coins += totalCost;
                    updatePlayerData(user.id, player);

                    await submitted.reply({ content: `📉 **تم بيع ${qty}x من ${itemInfo.name} بسعر البورصة (${currentPrice}/وحدة) بربح +${totalCost}!**`, flags: MessageFlags.Ephemeral });
                } else {
                    return await submitted.reply({ content: '❌ يرجى تحديد العملية بشكل صحيح (شراء أو بيع)!', flags: MessageFlags.Ephemeral });
                }

                return await responseMsg.edit(buildMainMenu(user, player)).catch(() => {});
            } catch (err) {
                return await notifyOnly('⏳ انتهت المهلة الزمنية لإدخال البيانات.');
            }
        }

        if (i.customId === 'btn_open_research') {
            const researchEmbed = new EmbedBuilder()
                .setTitle('📄 نشر الأوراق البحثية والمجلات العلمية')
                .setDescription(`نقاط السمعة الأكاديمية الحالية: **${player.academicReputation || 0} pts**\n\nقدم مركباتك النادرة لمجلة المختبر العلمية لرفع سمعتك الأكاديمية!`)
                .setColor(0x2ecc71);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
            return await updateScreen(buildMoreMenu(user, player));
        }

        // Duels
        if (i.customId === 'btn_open_duels') {
            const duelEmbed = new EmbedBuilder()
                .setTitle('⚔️ تحدي الرموز الكيميائية (لاعب ضد لاعب)')
                .setDescription('تحدى صديقك في جولة كتابة الرموز الكيميائية! من يكتب الرمز الصحيح أولاً يربح رهان.')
                .setColor(0xe74c3c)
                .addFields(
                    { name: '💰 رصيدك الحالي', value: `\`${player.coins} <:emoji_40:1548935096768274532>\`` }
                );

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_start_duel_modal').setLabel('⚔️ إنشاء تحدي جديد').setStyle(ButtonStyle.Danger),
                backMoreBtnRow.components[0]
            );

            return await updateScreen({ embeds: [duelEmbed], components: [row] });
        }

        if (i.customId === 'btn_start_duel_modal') {
            const modal = new ModalBuilder()
                .setCustomId('modal_start_duel')
                .setTitle('⚔️ تحدي الرموز الكيميائية');

            const targetInput = new TextInputBuilder()
                .setCustomId('input_duel_target')
                .setLabel('ID الخصم أو المنشن')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 123456789012345678')
                .setRequired(true);

            const betInput = new TextInputBuilder()
                .setCustomId('input_duel_bet')
                .setLabel('مبلغ الرهان')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 50')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(betInput)
            );

            await i.showModal(modal);

            try {
                const submitted: ModalSubmitInteraction = await i.awaitModalSubmit({ 
                    time: 30000, 
                    filter: sub => sub.user.id === user.id 
                });
                
                const targetIdRaw = submitted.fields.getTextInputValue('input_duel_target').replace(/\D/g, '').trim();
                const betAmount = parseInt(submitted.fields.getTextInputValue('input_duel_bet'));

                if (!targetIdRaw) {
                    return await submitted.reply({ content: '❌ يرجى إدخال معرف (ID) صحيح للخصم!', flags: MessageFlags.Ephemeral });
                }

                if (isNaN(betAmount) || betAmount <= 0) {
                    return await submitted.reply({ content: '❌ يرجى كتابة مبلغ رهان صحيح!', flags: MessageFlags.Ephemeral });
                }

                if (player.coins < betAmount) {
                    return await submitted.reply({ content: `❌ رصيدك غير كافٍ! تملك \`${player.coins}\` فقط.`, flags: MessageFlags.Ephemeral });
                }

                if (targetIdRaw === user.id) {
                    return await submitted.reply({ content: '❌ لا يمكنك تحدي نفسك!', flags: MessageFlags.Ephemeral });
                }

                let opponent: PlayerData = getPlayerData(targetIdRaw);
                if (opponent.coins < betAmount) {
                    return await submitted.reply({ content: `❌ الخصم لا يملك رصيد كافي للرهان (${betAmount})!`, flags: MessageFlags.Ephemeral });
                }

                const validItems = Object.values(labData.items).filter((item: any) => item.symbol && item.symbol !== 'X' && item.symbol !== 'WASTE');
                const randomItem: any = validItems[Math.floor(Math.random() * validItems.length)];

                await submitted.reply({ 
                    content: `⚔️ **تحدي الرموز قائمة الآن!**\n<@${user.id}> 🆚 <@${targetIdRaw}>\n💰 **مبلغ الرهان:** \`${betAmount}\`\n\n🧪 **ما هو الرمز الكيميائي لـ:** **${randomItem.name}**؟\n_اكتبوا الرمز في الشات فورا! (أول شخص يكتبه صح يربح)_` 
                });

                const channel = i.channel;
                if (!channel || !('createMessageCollector' in channel)) return;

                const filter = (msg: Message) => (msg.author.id === user.id || msg.author.id === targetIdRaw) && msg.content.trim().toLowerCase() === randomItem.symbol.toLowerCase();
                const duelCollector = channel.createMessageCollector({ filter, time: 20000, max: 1 });

                duelCollector.on('collect', async (m: Message) => {
                    const winnerId = m.author.id;
                    const loserId = winnerId === user.id ? targetIdRaw : user.id;

                    let winnerPlayer: PlayerData = getPlayerData(winnerId);
                    let loserPlayer: PlayerData = getPlayerData(loserId);

                    winnerPlayer.coins += betAmount;
                    loserPlayer.coins -= betAmount;

                    updatePlayerData(winnerId, winnerPlayer);
                    updatePlayerData(loserId, loserPlayer);

                    await channel.send({ content: `🎉 **مبروك <@${winnerId}>!** كتبت الرمز الصحيح \`${randomItem.symbol}\` بسرعة وفزت بالتحدي وبمبلغ **+${betAmount}** <:emoji_40:1548935096768274532>!` });
                });

                duelCollector.on('end', collected => {
                    if (collected.size === 0) {
                        channel.send({ content: `⏳ **انتهى وقت التحدي ولم يجب أحد بنجاح! الرمز الصحيح كان:** \`${randomItem.symbol}\`` }).catch(() => {});
                    }
                });

            } catch (err) {
                return await notifyOnly('⏳ انتهت المهلة الزمنية للتحدي.');
            }
            return;
        }

        if (i.customId === 'btn_open_hazards') {
            const wasteQty = player.inv['toxic_waste'] || 0;
            const wasteEmbed = new EmbedBuilder()
                .setTitle('☣️ نظام السلامة وإدارة النفايات البيئية')
                .setDescription(`كمية النفايات الكيميائية في مستودعك: **${wasteQty} وحدة**`)
                .setColor(0x9b59b6);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_clean_waste').setLabel('🧹 تصريف النفايات (100V)').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ المعمل').setStyle(ButtonStyle.Danger)
            );

            return await updateScreen({ embeds: [wasteEmbed], components: [row] });
        }

        if (i.customId === 'btn_clean_waste') {
            if (player.coins < 100) return await notifyOnly('❌ لا تملك رصيد كافي!');
            player.coins -= 100;
            player.inv['toxic_waste'] = 0;
            updatePlayerData(user.id, player);
            await notifyOnly('✅ تم تنظيف المستودع وتصريف النفايات بنجاح!');
            return await updateScreen(buildLabHubScreen());
        }

        // Gifts
        if (i.customId === 'btn_open_gift') {
            const giftEmbed = new EmbedBuilder()
                .setTitle('🎁 نظام إهداء الأصدقاء')
                .setDescription('يمكنك تحويل الرصيد مباشرة لأي لاعب عبر معرف ديسكورد (ID) أو المنشن.')
                .setColor(0xf39c12)
                .addFields(
                    { name: '💰 رصيدك الحالي', value: `\`${player.coins} <:emoji_40:1548935096768274532>\`` }
                );

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_gift_coins_modal').setLabel('إهداء رصيد <:emoji_40:1548935096768274532>').setStyle(ButtonStyle.Success),
                backMoreBtnRow.components[0]
            );

            return await updateScreen({ embeds: [giftEmbed], components: [row] });
        }

        if (i.customId === 'btn_gift_coins_modal') {
            const modal = new ModalBuilder()
                .setCustomId('modal_gift_coins')
                .setTitle('🎁 إهداء رصيد لصديق');

            const targetInput = new TextInputBuilder()
                .setCustomId('input_target_user')
                .setLabel('ID العضو أو المنشن')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 123456789012345678')
                .setRequired(true);

            const amountInput = new TextInputBuilder()
                .setCustomId('input_gift_amount')
                .setLabel('المبلغ المراد إهداؤه')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 100')
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(targetInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput)
            );

            await i.showModal(modal);

            try {
                const submitted: ModalSubmitInteraction = await i.awaitModalSubmit({ 
                    time: 30000, 
                    filter: sub => sub.user.id === user.id 
                });
                
                const targetIdRaw = submitted.fields.getTextInputValue('input_target_user').replace(/\D/g, '').trim();
                const amount = parseInt(submitted.fields.getTextInputValue('input_gift_amount'));

                if (!targetIdRaw) {
                    return await submitted.reply({ content: '❌ يرجى إدخال معرف (ID) صحيح للصديق!', flags: MessageFlags.Ephemeral });
                }

                if (isNaN(amount) || amount <= 0) {
                    return await submitted.reply({ content: '❌ يرجى كتابة مبلغ صحيح أكبر من الصفر!', flags: MessageFlags.Ephemeral });
                }

                if (player.coins < amount) {
                    return await submitted.reply({ content: `❌ رصيدك غير كافٍ! تملك حالياً \`${player.coins}\` فقط.`, flags: MessageFlags.Ephemeral });
                }

                if (targetIdRaw === user.id) {
                    return await submitted.reply({ content: '❌ لا يمكنك إهداء نفسك!', flags: MessageFlags.Ephemeral });
                }

                let targetPlayer: PlayerData = getPlayerData(targetIdRaw);
                player.coins -= amount;
                targetPlayer.coins = (targetPlayer.coins || 0) + amount;

                updatePlayerData(user.id, player);
                updatePlayerData(targetIdRaw, targetPlayer);

                await submitted.reply({ content: `🎁 **تم إهداء ${amount} بنجاح إلى <@${targetIdRaw}>!**`, flags: MessageFlags.Ephemeral });
                return await responseMsg.edit(buildMainMenu(user, player)).catch(() => {});
            } catch (err) {
                return await notifyOnly('⏳ انتهت المهلة الزمنية لتنفيذ العملية.');
            }
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
            return await updateScreen(buildMainMenu(user, player));
        }

        // Level Nav
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

        if (i.customId === 'btn_jump_to_level') {
            const modal = new ModalBuilder()
                .setCustomId('modal_jump_level')
                .setTitle('🔢 الانتقال لمستوى سريع');

            const levelInput = new TextInputBuilder()
                .setCustomId('input_level_num')
                .setLabel('أدخل رقم التفاعل/المستوى (1 - 16)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('مثال: 5')
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(levelInput));
            await i.showModal(modal);

            try {
                const submitted: ModalSubmitInteraction = await i.awaitModalSubmit({ 
                    time: 30000, 
                    filter: sub => sub.user.id === user.id 
                });
                
                const targetNum = parseInt(submitted.fields.getTextInputValue('input_level_num'));

                if (isNaN(targetNum) || targetNum < 1 || targetNum > labData.reactions.length) {
                    return await submitted.reply({ content: `❌ رقم غير صحيح! أدخل رقم بين 1 و ${labData.reactions.length}`, flags: MessageFlags.Ephemeral });
                }

                lvlIndex = targetNum - 1;
                await submitted.deferUpdate();
                return await responseMsg.edit(buildLevelScreen(player, lvlIndex)).catch(() => {});
            } catch (err) {
                return await notifyOnly('⏳ انتهت المهلة الزمنية.');
            }
        }

        if (i.customId.startsWith('btn_unlock_reaction_')) {
            const rId = i.customId.replace('btn_unlock_reaction_', '');
            const reaction: LabReaction = labData.reactions.find((r: LabReaction) => r.id === rId);

            if (player.abilityPoints >= reaction.costAbility) {
                player.abilityPoints -= reaction.costAbility;
                player.unlockedReactions.push(reaction.id);
                updatePlayerData(user.id, player);
                await notifyOnly(`✅ **تم فتح (${reaction.name}) بنجاح!**`);
                return await updateScreen(buildLevelScreen(player, lvlIndex));
            } else {
                return await notifyOnly('❌ لا تملك نقاط قدرة كافية!');
            }
        }

        // Shop Nav
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
            return await updateScreen(buildShopScreen(player, shopIndex));
        }

        // Reaction & Calibration Nav
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
            selectedReaction = labData.reactions.find((r: LabReaction) => r.id === rId) || null;
            tempIndex = 0;
            pressIndex = 0;
            if (selectedReaction) {
                return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
            }
        }

        if (i.customId === 'btn_temp_down') {
            tempIndex--;
            if (selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_temp_up') {
            tempIndex++;
            if (selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_press_down') {
            pressIndex--;
            if (selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }
        if (i.customId === 'btn_press_up') {
            pressIndex++;
            if (selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }

        if (i.customId === 'btn_start_reaction') {
            if (!selectedReaction) return;
            const reaction = selectedReaction;

            for (const [mat, qty] of Object.entries(reaction.req)) {
                if (!player.inv[mat] || player.inv[mat] < qty) {
                    return await notifyOnly(`❌ لا تملك المواد الكافية! تحتاج إلى (${labData.items[mat]?.name \vert{}\vert{} mat} x${qty})`);
                }
            }

            const currentTemp = labData.TEMP_STEPS[tempIndex];
            const currentPress = labData.PRESS_STEPS[pressIndex];

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
                return await updateScreen(buildMainMenu(user, player));
            }

            player.achievements.cautious = (player.achievements.cautious || 0) + 1;
            if (player.achievements.cautious >= 10 && !player.unlockedBadges.includes('cautious')) {
                player.unlockedBadges.push('cautious');
                player.coins += labData.achievements.cautious.reward;
            }

            let duration = player.upgrades.speed ? Math.ceil(reaction.timeSec / 2) : reaction.timeSec;
            if (!player.pendingQueue) player.pendingQueue = [];
            
            player.pendingQueue.push({ 
                busyUntil: Math.floor(Date.now() / 1000) + duration, 
                yield: reaction.yield, 
                xp: reaction.xp 
            });
            updatePlayerData(user.id, player);

            setTimeout(() => {
                if (i.channel && 'send' in i.channel) {
                    (i.channel as TextChannel).send({ content: `🎉 <@${user.id}> **اكتمل التفاعل الكيميائي (${reaction.name})! افتح المختبر لاستلام نتائجك.**` }).catch(() => {});
                }
            }, duration * 1000);

            await notifyOnly(`🚀 **بدأ تفاعل (${reaction.name})! سينتهي بعد ${duration} ثانية.**`);
            return await updateScreen(buildMainMenu(user, player));
        }

        // Quests & Sales
        if (i.customId === 'btn_open_quest') {
            const q = player.quest;
            const itemNeeded = labData.items[q.item];

            const questEmbed = new EmbedBuilder()
                .setTitle('📜 المهام اليومية المتجددة')
                .addFields(
                    { name: '🎯 المطلوب', value: `إنتاج **${q.count}x${itemNeeded?.name || q.item}**`, inline: true },
                    { name: '📊 التقدم الحالي', value: `\`${q.progress} / ${q.count}\``, inline: true },
                    { name: '🎁 المكافأة', value: `\`+${q.rewardCoins}\` | \`+${q.rewardXp} XP\``, inline: true }
                )
                .setColor(0xe67e22);

            const claimBtn = new ButtonBuilder()
                .setCustomId('btn_claim_quest')
                .setLabel('تسليم المهمة')
                .setStyle(ButtonStyle.Success)
                .setDisabled(q.completed || q.progress < q.count);

            const questRow = new ActionRowBuilder<ButtonBuilder>().addComponents(claimBtn, backMoreBtnRow.components[0]);
            return await updateScreen({ embeds: [questEmbed], components: [questRow] });
        }

        if (i.customId === 'btn_claim_quest') {
            if (player.quest.progress >= player.quest.count && !player.quest.completed) {
                player.coins += player.quest.rewardCoins;
                player.xp += player.quest.rewardXp;
                player.quest.completed = true;
                updatePlayerData(user.id, player);
                await notifyOnly('🎉 **تم تسليم المهمة بنجاح واستلام المكافأة!**');
                return await updateScreen(buildMainMenu(user, player));
            }
        }

        if (i.customId === 'btn_sell_all') {
            let totalEarned = 0;
            let soldList: string[] = [];

            Object.keys(player.inv).forEach(id => {
                const itemInfo = labData.items[id];
                if (itemInfo && !itemInfo.buyable && player.inv[id] > 0 && itemInfo.price > 0) {
                    const qty = player.inv[id];
                    const price = itemInfo.price;
                    totalEarned += price * qty;
                    soldList.push(`• **${itemInfo.name}**: \`${qty}\` x \`${price}\``);
                    delete player.inv[id];
                }
            });

            if (totalEarned > 0) {
                player.coins += totalEarned;
                updatePlayerData(user.id, player);
                await notifyOnly(`💵 **تم بيع النواتج الكيميائية بنجاح!**\nالربح الإجمالي: \`+${totalEarned}\` <:emoji_40:1548935096768274532>\n\n${soldList.join('\n')}`);
            } else {
                await notifyOnly('❌ لا تملك أي نواتج قابلة للبيع في مستودعك حالياً!');
            }
            return await updateScreen(buildMainMenu(user, player));
        }
    });

    collector.on('end', () => {
        responseMsg.edit({ components: [] }).catch(() => {});
    });
}

// ==========================================
// 4. Command Exports
// ==========================================

export const data = new SlashCommandBuilder()
    .setName('lab')
    .setDescription('فتح المختبر الكيميائي التفاعلي');

export async function execute(interaction: CommandInteraction): Promise<void> {
    await handleLabSession(interaction, interaction.user);
}

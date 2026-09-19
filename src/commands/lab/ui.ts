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

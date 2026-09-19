import { 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags,
    User,
    CommandInteraction,
    MessageComponentInteraction,
    TextChannel,
    Message,
    EmbedBuilder
} from 'discord.js';

import labData from './data';
import { 
    processItemStabilityAndDecay, 
    getPlayerData, 
    updatePlayerData,
    PlayerData 
} from './helpers';

import {
    buildMainMenu,
    buildLabHubScreen,
    buildMoreMenu,
    buildShopScreen,
    buildLevelScreen,
    buildReactionsScreen,
    buildCalibScreen,
    buildCodexScreen,
    LabReaction,
    MenuResponse
} from './ui';

// 1. تعريف واجهات الأنواع لضمان التوافق التام
export interface QueueItem {
    id?: string;
    finishTime?: number;
    busyUntil?: number;
    yield?: Record<string, number>;
    xp?: number;
    [key: string]: any;
}

export interface PendingTask {
    id?: string;
    finishTime?: number;
    busyUntil: number;
    yield: Record<string, number>;
    xp: number;
}

type CommandContext = CommandInteraction | {
    replied?: boolean;
    deferred?: boolean;
    isCommand?: () => boolean;
    channel?: TextChannel | null;
    reply: (options: any) => Promise<Message>;
    followUp: (options: any) => Promise<Message>;
};

export async function handleLabSession(context: CommandContext, user: User): Promise<void> {
    let player: PlayerData = getPlayerData(user.id);

    // ضمان وجود جميع الحقول الفرعية
    if (!player.inv) player.inv = {};
    if (!player.codex) player.codex = [];
    if (!player.unlockedReactions) player.unlockedReactions = [];
    if (!player.ownedEquipment) player.ownedEquipment = {};
    if (!player.upgrades) player.upgrades = {};

    processItemStabilityAndDecay(player);
    const currentNow = Math.floor(Date.now() / 1000);

    // معالجة قائمة التفاعلات الجارية مع إجراء التحويل الآمن للأنواع (Type Casting عبر unknown)
    if (player.pendingQueue && player.pendingQueue.length > 0) {
        const rawQueue = player.pendingQueue as unknown as QueueItem[];
        const updatedQueue: QueueItem[] = [];

        for (const item of rawQueue) {
            const busyUntil = item.busyUntil ?? item.finishTime ?? 0;

            if (currentNow >= busyUntil) {
                if (item.yield) {
                    for (const [itemId, qty] of Object.entries(item.yield)) {
                        player.inv[itemId] = (player.inv[itemId] || 0) + (qty as number);
                        if (!player.codex.includes(itemId)) player.codex.push(itemId);
                    }
                }
                player.xp = (player.xp || 0) + (item.xp || 0);
                player.abilityPoints = (player.abilityPoints || 0) + 1;
            } else {
                updatedQueue.push(item);
            }
        }

        // إعادة الإسناد بأمان
        player.pendingQueue = updatedQueue as unknown as typeof player.pendingQueue;
        updatePlayerData(user.id, player);
    }

    const initialMenu = buildMainMenu(user, player);
    let responseMsg: Message;

    if (context.replied || context.deferred) {
        responseMsg = await context.followUp({ ...initialMenu, fetchReply: true });
    } else {
        responseMsg = await context.reply({ ...initialMenu, fetchReply: true });
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

        const updateScreen = async (data: MenuResponse) => {
            if (!i.replied && !i.deferred) {
                await i.update(data).catch(() => {});
            } else {
                await responseMsg.edit(data).catch(() => {});
            }
        };

        // 🔘 التنقل الأساسي
        if (i.customId === 'btn_back_main') return await updateScreen(buildMainMenu(user, player));
        if (i.customId === 'btn_open_more_menu') return await updateScreen(buildMoreMenu(user, player));
        if (i.customId === 'btn_open_lab_hub') return await updateScreen(buildLabHubScreen());

        // 🎒 المستودع والموسوعة
        if (i.customId === 'btn_open_inv') {
            const invList = Object.keys(player.inv).length > 0 
                ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: \`${qty}\``).join('\n')
                : '_المستودع فارغ حالياً_';

            const invEmbed = new EmbedBuilder().setTitle(`🎒 مستودع المواد - ${user.username}`).setDescription(invList).setColor(0x3498db);
            const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder().setCustomId('btn_open_lab_hub').setLabel('↩️ المعمل').setStyle(ButtonStyle.Danger)
            );

            return await updateScreen({ embeds: [invEmbed], components: [backRow] });
        }

        if (i.customId === 'btn_open_codex') {
            codexPage = 0;
            return await updateScreen(buildCodexScreen(player, codexPage));
        }
        if (i.customId === 'btn_codex_prev') return await updateScreen(buildCodexScreen(player, --codexPage));
        if (i.customId === 'btn_codex_next') return await updateScreen(buildCodexScreen(player, ++codexPage));

        // 🛒 المتجر
        if (i.customId === 'btn_open_shop') return await updateScreen(buildShopScreen(player, (shopIndex = 0)));
        if (i.customId === 'btn_shop_prev') return await updateScreen(buildShopScreen(player, --shopIndex));
        if (i.customId === 'btn_shop_next') return await updateScreen(buildShopScreen(player, ++shopIndex));

        // 📜 المستويات والتفاعلات
        if (i.customId === 'btn_open_levels') return await updateScreen(buildLevelScreen(player, (lvlIndex = 0)));
        if (i.customId === 'btn_lvl_prev') return await updateScreen(buildLevelScreen(player, --lvlIndex));
        if (i.customId === 'btn_lvl_next') return await updateScreen(buildLevelScreen(player, ++lvlIndex));

        if (i.customId === 'btn_open_reactions') return await updateScreen(buildReactionsScreen(player, (reactIndex = 0)));
        if (i.customId === 'btn_react_prev') return await updateScreen(buildReactionsScreen(player, --reactIndex));
        if (i.customId === 'btn_react_next') return await updateScreen(buildReactionsScreen(player, ++reactIndex));

        // 🎛️ المعايرة
        if (i.customId.startsWith('btn_select_calib_')) {
            const rId = i.customId.replace('btn_select_calib_', '');
            selectedReaction = labData.reactions.find((r: LabReaction) => r.id === rId) || null;
            tempIndex = 0; pressIndex = 0;
            if (selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, pressIndex));
        }

        if (i.customId === 'btn_temp_down' && selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, Math.max(0, --tempIndex), pressIndex));
        if (i.customId === 'btn_temp_up' && selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, Math.min(labData.TEMP_STEPS.length - 1, ++tempIndex), pressIndex));
        if (i.customId === 'btn_press_down' && selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, Math.max(0, --pressIndex)));
        if (i.customId === 'btn_press_up' && selectedReaction) return await updateScreen(buildCalibScreen(selectedReaction, tempIndex, Math.min(labData.PRESS_STEPS.length - 1, ++pressIndex)));
    });

    collector.on('end', () => {
        responseMsg.edit({ components: [] }).catch(() => {});
    });
}

export const data = new SlashCommandBuilder()
    .setName('lab')
    .setDescription('فتح المختبر الكيميائي التفاعلي');

export async function execute(interaction: CommandInteraction): Promise<void> {
    await handleLabSession(interaction, interaction.user);
}

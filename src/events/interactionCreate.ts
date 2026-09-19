import { 
    Interaction, 
    Client, 
    MessageFlags, 
    ChatInputCommandInteraction,
    AnySelectMenuInteraction,
    InteractionReplyOptions
} from 'discord.js';

// ==========================================
// 1. Interfaces & Types Definition
// ==========================================

export interface ExecutableCommand {
    execute?: (interaction: ChatInputCommandInteraction) => Promise<any>;
    handleColorSelect?: (interaction: AnySelectMenuInteraction) => Promise<any>;
    handleInteraction?: (interaction: Interaction) => Promise<any>;
    handleGamesCommand?: (interaction: Interaction) => Promise<any>;
    data?: { name: string };
    default?: ExecutableCommand;
}

export interface ProfileSystemModule {
    profileCommand?: ExecutableCommand;
    shopCommand?: ExecutableCommand;
    handleProfileEvents?: (interaction: Interaction) => Promise<boolean>;
    default?: ProfileSystemModule;
}

// دالة مساعدة لتفكيك الموديولات المستوردة عبر require بأمان
function resolveModule<T>(mod: any): T | undefined {
    if (!mod) return undefined;
    return mod.default ? mod.default : mod;
}

// ==========================================
// 2. Safe Dynamic Imports
// ==========================================

let colorsCmd: ExecutableCommand | undefined;
let clearCmd: ExecutableCommand | undefined;
let moderationCmds: ExecutableCommand[] | undefined;
let labCommand: ExecutableCommand | undefined;
let serversCmd: ExecutableCommand | undefined;
let getInviteCmd: ExecutableCommand | undefined;

let profileCommand: ExecutableCommand | undefined;
let shopCommand: ExecutableCommand | undefined;
let handleProfileEvents: ((interaction: Interaction) => Promise<boolean>) | undefined;

let gamesCmd: ExecutableCommand | undefined;
let handleGamesCommand: ((interaction: Interaction) => Promise<any>) | undefined;
let afkSystem: ExecutableCommand | undefined;
let handlePrivateChatInteraction: ((interaction: Interaction) => Promise<any>) | undefined;

try { colorsCmd = resolveModule<ExecutableCommand>(require('../commands/colors')); } catch (e: any) { console.error('⚠️ تعذر تحميل الألوان:', e.message); }
try { clearCmd = resolveModule<ExecutableCommand>(require('../commands/clear')); } catch (e: any) { console.error('⚠️ تعذر تحميل أداة المسح:', e.message); }
try { 
    const mod = require('../commands/moderation');
    moderationCmds = Array.isArray(mod) ? mod : resolveModule<ExecutableCommand[]>(mod); 
} catch (e: any) { console.error('⚠️ تعذر تحميل الإدارة:', e.message); }
try { labCommand = resolveModule<ExecutableCommand>(require('../commands/lab')); } catch (e: any) { console.error('⚠️ تعذر تحميل المختبر:', e.message); }
try { serversCmd = resolveModule<ExecutableCommand>(require('../commands/servers')); } catch (e: any) { console.error('⚠️ تعذر تحميل السيرفرات:', e.message); }
try { getInviteCmd = resolveModule<ExecutableCommand>(require('../commands/get-invite')); } catch (e: any) { console.error('⚠️ تعذر تحميل أمر الدعوة:', e.message); }

try {
    const rawProfile = require('../commands/profileSystem');
    const profileModule: ProfileSystemModule = resolveModule<ProfileSystemModule>(rawProfile) || rawProfile;
    profileCommand = profileModule?.profileCommand;
    shopCommand = profileModule?.shopCommand;
    handleProfileEvents = profileModule?.handleProfileEvents;
} catch (e: any) { console.error('⚠️ تعذر تحميل البروفايل والمتجر:', e.message); }

try {
    gamesCmd = resolveModule<ExecutableCommand>(require('../commands/games'));
    handleGamesCommand = gamesCmd?.handleGamesCommand || gamesCmd?.execute || (gamesCmd as any);
} catch (e: any) { console.error('⚠️ تعذر تحميل الألعاب:', e.message); }

try { afkSystem = resolveModule<ExecutableCommand>(require('../commands/afkSystem')); } catch (e: any) { console.error('⚠️ تعذر تحميل نظام AFK:', e.message); }
try { 
    const pcModule = resolveModule<any>(require('../commands/privateChat'));
    handlePrivateChatInteraction = pcModule?.handlePrivateChatInteraction; 
} catch (e: any) { console.error('⚠️ تعذر تحميل الدردشات الخاصة:', e.message); }

// ==========================================
// 3. Main Handler Function
// ==========================================

export default async function handleInteractionCreate(client: Client, interaction: Interaction): Promise<void> {
    try {
        let customId = '';
        if (
            interaction.isButton() || 
            interaction.isAnySelectMenu() || 
            interaction.isModalSubmit()
        ) {
            customId = interaction.customId;
        }

        // 🔘 1. معالجة تفاعلات الـ AFK
        if ((interaction.isButton() || interaction.isModalSubmit()) && afkSystem?.handleInteraction) {
            if (customId.startsWith('afk_')) {
                return await afkSystem.handleInteraction(interaction);
            }
        }

        // 🔘 2. معالجة تفاعلات الدردشات الخاصة
        if (
            typeof handlePrivateChatInteraction === 'function' &&
            (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit())
        ) {
            if (
                customId.startsWith('pc_') ||
                customId.startsWith('room_') ||
                customId.startsWith('invite_') ||
                customId.startsWith('knock_')
            ) {
                return await handlePrivateChatInteraction(interaction);
            }
        }

        // 🔘 3. معالجة تفاعلات المختبر الكيميائي
        if (
            (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) &&
            (customId.startsWith('btn_') || customId.startsWith('modal_') || customId.startsWith('lab_')) &&
            labCommand?.handleInteraction
        ) {
            return await labCommand.handleInteraction(interaction);
        }

        // 🔘 4. معالجة أحداث البروفايل والمتجر
        if (typeof handleProfileEvents === 'function') {
            const handled = await handleProfileEvents(interaction);
            if (handled) return;
        }

        // 🔘 5. معالجة تفاعلات الألوان والألعاب
        if (interaction.isAnySelectMenu() || interaction.isButton()) {
            if (customId.startsWith('game_') || customId.startsWith('games_') || customId === 'select_game' || gamesCmd?.handleInteraction) {
                if (typeof gamesCmd?.handleInteraction === 'function') {
                    return await gamesCmd.handleInteraction(interaction);
                } else if (typeof handleGamesCommand === 'function') {
                    return await handleGamesCommand(interaction);
                }
            }

            if (interaction.isStringSelectMenu() && customId === 'select_name_color' && colorsCmd?.handleColorSelect) {
                return await colorsCmd.handleColorSelect(interaction);
            }
        }

        // 💬 6. معالجة أوامر السلاش (Slash Commands)
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'servers' && serversCmd?.execute) return await serversCmd.execute(interaction);
        if (commandName === 'get-invite' && getInviteCmd?.execute) return await getInviteCmd.execute(interaction);
        if (commandName === 'colors' && colorsCmd?.execute) return await colorsCmd.execute(interaction);
        if (commandName === 'clear' && clearCmd?.execute) return await clearCmd.execute(interaction);
        if (commandName === 'profile' && profileCommand?.execute) return await profileCommand.execute(interaction);
        if (commandName === 'shop' && shopCommand?.execute) return await shopCommand.execute(interaction);
        if (commandName === 'lab' && labCommand?.execute) return await labCommand.execute(interaction);

        if (commandName === 'games') {
            if (gamesCmd?.execute) {
                return await gamesCmd.execute(interaction);
            } else if (typeof handleGamesCommand === 'function') {
                return await handleGamesCommand(interaction);
            }
        }

        if (Array.isArray(moderationCmds)) {
            const modCommand = moderationCmds.find(c => c.data?.name === commandName);
            if (modCommand?.execute) return await modCommand.execute(interaction);
        }

    } catch (error) {
        console.error(`❌ خطأ أثناء تنفيذ الإنتراكشن:`, error);

        // تم تعيين InteractionReplyOptions لتفادي أخطاء النوع في Render
        const errorMessage: InteractionReplyOptions = {
            content: '❌ حدث خطأ غير متوقع أثناء تنفيذ هذا الطلب!',
            flags: MessageFlags.Ephemeral
        };

        if (interaction.isRepliable()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(() => {});
            } else {
                await interaction.reply(errorMessage).catch(() => {});
            }
        }
    }
}

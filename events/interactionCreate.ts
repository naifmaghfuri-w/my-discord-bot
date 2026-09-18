import { Interaction, MessageFlags, Client } from 'discord.js';

// تعريف الواجهات البرمجية للموديولات
interface ExecutableCommand {
    execute?: (interaction: Interaction | any) => Promise<any>;
    handleColorSelect?: (interaction: Interaction | any) => Promise<any>;
    handleInteraction?: (interaction: Interaction | any) => Promise<any>;
    data?: { name: string };
}

interface ProfileSystemModule {
    profileCommand?: ExecutableCommand;
    shopCommand?: ExecutableCommand;
    handleProfileEvents?: (interaction: Interaction) => Promise<boolean>;
}

// استدعاء الموديولات بحماية لتجنب توقف البوت عند فقدان أحد الملفات
let colorsCmd: ExecutableCommand | undefined;
let clearCmd: ExecutableCommand | undefined;
let moderationCmds: ExecutableCommand[] | undefined;
let labCommand: ExecutableCommand | undefined;
let serversCmd: ExecutableCommand | undefined;
let getInviteCmd: ExecutableCommand | undefined;

let profileCommand: ExecutableCommand | undefined;
let shopCommand: ExecutableCommand | undefined;
let handleProfileEvents: ((interaction: Interaction) => Promise<boolean>) | undefined;

let gamesCmd: any;
let handleGamesCommand: ((interaction: Interaction) => Promise<any>) | undefined;
let afkSystem: any;
let handlePrivateChatInteraction: ((interaction: Interaction) => Promise<any>) | undefined;

try { colorsCmd = require('../commands/colors'); } catch (e: any) { console.error('⚠️ تعذر تحميل الألوان:', e.message); }
try { clearCmd = require('../commands/clear'); } catch (e: any) { console.error('⚠️ تعذر تحميل أداة المسح:', e.message); }
try { moderationCmds = require('../commands/moderation'); } catch (e: any) { console.error('⚠️ تعذر تحميل الإدارة:', e.message); }
try { labCommand = require('../commands/lab'); } catch (e: any) { console.error('⚠️ تعذر تحميل المختبر:', e.message); }
try { serversCmd = require('../commands/servers'); } catch (e: any) { console.error('⚠️ تعذر تحميل السيرفرات:', e.message); }
try { getInviteCmd = require('../commands/get-invite'); } catch (e: any) { console.error('⚠️ تعذر تحميل أمر الدعوة:', e.message); }

try {
    const profileModule: ProfileSystemModule = require('../commands/profileSystem');
    profileCommand = profileModule.profileCommand;
    shopCommand = profileModule.shopCommand;
    handleProfileEvents = profileModule.handleProfileEvents;
} catch (e: any) { console.error('⚠️ تعذر تحميل البروفايل والمتجر:', e.message); }

try {
    gamesCmd = require('../commands/games');
    handleGamesCommand = gamesCmd?.handleGamesCommand || gamesCmd?.execute || gamesCmd;
} catch (e: any) { console.error('⚠️ تعذر تحميل الألعاب:', e.message); }

try { afkSystem = require('../commands/afkSystem'); } catch (e: any) { console.error('⚠️ تعذر تحميل نظام AFK:', e.message); }
try { handlePrivateChatInteraction = require('../commands/privateChat')?.handlePrivateChatInteraction; } catch (e: any) { console.error('⚠️ تعذر تحميل الدردشات الخاصة:', e.message); }

export default async function handleInteractionCreate(client: Client, interaction: Interaction): Promise<void> {
    try {
        // ==========================================
        // 🔘 1. معالجة تفاعلات الـ AFK
        // ==========================================
        if ((interaction.isButton() || interaction.isModalSubmit()) && afkSystem?.handleInteraction) {
            if (interaction.customId?.startsWith('afk_')) {
                return await afkSystem.handleInteraction(interaction);
            }
        }

        // ==========================================
        // 🔘 2. معالجة تفاعلات الدردشات الخاصة
        // ==========================================
        if (
            typeof handlePrivateChatInteraction === 'function' &&
            (interaction.isButton() ||
             interaction.isStringSelectMenu() ||
             interaction.isUserSelectMenu() ||
             interaction.isModalSubmit())
        ) {
            const id = interaction.customId || '';
            if (
                id.startsWith('pc_') ||
                id.startsWith('room_') ||
                id.startsWith('invite_') ||
                id.startsWith('knock_')
            ) {
                return await handlePrivateChatInteraction(interaction);
            }
        }

        // ==========================================
        // 🔘 3. معالجة أحداث البروفايل والمتجر (أزرار وقوائم)
        // ==========================================
        if (typeof handleProfileEvents === 'function') {
            const handled = await handleProfileEvents(interaction);
            if (handled) return;
        }

        // ==========================================
        // 🔘 4. معالجة تفاعلات الألوان والألعاب
        // ==========================================
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            const id = interaction.customId || '';

            // نظام الألعاب
            if (id.startsWith('game_') || id.startsWith('games_') || id === 'select_game' || gamesCmd?.handleInteraction) {
                if (typeof gamesCmd?.handleInteraction === 'function') {
                    return await gamesCmd.handleInteraction(interaction);
                } else if (typeof handleGamesCommand === 'function') {
                    return await handleGamesCommand(interaction);
                }
            }

            // نظام قائمة الألوان
            if (interaction.isStringSelectMenu() && id === 'select_name_color' && colorsCmd?.handleColorSelect) {
                return await colorsCmd.handleColorSelect(interaction);
            }
        }

        // ==========================================
        // 💬 5. معالجة أوامر السلاش (Slash Commands)
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'servers' && serversCmd?.execute) return await serversCmd.execute(interaction);
        if (commandName === 'get-invite' && getInviteCmd?.execute) return await getInviteCmd.execute(interaction);
        if (commandName === 'colors' && colorsCmd?.execute) return await colorsCmd.execute(interaction);
        if (commandName === 'clear' && clearCmd?.execute) return await clearCmd.execute(interaction);
        if (commandName === 'profile' && profileCommand?.execute) return await profileCommand.execute(interaction);
        if (commandName === 'shop' && shopCommand?.execute) return await shopCommand.execute(interaction);
        if (commandName === 'lab' && labCommand?.execute) return await labCommand.execute(interaction);

        // أمر الألعاب السلاش
        if (commandName === 'games') {
            if (gamesCmd?.execute) {
                return await gamesCmd.execute(interaction);
            } else if (typeof handleGamesCommand === 'function') {
                return await handleGamesCommand(interaction);
            }
        }

        // أوامر الإدارة (Array)
        if (Array.isArray(moderationCmds)) {
            const modCommand = moderationCmds.find(c => c.data?.name === commandName);
            if (modCommand?.execute) return await modCommand.execute(interaction);
        }

    } catch (error) {
        console.error(`❌ خطأ أثناء تنفيذ الإنتراكشن:`, error);

        const errorMessage = {
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

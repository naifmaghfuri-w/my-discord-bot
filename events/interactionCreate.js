let colorsCmd, clearCmd, moderationCmds, labCommand, serversCmd, getInviteCmd;
let profileCommand, shopCommand, handleProfileEvents;
let gamesCmd, handleGamesCommand, afkSystem, handlePrivateChatInteraction;

// استدعاء الموديولات بحماية لتجنب توقف البوت عند فقدان أحد الملفات
try { colorsCmd = require('../commands/colors'); } catch (e) { console.error('⚠️ تعذر تحميل الألوان:', e.message); }
try { clearCmd = require('../commands/clear'); } catch (e) { console.error('⚠️ تعذر تحميل أداة المسح:', e.message); }
try { moderationCmds = require('../commands/moderation'); } catch (e) { console.error('⚠️ تعذر تحميل الإدارة:', e.message); }
try { labCommand = require('../commands/lab'); } catch (e) { console.error('⚠️ تعذر تحميل المختبر:', e.message); }
try { serversCmd = require('../commands/servers'); } catch (e) { console.error('⚠️ تعذر تحميل السيرفرات:', e.message); }
try { getInviteCmd = require('../commands/get-invite'); } catch (e) { console.error('⚠️ تعذر تحميل أمر الدعوة:', e.message); }

try { ({ profileCommand, shopCommand, handleProfileEvents } = require('../commands/profileSystem')); } catch (e) { console.error('⚠️ تعذر تحميل البروفايل والمتجر:', e.message); }
try { 
    gamesCmd = require('../commands/games'); 
    handleGamesCommand = gamesCmd.handleGamesCommand || gamesCmd.execute || gamesCmd;
} catch (e) { console.error('⚠️ تعذر تحميل الألعاب:', e.message); }

try { afkSystem = require('../commands/afkSystem'); } catch (e) { console.error('⚠️ تعذر تحميل نظام AFK:', e.message); }
try { ({ handlePrivateChatInteraction } = require('../commands/privateChat')); } catch (e) { console.error('⚠️ تعذر تحميل الدردشات الخاصة:', e.message); }

module.exports = async (client, interaction) => {
    try {
        // ==========================================
        // 🔘 1. معالجة تفاعلات الـ AFK
        // ==========================================
        if ((interaction.isButton() || interaction.isModalSubmit()) && afkSystem?.handleInteraction) {
            if (interaction.customId && interaction.customId.startsWith('afk_')) {
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
            const id = interaction.customId;
            if (
                id && (
                    id.startsWith('pc_') || 
                    id.startsWith('room_') || 
                    id.startsWith('invite_') || 
                    id.startsWith('knock_')
                )
            ) {
                return await handlePrivateChatInteraction(interaction);
            }
        }

        // ==========================================
        // 🔘 3. معالجة تفاعلات الألعاب (القوائم والأزرار)
        // ==========================================
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            const id = interaction.customId || '';

            // إذا كان التفاعل تابعاً لنظام الألعاب
            if (id.startsWith('game_') || id.startsWith('games_') || id === 'select_game' || gamesCmd?.handleInteraction) {
                if (typeof gamesCmd?.handleInteraction === 'function') {
                    return await gamesCmd.handleInteraction(interaction);
                } else if (typeof handleGamesCommand === 'function') {
                    return await handleGamesCommand(interaction);
                }
            }

            // معالجة القوائم المنسدلة للبروفايل والألوان
            if (interaction.isStringSelectMenu()) {
                if (typeof handleProfileEvents === 'function') {
                    const handled = await handleProfileEvents(interaction);
                    if (handled) return;
                }

                if (id === 'select_name_color' && colorsCmd?.handleColorSelect) {
                    return await colorsCmd.handleColorSelect(interaction);
                }
            }
        }

        // ==========================================
        // 💬 4. معالجة أوامر السلاش (Slash Commands)
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

        if (Array.isArray(moderationCmds)) {
            const modCommand = moderationCmds.find(c => c.data?.name === commandName);
            if (modCommand?.execute) return await modCommand.execute(interaction);
        }
    } catch (error) {
        console.error(`❌ خطأ أثناء تنفيذ الإنتراكشن:`, error);
        
        const errorMessage = { content: '❌ حدث خطأ غير متوقع أثناء تنفيذ هذا الطلب!', flags: 64 };
        
        if (interaction.isRepliable()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(() => {});
            } else {
                await interaction.reply(errorMessage).catch(() => {});
            }
        }
    }
};

const colorsCmd = require('../commands/colors');
const clearCmd = require('../commands/clear');
const moderationCmds = require('../commands/moderation');
const labCommand = require('../commands/lab');
const serversCmd = require('../commands/servers');
const getInviteCmd = require('../commands/get-invite');

// تعديل المسارات لتأشير على مجلد commands مباشرة
const { profileCommand, shopCommand, handleProfileEvents } = require('../commands/profileSystem');
const { handleGamesCommand } = require('../commands/games');
const afkSystem = require('../commands/afkSystem');
const { handlePrivateChatInteraction } = require('../commands/privateChat');

module.exports = async (client, interaction) => {
    try {
        // ==========================================
        // 🔘 معالجة تفاعلات الـ AFK
        // ==========================================
        if (interaction.isButton() || interaction.isModalSubmit()) {
            if (interaction.customId && interaction.customId.startsWith('afk_')) {
                return await afkSystem.handleInteraction(interaction);
            }
        }

        // ==========================================
        // 🔘 معالجة تفاعلات الدردشات الخاصة
        // ==========================================
        if (
            interaction.isButton() || 
            interaction.isStringSelectMenu() || 
            interaction.isUserSelectMenu() || 
            interaction.isModalSubmit()
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
        // 🔘 معالجة القوائم المنسدلة والأزرار الأخرى
        // ==========================================
        if (interaction.isStringSelectMenu() || interaction.isButton()) {
            if (interaction.isStringSelectMenu()) {
                const handled = await handleProfileEvents(interaction);
                if (handled) return;

                if (interaction.customId === 'select_name_color') {
                    return colorsCmd.handleColorSelect(interaction);
                }
            }
        }

        // ==========================================
        // 💬 معالجة أوامر السلاش (Slash Commands)
        // ==========================================
        if (!interaction.isChatInputCommand()) return;

        const { commandName } = interaction;

        if (commandName === 'servers') return await serversCmd.execute(interaction);
        if (commandName === 'get-invite') return await getInviteCmd.execute(interaction);
        if (commandName === 'colors') return await colorsCmd.execute(interaction);
        if (commandName === 'clear') return await clearCmd.execute(interaction);
        if (commandName === 'profile') return await profileCommand.execute(interaction);
        if (commandName === 'shop') return await shopCommand.execute(interaction);
        if (commandName === 'lab') return await labCommand.execute(interaction);
        if (commandName === 'games') return await handleGamesCommand(interaction);

        if (Array.isArray(moderationCmds)) {
            const modCommand = moderationCmds.find(c => c.data?.name === commandName);
            if (modCommand) return await modCommand.execute(interaction);
        }
    } catch (error) {
        console.error(`❌ خطأ أثناء تنفيذ الإنتراكشن:`, error);
        
        const errorMessage = { content: '❌ حدث خطأ غير متوقع أثناء تنفيذ هذا الطلب!', ephemeral: true };
        
        if (interaction.isRepliable()) {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(() => {});
            } else {
                await interaction.reply(errorMessage).catch(() => {});
            }
        }
    }
};

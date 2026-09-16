const colorsCmd = require('../commands/colors');
const clearCmd = require('../commands/clear');
const moderationCmds = require('../commands/moderation');
const labCommand = require('../commands/lab');
const serversCmd = require('../commands/servers');
const getInviteCmd = require('../commands/get-invite');
const { profileCommand, shopCommand, handleProfileEvents } = require('../profileSystem');
const { handleGamesCommand } = require('../games');
const afkSystem = require('../afkSystem'); // 👈 استدعاء نظام AFK

module.exports = async (client, interaction) => {
    // ==========================================
    // 🔘 معالجة تفاعلات الـ AFK (أزرار و Modal)
    // ==========================================
    if (interaction.isButton() || interaction.isModalSubmit()) {
        if (interaction.customId.startsWith('afk_')) {
            return await afkSystem.handleInteraction(interaction);
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

    try {
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
        console.error(`❌ خطأ أثناء تنفيذ الأمر ${commandName}:`, error);
        
        const errorMessage = { content: '❌ حدث خطأ أثناء تنفيذ هذا الأمر!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
};

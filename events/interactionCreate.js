const colorsCmd = require('../commands/colors');
const clearCmd = require('../commands/clear');
const moderationCmds = require('../commands/moderation');
const labCommand = require('../commands/lab');
const { profileCommand, shopCommand, handleProfileEvents } = require('../profileSystem');
const { handleGamesCommand } = require('../games');

module.exports = async (client, interaction) => {
    // ==========================================
    // 🔘 معالجة القوائم المنسدلة والأزرار (Components)
    // ==========================================
    if (interaction.isStringSelectMenu() || interaction.isButton()) {
        // تجربة معالجة أحداث نظام البروفايل أولاً
        if (interaction.isStringSelectMenu()) {
            const handled = await handleProfileEvents(interaction);
            if (handled) return;

            if (interaction.customId === 'select_name_color') {
                return colorsCmd.handleColorSelect(interaction);
            }
        }

        // ملاحظة: تفاعلات أمر /lab يتم معالجتها تلقائياً داخل Collector الملف نفسه
        // لذلك لا نحتاج لتوجيه أزرار وقوائم المعمل هنا طالما أن الـ Collector يعالجها.
    }

    // ==========================================
    // 💬 معالجة أوامر السلاش (Slash Commands)
    // ==========================================
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    try {
        if (commandName === 'colors') return await colorsCmd.execute(interaction);
        if (commandName === 'clear') return await clearCmd.execute(interaction);
        if (commandName === 'profile') return await profileCommand.execute(interaction);
        if (commandName === 'shop') return await shopCommand.execute(interaction);
        if (commandName === 'lab') return await labCommand.execute(interaction);
        if (commandName === 'games') return await handleGamesCommand(interaction);

        // معالجة أوامر الإدارة (Moderation)
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

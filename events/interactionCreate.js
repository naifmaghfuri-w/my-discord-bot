const colorsCmd = require('../commands/colors');
const clearCmd = require('../commands/clear');
const moderationCmds = require('../commands/moderation');
const labCommand = require('../lab');
const { profileCommand, shopCommand, handleProfileEvents } = require('../profileSystem');
const { handleGamesCommand } = require('../games');

module.exports = async (client, interaction) => {
    if (interaction.isStringSelectMenu()) {
        const handled = await handleProfileEvents(interaction);
        if (handled) return;

        if (interaction.customId === 'select_name_color') {
            return colorsCmd.handleColorSelect(interaction);
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'colors') return colorsCmd.execute(interaction);
    if (commandName === 'clear') return clearCmd.execute(interaction);
    if (commandName === 'profile') return profileCommand.execute(interaction);
    if (commandName === 'shop') return shopCommand.execute(interaction);
    if (commandName === 'lab') return labCommand.execute(interaction);
    if (commandName === 'games') return handleGamesCommand(interaction);

    const modCommand = moderationCmds.find(c => c.data.name === commandName);
    if (modCommand) return modCommand.execute(interaction);
};


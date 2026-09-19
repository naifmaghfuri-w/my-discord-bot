import { Interaction } from 'discord.js';

export async function startDetectiveGame(selectInteraction: any, initialInteraction: Interaction): Promise<void> {
    if (selectInteraction.replied || selectInteraction.deferred) {
        await selectInteraction.editReply({ 
            content: '⚠️ هذه اللعبة تم إيقافها وإزالتها حالياً.', 
            components: [] 
        });
    } else {
        await selectInteraction.reply({ 
            content: '⚠️ هذه اللعبة تم إيقافها وإزالتها حالياً.', 
            ephemeral: true 
        });
    }
}

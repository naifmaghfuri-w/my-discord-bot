import { 
    SlashCommandBuilder, 
    MessageFlags, 
    ChatInputCommandInteraction, 
    Guild 
} from 'discord.js';

// ⚠️ الآيدي الخاص بحساب صاحب البوت
const OWNER_ID: string = process.env.OWNER_ID || '1391517806193017023';

export interface Command {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const leaveServerCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('leave-server')
        .setDescription('إخراج البوت من سيرفر محدد بواسطة ID')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر المراد الخروج منه')
                .setRequired(true)) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            // التحقق من أن المستخدم هو صاحب البوت
            if (interaction.user.id !== OWNER_ID) {
                await interaction.reply({ 
                    content: '❌ هذا الأمر مخصص لصاحب البوت فقط!', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }

            const guildId = interaction.options.getString('guild_id', true).trim();
            
            // البحث عن السيرفر في الكاش أو محاولة جلب البيانات
            let guild: Guild | undefined = interaction.client.guilds.cache.get(guildId);
            if (!guild) {
                guild = await interaction.client.guilds.fetch(guildId).catch(() => undefined);
            }

            if (!guild) {
                await interaction.reply({ 
                    content: '❌ لم يتم العثور على سيرفر بهذا الـ ID أو أن البوت غير متواجد فيه.', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }

            const guildName = guild.name;
            await guild.leave();

            await interaction.reply({ 
                content: `✅ تم الخروج بنجاح من سيرفر: **${guildName}** (\`${guildId}\`)`, 
                flags: MessageFlags.Ephemeral 
            });

        } catch (error) {
            console.error('❌ خطأ في أمر leave-server:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ 
                    content: '❌ حدث خطأ أثناء محاولة الخروج من السيرفر.', 
                    flags: MessageFlags.Ephemeral 
                });
            }
        }
    },
};

export default leaveServerCommand;

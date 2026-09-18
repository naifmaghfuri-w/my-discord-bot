import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags, 
    ChatInputCommandInteraction, 
    GuildMemberRoleManager, 
    GuildTextBasedChannel, 
    Collection, 
    Message, 
    User 
} from 'discord.js';

export interface Command {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const ALLOWED_ROLE_IDS: string[] = ['1434264100556247040'];

const clearCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('حذف مجموعة من الرسائل')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('عدد الرسائل المراد حذفها من 1 إلى 100')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option => 
            option.setName('target')
                .setDescription('حدد الشخص المراد حذف رسائله فقط')
                .setRequired(false)
        ) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            // التحقق من وجود الأدوار في العضو المشغل للأمر
            const memberRoles = interaction.member?.roles;
            let hasRole = false;

            if (memberRoles instanceof GuildMemberRoleManager) {
                hasRole = memberRoles.cache.some(role => ALLOWED_ROLE_IDS.includes(role.id));
            } else if (Array.isArray(memberRoles)) {
                hasRole = memberRoles.some(roleId => ALLOWED_ROLE_IDS.includes(roleId));
            }

            if (!hasRole) {
                await interaction.reply({ 
                    content: '❌ عذراً، لا تملك الرتبة المحددة لاستخدام هذا الأمر.', 
                    flags: MessageFlags.Ephemeral 
                });
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const amount = interaction.options.getInteger('amount', true);
            const targetUser: User | null = interaction.options.getUser('target');
            const channel = interaction.channel as GuildTextBasedChannel | null;

            if (!channel || !('bulkDelete' in channel)) {
                await interaction.editReply({ 
                    content: '❌ لا يمكن استخدام هذا الأمر في نوع القناة الحالي.' 
                });
                return;
            }

            // جلب الرسائل من القناة
            const fetchedMessages: Collection<string, Message> = await channel.messages.fetch({ limit: 100 });

            let messagesToDelete: Message[] = Array.from(fetchedMessages.values());

            if (targetUser) {
                messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
            }

            // اقتطاع العدد المطلوب فقط
            messagesToDelete = messagesToDelete.slice(0, amount);

            if (messagesToDelete.length === 0) {
                await interaction.editReply({ content: '⚠️ لم يتم العثور على رسائل مطابقة للحذف.' });
                return;
            }

            const deleted: Collection<string, Message> = await channel.bulkDelete(messagesToDelete, true);

            await interaction.editReply({ 
                content: `🗑️ تم حذف **${deleted.size}** رسالة بنجاح.` 
            });

        } catch (err) {
            console.error('❌ خطأ أثناء تنفيذ أمر clear:', err);
            if (interaction.deferred) {
                await interaction.editReply({ 
                    content: '❌ حدث خطأ أثناء الحذف (قد تكون الرسائل أقدم من 14 يوماً ولا يمكن حذفها جماعياً).' 
                });
            }
        }
    }
};

export default clearCommand;

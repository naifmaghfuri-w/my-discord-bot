import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags, 
    ChatInputCommandInteraction, 
    Guild, 
    GuildTextChannel 
} from 'discord.js';

const OWNER_ID: string = process.env.OWNER_ID || '1391517806193017023';

export interface Command {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const getInviteCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('get-invite')
        .setDescription('إنشاء رابط دعوة لسيرفر يتواجد فيه البوت بواسطة ID')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر المطلوب')
                .setRequired(true)) as SlashCommandBuilder,

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // التحقق من أن المستخدم هو صاحب البوت
            if (interaction.user.id !== OWNER_ID) {
                await interaction.editReply({ content: '❌ هذا الأمر مخصص لصاحب البوت فقط!' });
                return;
            }

            const guildId = interaction.options.getString('guild_id', true).trim();
            
            // البحث عن السيرفر في الكاش أو محاولة جلب بياناته
            let guild: Guild | undefined = interaction.client.guilds.cache.get(guildId);
            if (!guild) {
                guild = await interaction.client.guilds.fetch(guildId).catch(() => undefined);
            }

            if (!guild) {
                await interaction.editReply({ content: '❌ البوت غير متواجد في هذا السيرفر أو أن الـ ID غير صحيح.' });
                return;
            }

            // جلب عضوية البوت داخل السيرفر للتأكد من الصلاحيات
            const botMember = await guild.members.fetchMe().catch(() => null);
            if (!botMember) {
                await interaction.editReply({ content: '❌ تعذر التحقق من صلاحيات البوت في هذا السيرفر.' });
                return;
            }

            // البحث عن أول قناة نصية يمتلك فيها البوت صلاحية إنشاء دعوة
            const channel = guild.channels.cache.find(c => 
                c.isTextBased() && 
                !c.isThread() &&
                c.permissionsFor(botMember)?.has(PermissionFlagsBits.CreateInstantInvite) === true
            ) as GuildTextChannel | undefined;

            if (!channel || typeof (channel as any).createInvite !== 'function') {
                await interaction.editReply({ content: '❌ البوت لا يمتلك صلاحيات إنشاء دعوة (Create Instant Invite) في قنوات هذا السيرفر.' });
                return;
            }

            // إنشاء رابط دعوة صالح لمدة 24 ساعة واستخدام واحد
            const invite = await (channel as any).createInvite({
                maxAge: 86400, // 24 ساعة
                maxUses: 1,    // استخدام واحد
                unique: true,
                reason: `تم إنشاء الدعوة بواسطة صاحب البوت: ${interaction.user.tag}`
            });

            await interaction.editReply({ 
                content: `🔗 **رابط الدعوة لسيرفر:** ${guild.name}\n${invite.url}` 
            });

        } catch (error) {
            console.error('❌ خطأ أثناء إنشاء الدعوة:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء محاولة إنشاء رابط الدعوة.' });
            }
        }
    },
};

export default getInviteCommand;

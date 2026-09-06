const { Client, GatewayIntentBits, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('clientReady', async () => {
    console.log(`Logged in as ${client.user.tag}`);

    const clearCommand = new SlashCommandBuilder()
        .setName('clear')
        .setDescription('حذف مجموعة من الرسائل')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('عدد الرسائل المراد حذفها من 1 الى 100')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option => 
            option.setName('target')
                .setDescription('منشن الشخص المراد حذف رسائله فقط')
                .setRequired(false)
        );

    await client.application.commands.create(clearCommand);
    console.log('تم تسجيل أمر /clear بنجاح!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'clear') {
        const allowedRoleIds = ['1434264100556247040'];

        const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));

        if (!hasRole) {
            return interaction.reply({ 
                content: 'عذراً، لا تملك الرتبة المحددة لاستخدام هذا الأمر.', 
                ephemeral: true 
            });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('target');

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let messagesToDelete = Array.from(messages.values());

        if (targetUser) {
            messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
        }

        messagesToDelete = messagesToDelete.slice(0, amount);

        if (messagesToDelete.length === 0) {
            return interaction.reply({ content: 'لم يتم العثور على رسائل لحذفها.', ephemeral: true });
        }

        await interaction.channel.bulkDelete(messagesToDelete, true)
            .then(deleted => {
                interaction.reply({ content: `تم حذف ${deleted.size} رسالة بنجاح.`, ephemeral: true });
            })
            .catch(err => {
                console.error(err);
                interaction.reply({ content: 'حدث خطأ أثناء الحذف (قد تكون الرسائل أقدم من 14 يوماً).', ephemeral: true });
            });
    }
});
client.login('MTU0NDk2ODYwNzcxNTI5OTQwOA.G5f9rm.Iki5Fe0Cykk9xmp9QzBxtoiSQgIKuylzNeA98A');
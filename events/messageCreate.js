const { GoogleGenerativeAI } = require('@google/generative-ai');
const labCommand = require('../commands/lab'); 
const { profileCommand } = require('../profileSystem');
const { handleGamesCommand } = require('../games');
const afkSystem = require('../afkSystem');
const { getPrivateChatPanel } = require('../privateChat');

// 🧠 تهيئة نموذج Gemini (تم الإبقاء على الاسم المخصص كما طلبك)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "بيتو" كإنسانه طبيعي تتكلمين عربي بكلام واضح وخليك ذكية وتتطورين وحفظي الأشياء الي يحكولك احفظيها زي اسمائهم وكلامك مختصر.
قواعد التفاعل الذكي:
-لاتكثري من اساله شو اخبارك و منورنا وكيف حالك لاتكثرين منها دوماً خلك في موضوع
-اسماء الاولاد الي تحكين معهم بصغة ولد هم ساي و زيلا و مي 
-اسماء البنات هم اسيل و ايما و نو ميرسي و ايميكا و عيدالحب وزها
2. **تحليل الجنس**:
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث 
   - إذا كان الاسم يدل على مذكر: خاطبه بصيغة المذكر 
3. **الإيموجيات المستخدمة**: استخدمي الإيموجيات التالية بشكل أساسي:`
});

module.exports = async (client, message) => {
    if (message.author.bot || !message.guild) return;

    const rawContent = message.content.trim();
    const content = rawContent.toLowerCase();

    // ==========================================
    // 1. الأوامر النصية المباشرة (مختبر، بروفايل، العاب، إرسال اللوحة)
    // ==========================================
    if (content === '!setup-panel' || content === 'لوحة الدردشات') {
        if (!message.member.permissions.has('Administrator')) return;

        const panelData = getPrivateChatPanel();
        await message.channel.send(panelData);
        await message.delete().catch(() => {});
        return;
    }

    // 🖼️ 🧪 تشغيل أمر المختبر (توليد/إرسال واجهة صورة)
    if (content === 'lab' || content === 'the lab' || content === 'مختبر' || content === 'المختبر') {
        if (labCommand && labCommand.execute) {
            const fakeInteraction = {
                guild: message.guild,
                channel: message.channel,
                user: message.author,
                member: message.member,
                client: message.client,
                replied: false,
                deferred: false,
                reply: async (options) => {
                    if (typeof options === 'string') return await message.reply(options);
                    return await message.reply({
                        content: options.content || null,
                        files: options.files || [],
                        components: options.components || [],
                        embeds: options.embeds || []
                    });
                },
                followUp: async (options) => {
                    if (typeof options === 'string') return await message.channel.send(options);
                    return await message.channel.send({
                        content: options.content || null,
                        files: options.files || [],
                        components: options.components || [],
                        embeds: options.embeds || []
                    });
                },
                deferReply: async () => {
                    await message.channel.sendTyping();
                }
            };

            return await labCommand.execute(fakeInteraction).catch(console.error);
        }
    }

    if (content === 'بروفايل' || content === 'بروفايلي' || content === 'profile') {
        if (profileCommand && profileCommand.execute) {
            return await profileCommand.execute(message).catch(console.error);
        }
    }

    if (content === 'العاب' || content === 'ألعاب' || content === 'games') {
        if (typeof handleGamesCommand === 'function') {
            return await handleGamesCommand(message).catch(console.error);
        }
    }

    // ==========================================
    // 2. معالجة نظام الـ AFK
    // ==========================================
    await afkSystem.handleMessage(client, message);

    // ==========================================
    // 3. معالجة رد الذكاء الاصطناعي
    // ==========================================
    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
    // تعديل السطر لتفادي الانكسار النصي
    const isCalledByName = content.includes('بيتو') || content.includes('pitou');

    if (isMentioned || isDots || isCalledByName) {
        try {
            await message.channel.sendTyping();
            const userDisplayName = message.member?.displayName || message.author.username;
            const userPrompt = `اسم العرض: "${userDisplayName}". الرسالة: "${message.content}"`;

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            await message.reply(response.text().slice(0, 2000));
        } catch (error) {
            console.error('❌ خطأ في الاستجابة الذكية من Gemini:', error);
        }
    }
};


const { GoogleGenerativeAI } = require('@google/generative-ai');
const labCommand = require('../commands/lab');
const { profileCommand } = require('../profileSystem');
const { handleGamesCommand } = require('../games');
const afkSystem = require('../afkSystem');
const { getPrivateChatPanel } = require('../privateChat'); // 👈 استدعاء دالة لوحة الدردشة الخاصة

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "مارش" كإنسانه طبيعي بلهجة السورية بس سوريه ومختصرة.
قواعد التفاعل الذكي:
-لاتكثري من اساله شو اخبارك و منورنا وكيف حالك لاتكثرين منها دوماً خلك في موضوع
-اسماء الاولاد الي تحكين معهم بصغة ولد هم ساي و زيلا و مي 
-اسماء البنات هم اسيل و ايما و نو ميرسي و ايميكا و عيدالحب وزها
2. **تحليل الجنس**:
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث 
   - إذا كان الاسم يدل على مذكر: خاطبه بصيغة المذكر 
3. **الإيموجيات المستخدمة**: استخدمي الإيموجيات التالية بشكل أساسي:
   <:emoji_35:1548377823100674058>, <:emoji_37:1548377953942110348>, <:emoji_38:1548378007339794472>, <:emoji_33:1548343801683378176>, <:emoji_39:1548378179566174348>, <:emoji_36:1548377886917001338>, <:emoji_34:1548377780100796646>`
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

    if (content === 'lab' || content === 'the lab' || content === 'مختبر' || content === 'المختبر') {
        if (labCommand && labCommand.execute) {
            return await labCommand.execute(message).catch(console.error);
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
    // 3. معالجة رد الذكاء الاصطناعي (Gemini)
    // ==========================================
    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
    const isCalledByName = content.includes('مارش') || content.includes('marsh');

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


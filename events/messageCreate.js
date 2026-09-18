const { GoogleGenerativeAI } = require('@google/generative-ai');

// استدعاء الموديولات بأمان لمنع انهيار السيرفر
let labCommand, profileCommand, handleGamesCommand, afkSystem, getPrivateChatPanel;

try { labCommand = require('../commands/lab'); } catch (e) { console.error('⚠️ تعذر تحميل مجلد المختبر:', e.message); }
try { ({ profileCommand } = require('../profileSystem')); } catch (e) { console.error('⚠️ تعذر تحميل البروفايل:', e.message); }
try { ({ handleGamesCommand } = require('../games')); } catch (e) { console.error('⚠️ تعذر تحميل الألعاب:', e.message); }
try { afkSystem = require('../afkSystem'); } catch (e) { console.error('⚠️ تعذر تحميل نظام AFK:', e.message); }
try { ({ getPrivateChatPanel } = require('../privateChat')); } catch (e) { console.error('⚠️ تعذر تحميل الدردشات الخاصة:', e.message); }

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

    if ((content === '!setup-panel' || content === 'لوحة الدردشات') && getPrivateChatPanel) {
        if (!message.member.permissions.has('Administrator')) return;
        const panelData = getPrivateChatPanel();
        await message.channel.send(panelData);
        await message.delete().catch(() => {});
        return;
    }

    if (content === 'lab' || content === 'the lab' || content === 'مختبر' || content === 'المختبر') {
        if (labCommand && (labCommand.execute || typeof labCommand === 'function')) {
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
                deferReply: async () => { await message.channel.sendTyping(); }
            };

            const execFunc = labCommand.execute || labCommand;
            return await execFunc(fakeInteraction).catch(console.error);
        }
    }

    if ((content === 'بروفايل' || content === 'بروفايلي' || content === 'profile') && profileCommand?.execute) {
        return await profileCommand.execute(message).catch(console.error);
    }

    if ((content === 'العاب' || content === 'ألعاب' || content === 'games') && typeof handleGamesCommand === 'function') {
        return await handleGamesCommand(message).catch(console.error);
    }

    if (afkSystem?.handleMessage) {
        await afkSystem.handleMessage(client, message);
    }

    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
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

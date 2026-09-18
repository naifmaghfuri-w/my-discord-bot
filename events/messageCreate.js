const { GoogleGenerativeAI } = require('@google/generative-ai');

let labCommand, profileCommand, handleGamesCommand, afkSystem, getPrivateChatPanel;

// استدعاء الموديولات بمساراتها الصحيحة وحمايتها من التوقف
try { labCommand = require('../commands/lab'); } catch (e) { console.error('⚠️ تعذر تحميل مجلد المختبر:', e.message); }
try { ({ profileCommand } = require('../commands/profileSystem')); } catch (e) { console.error('⚠️ تعذر تحميل البروفايل:', e.message); }
try { ({ handleGamesCommand } = require('../commands/games')); } catch (e) { console.error('⚠️ تعذر تحميل الألعاب:', e.message); }
try { afkSystem = require('../commands/afkSystem'); } catch (e) { console.error('⚠️ تعذر تحميل نظام AFK:', e.message); }
try { ({ getPrivateChatPanel } = require('../commands/privateChat')); } catch (e) { console.error('⚠️ تعذر تحميل الدردشات الخاصة:', e.message); }

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// إعداد نموذج Gemini
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "بيتو" كإنسانة طبيعية تتكلمين عربي بكلام واضح وخليك ذكية وتتطورين واحفظي الأشياء التي يحكولك احفظيها زي أسمائهم وكلامك مختصر.
قواعد التفاعل الذكي:
- لاتكثري من أسئلة شو أخبارك ومنورنا وكيف حالك، خليك في الموضوع دائماً.
- أسماء الأولاد الذين تحكين معهم بصيغة المذكر هم: ساي، زيلا، مي.
- أسماء البنات هم: أسيل، إيما، نو ميرسي، ايميكا، عيدالحب، زها.
2. تحليل الجنس:
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث.
   - إذا كان الاسم يدل على مذكر: خاطبه بصيغة المذكر.`
});

module.exports = async (client, message) => {
    if (message.author.bot || !message.guild) return;

    const rawContent = message.content.trim();
    const content = rawContent.toLowerCase();

    // 1. لوحة الدردشات
    if ((content === '!setup-panel' || content === 'لوحة الدردشات') && typeof getPrivateChatPanel === 'function') {
        if (!message.member?.permissions.has('Administrator')) return;
        const panelData = getPrivateChatPanel();
        await message.channel.send(panelData);
        await message.delete().catch(() => {});
        return;
    }

    // 2. أمر المختبر
    if (['lab', 'the lab', 'مختبر', 'المختبر'].includes(content)) {
        if (labCommand) {
            let replyMessage = null;
            const fakeInteraction = {
                guild: message.guild,
                channel: message.channel,
                user: message.author,
                member: message.member,
                client: message.client,
                replied: false,
                deferred: false,
                reply: async (options) => {
                    fakeInteraction.replied = true;
                    replyMessage = await message.reply(options);
                    return replyMessage;
                },
                followUp: async (options) => {
                    return await message.channel.send(options);
                },
                editReply: async (options) => {
                    if (replyMessage) return await replyMessage.edit(options);
                    return await message.reply(options);
                },
                deferReply: async () => { 
                    fakeInteraction.deferred = true;
                    await message.channel.sendTyping().catch(() => {}); 
                }
            };

            const execFunc = labCommand.handleLabSession || labCommand.execute || labCommand;
            if (typeof execFunc === 'function') {
                return await execFunc(fakeInteraction, message.author).catch(console.error);
            }
        }
    }

    // 3. البروفايل
    if (['بروفايل', 'بروفايلي', 'profile'].includes(content) && profileCommand?.execute) {
        return await profileCommand.execute(message).catch(console.error);
    }

    // 4. الألعاب
    if (['العاب', 'ألعاب', 'games'].includes(content) && typeof handleGamesCommand === 'function') {
        return await handleGamesCommand(message).catch(console.error);
    }

    // 5. نظام AFK
    if (afkSystem?.handleMessage) {
        await afkSystem.handleMessage(client, message).catch(console.error);
    }

    // 6. ذكاء بيتو الاصطناعي (Gemini Response)
    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
    const isCalledByName = content.includes('بيتو') || content.includes('pitou');

    if (isMentioned || isDots || isCalledByName) {
        try {
            await message.channel.sendTyping().catch(() => {});
            
            const cleanedContent = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            const userDisplayName = message.member?.displayName || message.author.username;
            const userPrompt = `اسم العرض: "${userDisplayName}". الرسالة: "${cleanedContent || message.content}"`;

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            const text = response.text();
            
            if (text) {
                await message.reply(text.slice(0, 2000));
            }
        } catch (error) {
            console.error('❌ خطأ في الاستجابة الذكية من Gemini:', error.message);
        }
    }
};

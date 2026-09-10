// lab.js
const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    SlashCommandBuilder 
} = require('discord.js');

// قاعدة بيانات الإصدار v1.0
const labData = {
    elements: ['H', 'C', 'O', 'Na', 'Cl', 'Ca'],
    equipment: {
        vessel: { name: 'وعاء التفاعل (Reaction Vessel)', desc: 'لتفاعلات التعادل والترسيب في المحاليل المائية' },
        furnace: { name: 'الفرن الحراري (Furnace)', desc: 'للتحليل بالتفكك الحراري والصهر' },
        distiller: { name: 'جهاز التقطير (Distiller)', desc: 'لتنقية السوائل وفصل المركبات بزيادة التركيز' }
    },
    reactions: [
        {
            id: 'react_nacl',
            name: 'تخليق ملح الطعام والماء',
            eq: 'HCl + NaOH → NaCl + H₂O',
            tool: 'vessel',
            req: { hcl: 1, naoh: 1 },
            yield: { nacl: 1, h2o: 1 }
        },
        {
            id: 'react_lime',
            name: 'التفكك الحراري لحجر الجير',
            eq: 'CaCO₃ + Heat → CaO + CO₂',
            tool: 'furnace',
            req: { caco3: 1 },
            yield: { cao: 1, co2: 1 }
        },
        {
            id: 'react_distill_acid',
            name: 'تنقية وتقطير حمض الهيدروكلوريك',
            eq: 'HCl (Dilute) → Pure HCl',
            tool: 'distiller',
            req: { hcl: 2 },
            yield: { hcl_pure: 1 }
        }
    ],
    items: {
        hcl: { name: 'حمض الهيدروكلوريك المخفف (HCl)', price: 15 },
        naoh: { name: 'هيدروكسيد الصوديوم (NaOH)', price: 15 },
        caco3: { name: 'كربونات الكالسيوم (CaCO₃)', price: 20 },
        nacl: { name: 'كلوريد الصوديوم (NaCl)', price: 35 },
        h2o: { name: 'ماء مقطر (H₂O)', price: 5 },
        cao: { name: 'أكسيد الكالسيوم (CaO)', price: 40 },
        co2: { name: 'ثاني أكسيد الكربون (CO₂)', price: 25 },
        hcl_pure: { name: 'حمض هيدروكلوريك مركز (Pure HCl)', price: 75 }
    }
};

const playerInventory = new Map();

function getPlayerData(userId) {
    if (!playerInventory.has(userId)) {
        playerInventory.set(userId, {
            coins: 100,
            inv: { hcl: 2, naoh: 2, caco3: 2 }
        });
    }
    return playerInventory.get(userId);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lab')
        .setDescription('فتح واجهة مختبر الكيمياء The Lab v1.0'),

    async execute(interactionOrMessage) {
        const user = interactionOrMessage.user || interactionOrMessage.author;
        const player = getPlayerData(user.id);

        const buildMainEmbed = () => {
            return new EmbedBuilder()
                .setTitle('🧪 مختبر الكيمياء | The Lab v1.0')
                .setDescription(`مرحباً بك يا دكتور **${user.username}** في مختبرك الخاص!\nجميع التفاعلات هنا تخضع لقوانين الكيمياء الحقيقية.`)
                .setColor(0x2b2d31)
                .addFields(
                    { name: '💰 الرصيد الحالي', value: `\`${player.coins} coin\``, inline: true },
                    { name: '⚛️ العناصر المفعلة (v1.0)', value: `\`${labData.elements.join(', ')}\``, inline: true },
                    { 
                        name: '🎒 مستودع المواد الحالي', 
                        value: Object.keys(player.inv).length > 0 
                            ? Object.entries(player.inv).map(([id, qty]) => `• **${labData.items[id]?.name || id}**: ${qty}`).join('\n')
                            : '_المستودع فارغ_' 
                    },
                    { 
                        name: '🧰 الأجهزة المتاحة في v1.0 (حد أقصى 3)', 
                        value: Object.values(labData.equipment).map(e => `• **${e.name}**`).join('\n') 
                    }
                )
                .setFooter({ text: 'The Lab Engine • v1.0.0 (Inorganic Chemistry Framework)' });
        };

        const reactionSelect = new StringSelectMenuBuilder()
            .setCustomId('select_reaction')
            .setPlaceholder('⚗️ اختر تفاعلاً كيميائياً لإجرائه...')
            .addOptions(
                labData.reactions.map(r => ({
                    label: r.name,
                    description: `${r.eq} [جهاز: ${labData.equipment[r.tool].name.split(' ')[0]}]`,
                    value: r.id
                }))
            );

        const storeButton = new ButtonBuilder()
            .setCustomId('btn_buy_raw')
            .setLabel('🛒 شراء مواد خام (20 Coin)')
            .setStyle(ButtonStyle.Primary);

        const sellButton = new ButtonBuilder()
            .setCustomId('btn_sell_all')
            .setLabel('💵 بيع النواتج المصنعة')
            .setStyle(ButtonStyle.Success);

        const rowSelect = new ActionRowBuilder().addComponents(reactionSelect);
        const rowButtons = new ActionRowBuilder().addComponents(storeButton, sellButton);

        const replyOptions = {
            embeds: [buildMainEmbed()],
            components: [rowSelect, rowButtons],
            fetchReply: true
        };

        let responseMessage;
        if (interactionOrMessage.replied || interactionOrMessage.deferred) {
            responseMessage = await interactionOrMessage.followUp(replyOptions);
        } else {
            responseMessage = await interactionOrMessage.reply(replyOptions);
        }

        const collector = responseMessage.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: 180000
        });

        collector.on('collect', async i => {
            if (i.isStringSelectMenu() && i.customId === 'select_reaction') {
                const reaction = labData.reactions.find(r => r.id === i.values[0]);
                
                let hasMaterials = true;
                for (const [mat, qty] of Object.entries(reaction.req)) {
                    if (!player.inv[mat] || player.inv[mat] < qty) {
                        hasMaterials = false;
                        break;
                    }
                }

                if (!hasMaterials) {
                    return i.reply({ content: `❌ **لا تملك المواد الكافية!** هذا التفاعل يتطلب: \`${JSON.stringify(reaction.req)}\``, ephemeral: true });
                }

                for (const [mat, qty] of Object.entries(reaction.req)) {
                    player.inv[mat] -= qty;
                    if (player.inv[mat] <= 0) delete player.inv[mat];
                }

                for (const [mat, qty] of Object.entries(reaction.yield)) {
                    player.inv[mat] = (player.inv[mat] || 0) + qty;
                }

                await i.update({ embeds: [buildMainEmbed()], components: [rowSelect, rowButtons] });
                await i.followUp({
                    content: `✅ **تم التفاعل بنجاح في [${labData.equipment[reaction.tool].name}]!**\n🧪 **المعادلة:** \`${reaction.eq}\`\n🎉 حصلت على: ${Object.entries(reaction.yield).map(([id, q]) => `**${labData.items[id].name}** x${q}`).join(', ')}`,
                    ephemeral: true
                });
            }

            if (i.isButton() && i.customId === 'btn_buy_raw') {
                if (player.coins < 20) {
                    return i.reply({ content: '❌ لا تملك نقوداً كافية (تحتاج 20 coin)!', ephemeral: true });
                }
                player.coins -= 20;
                player.inv.caco3 = (player.inv.caco3 || 0) + 1;
                player.inv.hcl = (player.inv.hcl || 0) + 1;
                
                await i.update({ embeds: [buildMainEmbed()], components: [rowSelect, rowButtons] });
                await i.followUp({ content: '🛒 تم شراء **1x حجر جير (CaCO₃)** و **1x حمض (HCl)** مقابل 20 coin.', ephemeral: true });
            }

            if (i.isButton() && i.customId === 'btn_sell_all') {
                let totalEarned = 0;
                const sellables = ['nacl', 'cao', 'co2', 'hcl_pure'];
                
                sellables.forEach(id => {
                    if (player.inv[id]) {
                        totalEarned += player.inv[id] * labData.items[id].price;
                        delete player.inv[id];
                    }
                });

                if (totalEarned === 0) {
                    return i.reply({ content: '⚠️ لا تملك أي نواتج مُصنّعة ذات قيمة لبيعها حالياً!', ephemeral: true });
                }

                player.coins += totalEarned;
                await i.update({ embeds: [buildMainEmbed()], components: [rowSelect, rowButtons] });
                await i.followUp({ content: `💵 تم بيع جميع المركبات الناتجة وحصلت على **${totalEarned} coin**!`, ephemeral: true });
            }
        });
    }
};
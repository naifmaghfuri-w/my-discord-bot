const fs = require('fs');
const path = require('path');
const labData = require('./data');

const dataPath = path.join(__dirname, 'labData.json');

function ensureDataFile() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}, null, 2));
}

function getMarketPrices() {
    const minuteSeed = Math.floor(Date.now() / 300000);
    let prices = {};
    Object.entries(labData.items).forEach(([id, item]) => {
        if (item.price > 0) {
            const factor = 0.7 + (Math.abs(Math.sin(minuteSeed + id.length)) * 0.6);
            prices[id] = Math.round(item.price * factor);
        }
    });
    return prices;
}

function generateDailyQuest(playerLevel) {
    const targetItems = Object.entries(labData.items).filter(([_, item]) => !item.buyable && item.price > 0);
    const randomItem = targetItems[Math.floor(Math.random() * targetItems.length)][0];
    const count = Math.floor(Math.random() * 2) + 1;
    return {
        item: randomItem,
        count: count,
        progress: 0,
        rewardCoins: count * 150 + playerLevel * 20,
        rewardXp: count * 40 + playerLevel * 10,
        completed: false,
        lastReset: Date.now()
    };
}

function processItemStabilityAndDecay(player) {
    if (!player.itemTimestamps) player.itemTimestamps = {};
    const now = Date.now();
    let decayedItems = [];

    for (const [itemId, qty] of Object.entries(player.inv)) {
        const itemInfo = labData.items[itemId];
        if (itemInfo && itemInfo.shelfLife) {
            if (!player.itemTimestamps[itemId]) {
                player.itemTimestamps[itemId] = now;
            } else if (now - player.itemTimestamps[itemId] > itemInfo.shelfLife * 1000) {
                delete player.inv[itemId];
                delete player.itemTimestamps[itemId];
                player.inv['h2o_imp'] = (player.inv['h2o_imp'] || 0) + qty;
                decayedItems.push(itemInfo.name);
            }
        }
    }
    return decayedItems;
}

function getPlayerData(userId) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }

    if (!db[userId]) {
        db[userId] = {
            level: 1, xp: 0, coins: 200, abilityPoints: 2, academicReputation: 0,
            unlockedReactions: ['r_nacl'],
            ownedEquipment: { beaker: 1 },
            equipmentLevels: { beaker: 1 },
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1 },
            itemTimestamps: {},
            codex: [], upgrades: { speed: false, shield: false },
            achievements: { cautious: 0, trader: 0, explorer: false },
            unlockedBadges: [],
            automatedProduct: null,
            lastAutoClaim: Date.now(),
            quest: generateDailyQuest(1),
            pendingQueue: []
        };
        fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
    }
    
    if (!db[userId].quest || (Date.now() - (db[userId].quest.lastReset || 0)) > 86400000) {
        db[userId].quest = generateDailyQuest(db[userId].level || 1);
    }
    if (!db[userId].equipmentLevels) db[userId].equipmentLevels = { beaker: 1 };
    if (!db[userId].achievements) db[userId].achievements = { cautious: 0, trader: 0, explorer: false };
    if (!db[userId].unlockedBadges) db[userId].unlockedBadges = [];

    return db[userId];
}

function updatePlayerData(userId, data) {
    ensureDataFile();
    let db = {};
    try { db = JSON.parse(fs.readFileSync(dataPath, 'utf8')); } catch (err) { db = {}; }
    db[userId] = data;
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
}

module.exports = {
    ensureDataFile,
    getMarketPrices,
    generateDailyQuest,
    processItemStabilityAndDecay,
    getPlayerData,
    updatePlayerData
};

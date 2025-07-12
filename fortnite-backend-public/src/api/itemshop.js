const express = require('express');
const router = express.Router();
const { loadConfig, updateItemShopConfig } = require('../utils/config');
const database = require('../utils/database');
const redis = require('../utils/redis');
const { logger, gameLogger } = require('../utils/logger');
const { authMiddleware } = require('../middleware/auth');

// Item Shop Service
class ItemShopService {
    constructor() {
        this.config = loadConfig();
    }

    async getCurrentItemShop() {
        try {
            // Try to get from cache first
            let itemShop = await redis.getCachedItemShop();
            
            if (!itemShop) {
                // Generate new item shop from configuration
                itemShop = this.generateItemShopFromConfig();
                
                // Cache for the configured rotation time
                const rotationHours = this.config.itemshop.rotation_schedule.rotation_interval_hours;
                await redis.cacheItemShop(itemShop, rotationHours * 3600);
            }
            
            return itemShop;
        } catch (error) {
            logger.error('Error getting current item shop:', error);
            throw error;
        }
    }

    generateItemShopFromConfig() {
        const config = this.config.itemshop;
        const now = new Date();
        
        const itemShop = {
            lastUpdated: now.toISOString(),
            nextRotation: this.calculateNextRotation(),
            sections: {}
        };

        // Featured section
        if (config.featured_section.enabled) {
            itemShop.sections.featured = {
                name: "Featured",
                items: config.featured_section.items.slice(0, config.featured_section.max_items)
            };
        }

        // Daily section
        if (config.daily_section.enabled) {
            itemShop.sections.daily = {
                name: "Daily",
                items: this.selectRandomItems(config.daily_section.items, config.daily_section.max_items)
            };
        }

        // Exotic weapons section
        if (config.exotic_weapons.enabled) {
            itemShop.sections.exotic = {
                name: "Exotic Weapons",
                items: this.formatExoticWeapons(config.exotic_weapons.npc_vendors)
            };
        }

        // Bundles section
        if (config.bundles.enabled) {
            itemShop.sections.bundles = {
                name: "Bundles",
                items: config.bundles.available_bundles
            };
        }

        return itemShop;
    }

    selectRandomItems(items, maxItems) {
        const shuffled = [...items].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, maxItems);
    }

    formatExoticWeapons(npcVendors) {
        const weapons = [];
        for (const vendor of npcVendors) {
            for (const weapon of vendor.weapons) {
                weapons.push({
                    ...weapon,
                    vendor: vendor.name,
                    location: vendor.location,
                    type: 'exotic_weapon'
                });
            }
        }
        return weapons;
    }

    calculateNextRotation() {
        const config = this.config.itemshop.rotation_schedule;
        const now = new Date();
        const nextRotation = new Date(now.getTime() + (config.rotation_interval_hours * 60 * 60 * 1000));
        return nextRotation.toISOString();
    }

    async rotateItemShop() {
        try {
            logger.info('Starting item shop rotation...');
            
            // Clear current cache
            await redis.invalidateItemShop();
            
            // Generate new shop
            const newShop = this.generateItemShopFromConfig();
            
            // Cache new shop
            const rotationHours = this.config.itemshop.rotation_schedule.rotation_interval_hours;
            await redis.cacheItemShop(newShop, rotationHours * 3600);
            
            logger.info('Item shop rotation completed successfully');
            return newShop;
        } catch (error) {
            logger.error('Item shop rotation failed:', error);
            throw error;
        }
    }

    async purchaseItem(playerId, itemId, currency) {
        try {
            // Get current item shop
            const itemShop = await this.getCurrentItemShop();
            
            // Find the item across all sections
            let item = null;
            let section = null;
            
            for (const [sectionName, sectionData] of Object.entries(itemShop.sections)) {
                const foundItem = sectionData.items.find(i => i.id === itemId);
                if (foundItem) {
                    item = foundItem;
                    section = sectionName;
                    break;
                }
            }
            
            if (!item) {
                throw new Error('Item not found in current shop');
            }
            
            // Check if item is available for purchase
            if (item.available_until && new Date() > new Date(item.available_until)) {
                throw new Error('Item is no longer available');
            }
            
            // Validate currency matches
            if (item.currency !== currency) {
                throw new Error(`Item requires ${item.currency}, but ${currency} was provided`);
            }
            
            // Check if player already owns the item
            const playerInventory = await database.query(
                'SELECT * FROM player_inventory WHERE player_id = $1 AND item_id = $2',
                [playerId, itemId]
            );
            
            if (playerInventory.rows.length > 0) {
                throw new Error('Player already owns this item');
            }
            
            // Process the purchase
            const result = await database.purchaseItem(playerId, itemId, item.price, currency);
            
            // Log the purchase
            gameLogger.itemShopPurchase(playerId, itemId, item.price, currency);
            
            return {
                success: true,
                item: item,
                newBalance: result.newBalance,
                purchaseTime: new Date().toISOString()
            };
            
        } catch (error) {
            logger.error('Item purchase failed:', { playerId, itemId, error: error.message });
            throw error;
        }
    }
}

const itemShopService = new ItemShopService();

// Routes

// GET /api/itemshop - Get current item shop
router.get('/', async (req, res) => {
    try {
        const itemShop = await itemShopService.getCurrentItemShop();
        res.json({
            success: true,
            data: itemShop
        });
    } catch (error) {
        logger.error('Error fetching item shop:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch item shop'
        });
    }
});

// GET /api/itemshop/config - Get item shop configuration (admin only)
router.get('/config', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin (you would implement admin check)
        // For now, just return the config
        const config = loadConfig();
        res.json({
            success: true,
            data: config.itemshop
        });
    } catch (error) {
        logger.error('Error fetching item shop config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch item shop configuration'
        });
    }
});

// POST /api/itemshop/config - Update item shop configuration (admin only)
router.post('/config', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin (implement admin check)
        // For now, allow any authenticated user
        
        const newConfig = req.body;
        const success = updateItemShopConfig(newConfig);
        
        if (success) {
            // Invalidate current cache to force regeneration
            await redis.invalidateItemShop();
            
            res.json({
                success: true,
                message: 'Item shop configuration updated successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to update configuration'
            });
        }
    } catch (error) {
        logger.error('Error updating item shop config:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update item shop configuration'
        });
    }
});

// POST /api/itemshop/purchase - Purchase an item
router.post('/purchase', authMiddleware, async (req, res) => {
    try {
        const { itemId, currency } = req.body;
        const playerId = req.player.id;
        
        if (!itemId || !currency) {
            return res.status(400).json({
                success: false,
                error: 'itemId and currency are required'
            });
        }
        
        const result = await itemShopService.purchaseItem(playerId, itemId, currency);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        logger.error('Purchase failed:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// POST /api/itemshop/rotate - Force item shop rotation (admin only)
router.post('/rotate', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin (implement admin check)
        
        const newShop = await itemShopService.rotateItemShop();
        
        res.json({
            success: true,
            message: 'Item shop rotated successfully',
            data: newShop
        });
        
    } catch (error) {
        logger.error('Manual rotation failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to rotate item shop'
        });
    }
});

// GET /api/itemshop/player/:playerId/purchases - Get player's purchase history
router.get('/player/:playerId/purchases', authMiddleware, async (req, res) => {
    try {
        const { playerId } = req.params;
        
        // Check if the requesting player can view this data
        if (req.player.id !== playerId && !req.player.isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }
        
        const purchases = await database.query(
            `SELECT t.*, pi.item_id 
             FROM transactions t 
             LEFT JOIN player_inventory pi ON t.player_id = pi.player_id 
             WHERE t.player_id = $1 AND t.transaction_type = 'purchase' 
             ORDER BY t.created_at DESC 
             LIMIT 50`,
            [playerId]
        );
        
        res.json({
            success: true,
            data: purchases.rows
        });
        
    } catch (error) {
        logger.error('Error fetching purchase history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch purchase history'
        });
    }
});

// GET /api/itemshop/stats - Get item shop statistics (admin only)
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        // Check if user is admin
        
        const stats = await database.query(`
            SELECT 
                COUNT(*) as total_purchases,
                SUM(CASE WHEN currency = 'vbucks' THEN ABS(amount) ELSE 0 END) as total_vbucks_spent,
                SUM(CASE WHEN currency = 'gold_bars' THEN ABS(amount) ELSE 0 END) as total_gold_spent,
                COUNT(DISTINCT player_id) as unique_buyers
            FROM transactions 
            WHERE transaction_type = 'purchase' 
            AND created_at >= NOW() - INTERVAL '30 days'
        `);
        
        const topItems = await database.query(`
            SELECT 
                reason,
                COUNT(*) as purchase_count,
                SUM(ABS(amount)) as total_revenue
            FROM transactions 
            WHERE transaction_type = 'purchase' 
            AND created_at >= NOW() - INTERVAL '7 days'
            GROUP BY reason 
            ORDER BY purchase_count DESC 
            LIMIT 10
        `);
        
        res.json({
            success: true,
            data: {
                overview: stats.rows[0],
                topItems: topItems.rows
            }
        });
        
    } catch (error) {
        logger.error('Error fetching item shop stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

// Fortnite client compatible endpoints
// GET /fortnite/api/storefront/v2/catalog - Fortnite client item shop endpoint
router.get('/catalog', async (req, res) => {
    try {
        const itemShop = await itemShopService.getCurrentItemShop();
        
        // Convert to Fortnite client format
        const fortniteFormat = {
            refreshIntervalHrs: loadConfig().itemshop.rotation_schedule.rotation_interval_hours,
            dailyPurchaseHrs: 24,
            expiration: itemShop.nextRotation,
            storefronts: [
                {
                    name: "BRDailyStorefront",
                    catalogEntries: this.convertToFortniteFormat(itemShop.sections.daily?.items || [])
                },
                {
                    name: "BRWeeklyStorefront", 
                    catalogEntries: this.convertToFortniteFormat(itemShop.sections.featured?.items || [])
                }
            ]
        };
        
        res.json(fortniteFormat);
        
    } catch (error) {
        logger.error('Error fetching Fortnite catalog:', error);
        res.status(500).json({
            errorCode: 'errors.com.epicgames.common.server_error',
            errorMessage: 'Internal server error'
        });
    }
});

// Helper function to convert to Fortnite format
function convertToFortniteFormat(items) {
    return items.map(item => ({
        offerId: item.id,
        devName: item.name,
        offerType: "StaticPrice",
        prices: [{
            currencyType: item.currency === 'vbucks' ? 'MtxCurrency' : 'GoldBars',
            currencySubType: "",
            regularPrice: item.price,
            finalPrice: item.price,
            saleExpiration: item.available_until || "9999-12-31T23:59:59.999Z"
        }],
        categories: [item.type],
        catalogGroup: item.featured ? "Featured" : "Daily",
        catalogGroupPriority: item.featured ? 1 : 2,
        sortPriority: 0,
        title: item.name,
        shortDescription: item.description,
        description: item.description,
        displayAssetPath: item.displayAssetPath || "",
        itemGrants: [{
            templateId: item.id,
            quantity: 1
        }]
    }));
}

module.exports = router;
module.exports.ItemShopService = itemShopService;
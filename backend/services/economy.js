const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { redisHelper } = require('../config/redis');
const { economyLogger } = require('../middleware/logger');
const { 
  NotFoundError, 
  ValidationError,
  ConflictError,
  ForbiddenError 
} = require('../middleware/errorHandler');

class EpoEconomyService {
  constructor() {
    this.vbucksPackages = [
      { id: 'starter', name: 'Starter Pack', vbucks: 1000, price: 9.99 },
      { id: 'standard', name: 'Standard Pack', vbucks: 2800, price: 19.99 },
      { id: 'deluxe', name: 'Deluxe Pack', vbucks: 5000, price: 39.99 },
      { id: 'ultimate', name: 'Ultimate Pack', vbucks: 13500, price: 99.99 }
    ];
    
    this.itemShopRotationHours = 24;
  }

  // Get user's V-Bucks balance
  async getVBucksBalance(userId) {
    try {
      const user = await db('users')
        .where('id', userId)
        .select('vbucks')
        .first();
      
      if (!user) {
        throw new NotFoundError('User not found');
      }

      return { vbucks: user.vbucks };
    } catch (error) {
      throw error;
    }
  }

  // Purchase V-Bucks
  async purchaseVBucks(userId, packageId, paymentMethod, paymentToken) {
    try {
      // Find package
      const package = this.vbucksPackages.find(p => p.id === packageId);
      if (!package) {
        throw new NotFoundError('V-Bucks package not found');
      }

      // Process payment (mock implementation)
      const paymentResult = await this.processPayment(
        package.price, 
        paymentMethod, 
        paymentToken
      );

      if (!paymentResult.success) {
        throw new Error('Payment failed: ' + paymentResult.error);
      }

      // Add V-Bucks to user account
      await db('users')
        .where('id', userId)
        .increment('vbucks', package.vbucks);

      // Record transaction
      const transactionId = uuidv4();
      await db('transactions').insert({
        id: transactionId,
        user_id: userId,
        type: 'vbucks_purchase',
        amount: package.vbucks,
        currency: 'USD',
        price: package.price,
        payment_method: paymentMethod,
        payment_id: paymentResult.payment_id,
        status: 'completed',
        created_at: new Date()
      });

      // Log purchase
      economyLogger.vbucksTransaction(
        userId, 
        package.vbucks, 
        'purchase', 
        { package_id: packageId, price: package.price }
      );

      return {
        transaction_id: transactionId,
        vbucks_added: package.vbucks,
        new_balance: await this.getVBucksBalance(userId)
      };
    } catch (error) {
      throw error;
    }
  }

  // Get item shop
  async getItemShop() {
    try {
      // Check if shop needs rotation
      const lastRotation = await redisHelper.get('item_shop_last_rotation');
      const now = Date.now();
      const rotationInterval = this.itemShopRotationHours * 60 * 60 * 1000;

      if (!lastRotation || (now - lastRotation) > rotationInterval) {
        await this.rotateItemShop();
      }

      // Get current shop items
      const shopItems = await db('item_shop_rotations')
        .join('items', 'item_shop_rotations.item_id', 'items.id')
        .where('item_shop_rotations.is_active', true)
        .select(
          'items.*',
          'item_shop_rotations.discounted_price',
          'item_shop_rotations.featured'
        );

      // Organize by categories
      const organizedShop = {
        featured: shopItems.filter(item => item.featured),
        daily: shopItems.filter(item => !item.featured),
        rotation_ends: await this.getNextRotationTime()
      };

      return organizedShop;
    } catch (error) {
      throw error;
    }
  }

  // Purchase item from shop
  async purchaseItem(userId, itemId, quantity = 1) {
    try {
      // Check if item is in current shop
      const shopItem = await db('item_shop_rotations')
        .join('items', 'item_shop_rotations.item_id', 'items.id')
        .where('item_shop_rotations.item_id', itemId)
        .where('item_shop_rotations.is_active', true)
        .select(
          'items.*',
          'item_shop_rotations.discounted_price'
        )
        .first();

      if (!shopItem) {
        throw new NotFoundError('Item not available in shop');
      }

      // Check if user already owns item (for non-consumable items)
      if (!shopItem.is_consumable) {
        const ownedItem = await db('player_inventory')
          .where('user_id', userId)
          .where('item_id', itemId)
          .first();

        if (ownedItem) {
          throw new ConflictError('You already own this item');
        }
      }

      // Calculate total cost
      const itemPrice = shopItem.discounted_price || shopItem.price;
      const totalCost = itemPrice * quantity;

      // Check user's V-Bucks balance
      const user = await db('users')
        .where('id', userId)
        .select('vbucks')
        .first();

      if (user.vbucks < totalCost) {
        throw new ForbiddenError('Insufficient V-Bucks');
      }

      // Deduct V-Bucks
      await db('users')
        .where('id', userId)
        .decrement('vbucks', totalCost);

      // Add item to inventory
      const inventoryId = uuidv4();
      await db('player_inventory').insert({
        id: inventoryId,
        user_id: userId,
        item_id: itemId,
        quantity: quantity,
        equipped: false,
        acquired_at: new Date()
      });

      // Record transaction
      const transactionId = uuidv4();
      await db('transactions').insert({
        id: transactionId,
        user_id: userId,
        type: 'item_purchase',
        item_id: itemId,
        quantity: quantity,
        amount: totalCost,
        currency: 'vbucks',
        status: 'completed',
        created_at: new Date()
      });

      // Log purchase
      economyLogger.purchase(userId, itemId, totalCost, 'vbucks');

      return {
        transaction_id: transactionId,
        item: shopItem,
        quantity: quantity,
        cost: totalCost,
        new_balance: user.vbucks - totalCost
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user's purchase history
  async getPurchaseHistory(userId, limit = 50) {
    try {
      const history = await db('transactions')
        .leftJoin('items', 'transactions.item_id', 'items.id')
        .where('transactions.user_id', userId)
        .orderBy('transactions.created_at', 'desc')
        .limit(limit)
        .select(
          'transactions.*',
          'items.name as item_name',
          'items.type as item_type',
          'items.rarity as item_rarity'
        );

      return history;
    } catch (error) {
      throw error;
    }
  }

  // Award V-Bucks (for rewards, promotions, etc.)
  async awardVBucks(userId, amount, reason) {
    try {
      // Add V-Bucks to user account
      await db('users')
        .where('id', userId)
        .increment('vbucks', amount);

      // Record transaction
      const transactionId = uuidv4();
      await db('transactions').insert({
        id: transactionId,
        user_id: userId,
        type: 'vbucks_reward',
        amount: amount,
        currency: 'vbucks',
        reason: reason,
        status: 'completed',
        created_at: new Date()
      });

      // Log reward
      economyLogger.vbucksTransaction(
        userId, 
        amount, 
        'reward', 
        { reason }
      );

      return {
        transaction_id: transactionId,
        vbucks_awarded: amount,
        reason: reason
      };
    } catch (error) {
      throw error;
    }
  }

  // Get battle pass info
  async getBattlePassInfo(userId) {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      const battlePass = await db('battle_passes')
        .where('user_id', userId)
        .where('season_id', currentSeason.id)
        .first();

      if (!battlePass) {
        return {
          season: currentSeason.name,
          tier: 1,
          has_premium: false,
          experience: 0,
          rewards: []
        };
      }

      // Get available rewards
      const rewards = await db('battle_pass_rewards')
        .where('season_id', currentSeason.id)
        .where('tier', '<=', battlePass.tier)
        .orderBy('tier', 'asc');

      return {
        season: currentSeason.name,
        tier: battlePass.tier,
        has_premium: battlePass.has_premium,
        experience: battlePass.experience,
        rewards: rewards
      };
    } catch (error) {
      throw error;
    }
  }

  // Purchase battle pass
  async purchaseBattlePass(userId, seasonId) {
    try {
      const battlePassPrice = 950; // V-Bucks

      // Check user's V-Bucks balance
      const user = await db('users')
        .where('id', userId)
        .select('vbucks')
        .first();

      if (user.vbucks < battlePassPrice) {
        throw new ForbiddenError('Insufficient V-Bucks');
      }

      // Check if user already has battle pass
      const existingBattlePass = await db('battle_passes')
        .where('user_id', userId)
        .where('season_id', seasonId)
        .first();

      if (existingBattlePass && existingBattlePass.has_premium) {
        throw new ConflictError('You already own this battle pass');
      }

      // Deduct V-Bucks
      await db('users')
        .where('id', userId)
        .decrement('vbucks', battlePassPrice);

      // Create or update battle pass
      if (existingBattlePass) {
        await db('battle_passes')
          .where('id', existingBattlePass.id)
          .update({
            has_premium: true,
            updated_at: new Date()
          });
      } else {
        await db('battle_passes').insert({
          id: uuidv4(),
          user_id: userId,
          season_id: seasonId,
          tier: 1,
          experience: 0,
          has_premium: true,
          created_at: new Date()
        });
      }

      // Record transaction
      const transactionId = uuidv4();
      await db('transactions').insert({
        id: transactionId,
        user_id: userId,
        type: 'battle_pass_purchase',
        amount: battlePassPrice,
        currency: 'vbucks',
        status: 'completed',
        created_at: new Date()
      });

      // Log purchase
      economyLogger.purchase(userId, 'battle_pass', battlePassPrice, 'vbucks');

      return {
        transaction_id: transactionId,
        cost: battlePassPrice,
        new_balance: user.vbucks - battlePassPrice
      };
    } catch (error) {
      throw error;
    }
  }

  // Rotate item shop
  async rotateItemShop() {
    try {
      // Deactivate current shop
      await db('item_shop_rotations')
        .where('is_active', true)
        .update({ is_active: false });

      // Get random items for new shop
      const featuredItems = await db('items')
        .where('rarity', 'legendary')
        .orderByRaw('RANDOM()')
        .limit(2);

      const dailyItems = await db('items')
        .whereIn('rarity', ['common', 'uncommon', 'rare', 'epic'])
        .orderByRaw('RANDOM()')
        .limit(6);

      const newShopItems = [
        ...featuredItems.map(item => ({ ...item, featured: true })),
        ...dailyItems.map(item => ({ ...item, featured: false }))
      ];

      // Add new items to shop
      for (const item of newShopItems) {
        await db('item_shop_rotations').insert({
          id: uuidv4(),
          item_id: item.id,
          original_price: item.price,
          discounted_price: item.featured ? Math.floor(item.price * 0.8) : null,
          featured: item.featured,
          is_active: true,
          created_at: new Date()
        });
      }

      // Update rotation time
      await redisHelper.setex('item_shop_last_rotation', 86400, Date.now());

      return { message: 'Item shop rotated successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Get next rotation time
  async getNextRotationTime() {
    try {
      const lastRotation = await redisHelper.get('item_shop_last_rotation');
      const rotationInterval = this.itemShopRotationHours * 60 * 60 * 1000;
      
      if (!lastRotation) {
        return new Date(Date.now() + rotationInterval);
      }

      return new Date(lastRotation + rotationInterval);
    } catch (error) {
      throw error;
    }
  }

  // Get current season
  async getCurrentSeason() {
    try {
      const season = await db('seasons')
        .where('is_active', true)
        .first();

      return season || { id: 'default', name: 'Chapter 2 Season 5' };
    } catch (error) {
      throw error;
    }
  }

  // Process payment (mock implementation)
  async processPayment(amount, method, token) {
    try {
      // This would integrate with actual payment processors
      // For now, return mock success
      return {
        success: true,
        payment_id: uuidv4(),
        amount: amount,
        method: method
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get economy stats
  async getEconomyStats() {
    try {
      const stats = await db('transactions')
        .select(
          db.raw('COUNT(*) as total_transactions'),
          db.raw('SUM(CASE WHEN type = "vbucks_purchase" THEN amount ELSE 0 END) as total_vbucks_sold'),
          db.raw('SUM(CASE WHEN type = "item_purchase" THEN amount ELSE 0 END) as total_vbucks_spent'),
          db.raw('SUM(CASE WHEN currency = "USD" THEN price ELSE 0 END) as total_revenue')
        )
        .where('status', 'completed')
        .first();

      return stats;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EpoEconomyService();
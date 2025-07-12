const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { redisHelper } = require('../config/redis');
const { 
  NotFoundError, 
  ValidationError,
  ConflictError 
} = require('../middleware/errorHandler');

class EpoContentService {
  constructor() {
    this.itemTypes = [
      'skin', 'emote', 'pickaxe', 'glider', 'wrap', 'music',
      'loading_screen', 'spray', 'banner', 'emoticon'
    ];
    
    this.rarities = [
      'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'
    ];
    
    this.cdnUrl = process.env.CDN_URL || 'https://cdn.epo.com';
  }

  // Get all items
  async getAllItems(filters = {}) {
    try {
      let query = db('items')
        .select('*')
        .where('is_active', true);

      // Apply filters
      if (filters.type) {
        query = query.where('type', filters.type);
      }
      
      if (filters.rarity) {
        query = query.where('rarity', filters.rarity);
      }
      
      if (filters.search) {
        query = query.where('name', 'ilike', `%${filters.search}%`);
      }
      
      if (filters.min_price) {
        query = query.where('price', '>=', filters.min_price);
      }
      
      if (filters.max_price) {
        query = query.where('price', '<=', filters.max_price);
      }

      const items = await query.orderBy('created_at', 'desc');
      
      return items.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get item by ID
  async getItemById(itemId) {
    try {
      const item = await db('items')
        .where('id', itemId)
        .where('is_active', true)
        .first();

      if (!item) {
        throw new NotFoundError('Item not found');
      }

      return {
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`,
        model_url: `${this.cdnUrl}/items/${item.id}/model.json`
      };
    } catch (error) {
      throw error;
    }
  }

  // Create new item
  async createItem(itemData) {
    try {
      const { name, description, type, rarity, price, tags, metadata } = itemData;
      
      // Validate item type and rarity
      if (!this.itemTypes.includes(type)) {
        throw new ValidationError('Invalid item type');
      }
      
      if (!this.rarities.includes(rarity)) {
        throw new ValidationError('Invalid rarity');
      }

      // Check if item name already exists
      const existingItem = await db('items')
        .where('name', name)
        .first();

      if (existingItem) {
        throw new ConflictError('Item with this name already exists');
      }

      const itemId = uuidv4();
      const newItem = await db('items').insert({
        id: itemId,
        name,
        description,
        type,
        rarity,
        price,
        tags: JSON.stringify(tags || []),
        metadata: JSON.stringify(metadata || {}),
        is_active: true,
        is_featured: false,
        is_exclusive: false,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      return {
        ...newItem[0],
        image_url: `${this.cdnUrl}/items/${itemId}/image.png`,
        preview_url: `${this.cdnUrl}/items/${itemId}/preview.png`
      };
    } catch (error) {
      throw error;
    }
  }

  // Update item
  async updateItem(itemId, updateData) {
    try {
      const item = await db('items')
        .where('id', itemId)
        .first();

      if (!item) {
        throw new NotFoundError('Item not found');
      }

      const updateFields = {
        updated_at: new Date()
      };

      // Only update provided fields
      if (updateData.name) updateFields.name = updateData.name;
      if (updateData.description) updateFields.description = updateData.description;
      if (updateData.price) updateFields.price = updateData.price;
      if (updateData.is_featured !== undefined) updateFields.is_featured = updateData.is_featured;
      if (updateData.is_exclusive !== undefined) updateFields.is_exclusive = updateData.is_exclusive;
      if (updateData.tags) updateFields.tags = JSON.stringify(updateData.tags);
      if (updateData.metadata) updateFields.metadata = JSON.stringify(updateData.metadata);

      await db('items')
        .where('id', itemId)
        .update(updateFields);

      return { message: 'Item updated successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Delete item
  async deleteItem(itemId) {
    try {
      const item = await db('items')
        .where('id', itemId)
        .first();

      if (!item) {
        throw new NotFoundError('Item not found');
      }

      // Soft delete
      await db('items')
        .where('id', itemId)
        .update({ 
          is_active: false,
          deleted_at: new Date()
        });

      return { message: 'Item deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Get featured items
  async getFeaturedItems() {
    try {
      const items = await db('items')
        .where('is_featured', true)
        .where('is_active', true)
        .orderBy('created_at', 'desc')
        .limit(10);

      return items.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get exclusive items
  async getExclusiveItems() {
    try {
      const items = await db('items')
        .where('is_exclusive', true)
        .where('is_active', true)
        .orderBy('created_at', 'desc');

      return items.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get items by type
  async getItemsByType(type) {
    try {
      if (!this.itemTypes.includes(type)) {
        throw new ValidationError('Invalid item type');
      }

      const items = await db('items')
        .where('type', type)
        .where('is_active', true)
        .orderBy('created_at', 'desc');

      return items.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get items by rarity
  async getItemsByRarity(rarity) {
    try {
      if (!this.rarities.includes(rarity)) {
        throw new ValidationError('Invalid rarity');
      }

      const items = await db('items')
        .where('rarity', rarity)
        .where('is_active', true)
        .orderBy('created_at', 'desc');

      return items.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Search items
  async searchItems(searchTerm, filters = {}) {
    try {
      let query = db('items')
        .where('is_active', true)
        .where(function() {
          this.where('name', 'ilike', `%${searchTerm}%`)
            .orWhere('description', 'ilike', `%${searchTerm}%`);
        });

      // Apply filters
      if (filters.type) {
        query = query.where('type', filters.type);
      }
      
      if (filters.rarity) {
        query = query.where('rarity', filters.rarity);
      }

      const items = await query.orderBy('created_at', 'desc');

      return items.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get news/announcements
  async getNews(limit = 10) {
    try {
      const news = await db('news')
        .where('is_published', true)
        .where('publish_date', '<=', new Date())
        .orderBy('publish_date', 'desc')
        .limit(limit);

      return news.map(article => ({
        ...article,
        image_url: `${this.cdnUrl}/news/${article.id}/image.png`,
        content_url: `${this.cdnUrl}/news/${article.id}/content.json`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get news by ID
  async getNewsById(newsId) {
    try {
      const article = await db('news')
        .where('id', newsId)
        .where('is_published', true)
        .first();

      if (!article) {
        throw new NotFoundError('News article not found');
      }

      return {
        ...article,
        image_url: `${this.cdnUrl}/news/${article.id}/image.png`,
        content_url: `${this.cdnUrl}/news/${article.id}/content.json`
      };
    } catch (error) {
      throw error;
    }
  }

  // Create news article
  async createNews(newsData) {
    try {
      const { title, content, summary, category, tags, publish_date } = newsData;

      const newsId = uuidv4();
      const newArticle = await db('news').insert({
        id: newsId,
        title,
        content,
        summary,
        category,
        tags: JSON.stringify(tags || []),
        publish_date: publish_date || new Date(),
        is_published: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      return {
        ...newArticle[0],
        image_url: `${this.cdnUrl}/news/${newsId}/image.png`
      };
    } catch (error) {
      throw error;
    }
  }

  // Get game events
  async getGameEvents() {
    try {
      const events = await db('game_events')
        .where('is_active', true)
        .where('start_date', '<=', new Date())
        .where('end_date', '>=', new Date())
        .orderBy('start_date', 'desc');

      return events.map(event => ({
        ...event,
        image_url: `${this.cdnUrl}/events/${event.id}/image.png`,
        banner_url: `${this.cdnUrl}/events/${event.id}/banner.png`
      }));
    } catch (error) {
      throw error;
    }
  }

  // Create game event
  async createGameEvent(eventData) {
    try {
      const { name, description, type, rewards, start_date, end_date } = eventData;

      const eventId = uuidv4();
      const newEvent = await db('game_events').insert({
        id: eventId,
        name,
        description,
        type,
        rewards: JSON.stringify(rewards || []),
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }).returning('*');

      return {
        ...newEvent[0],
        image_url: `${this.cdnUrl}/events/${eventId}/image.png`,
        banner_url: `${this.cdnUrl}/events/${eventId}/banner.png`
      };
    } catch (error) {
      throw error;
    }
  }

  // Get item statistics
  async getItemStats(itemId) {
    try {
      const item = await db('items')
        .where('id', itemId)
        .first();

      if (!item) {
        throw new NotFoundError('Item not found');
      }

      // Get purchase count
      const purchaseCount = await db('transactions')
        .where('item_id', itemId)
        .where('type', 'item_purchase')
        .where('status', 'completed')
        .count('* as count')
        .first();

      // Get revenue
      const revenue = await db('transactions')
        .where('item_id', itemId)
        .where('type', 'item_purchase')
        .where('status', 'completed')
        .sum('amount as total')
        .first();

      // Get ownership count
      const ownershipCount = await db('player_inventory')
        .where('item_id', itemId)
        .count('* as count')
        .first();

      return {
        item_id: itemId,
        name: item.name,
        type: item.type,
        rarity: item.rarity,
        price: item.price,
        purchase_count: parseInt(purchaseCount.count),
        total_revenue: parseInt(revenue.total || 0),
        ownership_count: parseInt(ownershipCount.count),
        popularity_score: this.calculatePopularityScore(item, purchaseCount.count, ownershipCount.count)
      };
    } catch (error) {
      throw error;
    }
  }

  // Calculate popularity score
  calculatePopularityScore(item, purchaseCount, ownershipCount) {
    const ageInDays = Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const dailyPurchases = purchaseCount / Math.max(ageInDays, 1);
    const rarityMultiplier = {
      common: 1,
      uncommon: 1.2,
      rare: 1.5,
      epic: 2,
      legendary: 3,
      mythic: 5
    };

    return Math.floor((dailyPurchases * rarityMultiplier[item.rarity] * 100) + ownershipCount * 0.1);
  }

  // Get content statistics
  async getContentStats() {
    try {
      const stats = await db('items')
        .select(
          db.raw('COUNT(*) as total_items'),
          db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_items'),
          db.raw('COUNT(CASE WHEN is_featured = true THEN 1 END) as featured_items'),
          db.raw('COUNT(CASE WHEN is_exclusive = true THEN 1 END) as exclusive_items')
        )
        .first();

      const typeStats = await db('items')
        .select('type')
        .count('* as count')
        .where('is_active', true)
        .groupBy('type');

      const rarityStats = await db('items')
        .select('rarity')
        .count('* as count')
        .where('is_active', true)
        .groupBy('rarity');

      return {
        ...stats,
        by_type: typeStats.reduce((acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        }, {}),
        by_rarity: rarityStats.reduce((acc, item) => {
          acc[item.rarity] = parseInt(item.count);
          return acc;
        }, {})
      };
    } catch (error) {
      throw error;
    }
  }

  // Get popular items
  async getPopularItems(limit = 10) {
    try {
      const popularItems = await db('items')
        .leftJoin('transactions', 'items.id', 'transactions.item_id')
        .select('items.*')
        .count('transactions.id as purchase_count')
        .where('items.is_active', true)
        .groupBy('items.id')
        .orderBy('purchase_count', 'desc')
        .limit(limit);

      return popularItems.map(item => ({
        ...item,
        image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
        preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`,
        purchase_count: parseInt(item.purchase_count)
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get recommended items for user
  async getRecommendedItems(userId, limit = 10) {
    try {
      // Get user's purchase history
      const userPurchases = await db('transactions')
        .join('items', 'transactions.item_id', 'items.id')
        .where('transactions.user_id', userId)
        .where('transactions.type', 'item_purchase')
        .select('items.type', 'items.rarity');

      // Get user preferences
      const typePreferences = {};
      const rarityPreferences = {};

      userPurchases.forEach(purchase => {
        typePreferences[purchase.type] = (typePreferences[purchase.type] || 0) + 1;
        rarityPreferences[purchase.rarity] = (rarityPreferences[purchase.rarity] || 0) + 1;
      });

      // Get recommended items based on preferences
      const recommendedItems = await db('items')
        .whereNotIn('id', 
          db('player_inventory')
            .where('user_id', userId)
            .select('item_id')
        )
        .where('is_active', true)
        .orderByRaw('RANDOM()')
        .limit(limit * 2);

      // Score and sort recommendations
      const scoredItems = recommendedItems.map(item => {
        let score = 0;
        score += (typePreferences[item.type] || 0) * 10;
        score += (rarityPreferences[item.rarity] || 0) * 5;
        score += item.is_featured ? 20 : 0;
        score += item.is_exclusive ? 15 : 0;
        
        return { ...item, recommendation_score: score };
      });

      return scoredItems
        .sort((a, b) => b.recommendation_score - a.recommendation_score)
        .slice(0, limit)
        .map(item => ({
          ...item,
          image_url: `${this.cdnUrl}/items/${item.id}/image.png`,
          preview_url: `${this.cdnUrl}/items/${item.id}/preview.png`
        }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EpoContentService();
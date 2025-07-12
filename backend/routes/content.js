const express = require('express');
const router = express.Router();
const contentService = require('../services/content');
const { validateContentUpload } = require('../middleware/validation');
const { requestLogger } = require('../middleware/logger');

// Apply request logging to all content routes
router.use(requestLogger);

// Get all items
router.get('/items', async (req, res, next) => {
  try {
    const filters = {
      type: req.query.type,
      rarity: req.query.rarity,
      search: req.query.search,
      min_price: req.query.min_price,
      max_price: req.query.max_price
    };
    
    const result = await contentService.getAllItems(filters);
    
    res.json({
      success: true,
      message: 'Items retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get item by ID
router.get('/items/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const result = await contentService.getItemById(itemId);
    
    res.json({
      success: true,
      message: 'Item retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get featured items
router.get('/items/featured', async (req, res, next) => {
  try {
    const result = await contentService.getFeaturedItems();
    
    res.json({
      success: true,
      message: 'Featured items retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get exclusive items
router.get('/items/exclusive', async (req, res, next) => {
  try {
    const result = await contentService.getExclusiveItems();
    
    res.json({
      success: true,
      message: 'Exclusive items retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get items by type
router.get('/items/type/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const result = await contentService.getItemsByType(type);
    
    res.json({
      success: true,
      message: `${type} items retrieved successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get items by rarity
router.get('/items/rarity/:rarity', async (req, res, next) => {
  try {
    const { rarity } = req.params;
    const result = await contentService.getItemsByRarity(rarity);
    
    res.json({
      success: true,
      message: `${rarity} items retrieved successfully`,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Search items
router.get('/search', async (req, res, next) => {
  try {
    const { q, type, rarity } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const filters = { type, rarity };
    const result = await contentService.searchItems(q, filters);
    
    res.json({
      success: true,
      message: 'Search results retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get popular items
router.get('/popular', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await contentService.getPopularItems(limit);
    
    res.json({
      success: true,
      message: 'Popular items retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get recommended items (protected route)
router.get('/recommended', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await contentService.getRecommendedItems(req.user.id, limit);
    
    res.json({
      success: true,
      message: 'Recommended items retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get news
router.get('/news', async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;
    const result = await contentService.getNews(limit);
    
    res.json({
      success: true,
      message: 'News retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get news by ID
router.get('/news/:newsId', async (req, res, next) => {
  try {
    const { newsId } = req.params;
    const result = await contentService.getNewsById(newsId);
    
    res.json({
      success: true,
      message: 'News article retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get game events
router.get('/events', async (req, res, next) => {
  try {
    const result = await contentService.getGameEvents();
    
    res.json({
      success: true,
      message: 'Game events retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get item statistics (admin only)
router.get('/items/:itemId/stats', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const { itemId } = req.params;
    const result = await contentService.getItemStats(itemId);
    
    res.json({
      success: true,
      message: 'Item statistics retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get content statistics (admin only)
router.get('/stats', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await contentService.getContentStats();
    
    res.json({
      success: true,
      message: 'Content statistics retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Create new item (admin only)
router.post('/items', validateContentUpload, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await contentService.createItem(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Update item (admin only)
router.put('/items/:itemId', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const { itemId } = req.params;
    const result = await contentService.updateItem(itemId, req.body);
    
    res.json({
      success: true,
      message: 'Item updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Delete item (admin only)
router.delete('/items/:itemId', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const { itemId } = req.params;
    const result = await contentService.deleteItem(itemId);
    
    res.json({
      success: true,
      message: 'Item deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Create news article (admin only)
router.post('/news', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await contentService.createNews(req.body);
    
    res.status(201).json({
      success: true,
      message: 'News article created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Create game event (admin only)
router.post('/events', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await contentService.createGameEvent(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Game event created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get item types
router.get('/item-types', async (req, res, next) => {
  try {
    const itemTypes = [
      'skin', 'emote', 'pickaxe', 'glider', 'wrap', 'music',
      'loading_screen', 'spray', 'banner', 'emoticon'
    ];
    
    res.json({
      success: true,
      message: 'Item types retrieved successfully',
      data: itemTypes
    });
  } catch (error) {
    next(error);
  }
});

// Get rarities
router.get('/rarities', async (req, res, next) => {
  try {
    const rarities = [
      'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'
    ];
    
    res.json({
      success: true,
      message: 'Rarities retrieved successfully',
      data: rarities
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
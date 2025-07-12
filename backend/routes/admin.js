const express = require('express');
const router = express.Router();
const securityService = require('../services/security');
const playerService = require('../services/player');
const economyService = require('../services/economy');
const contentService = require('../services/content');
const { validateBanUser, validateReportPlayer } = require('../middleware/validation');
const { adminMiddleware } = require('../middleware/auth');
const { requestLogger } = require('../middleware/logger');

// Apply request logging and admin middleware to all admin routes
router.use(requestLogger);
router.use(adminMiddleware);

// USER MANAGEMENT

// Get all users
router.get('/users', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search, status } = req.query;
    const db = require('../config/database');
    
    let query = db('users')
      .join('player_profiles', 'users.id', 'player_profiles.user_id')
      .select(
        'users.id',
        'users.username',
        'users.email',
        'users.epo_level',
        'users.vbucks',
        'users.is_premium',
        'users.is_banned',
        'users.created_at',
        'users.last_login',
        'player_profiles.display_name',
        'player_profiles.level'
      );
    
    if (search) {
      query = query.where('users.username', 'ilike', `%${search}%`);
    }
    
    if (status) {
      if (status === 'banned') {
        query = query.where('users.is_banned', true);
      } else if (status === 'active') {
        query = query.where('users.is_banned', false);
      }
    }
    
    const users = await query
      .orderBy('users.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: users
    });
  } catch (error) {
    next(error);
  }
});

// Get user by ID
router.get('/users/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const db = require('../config/database');
    
    const user = await db('users')
      .leftJoin('player_profiles', 'users.id', 'player_profiles.user_id')
      .where('users.id', userId)
      .select(
        'users.*',
        'player_profiles.display_name',
        'player_profiles.level',
        'player_profiles.experience',
        'player_profiles.wins',
        'player_profiles.kills',
        'player_profiles.deaths',
        'player_profiles.matches_played'
      )
      .first();
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// Ban user
router.post('/users/:userId/ban', validateBanUser, async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason, duration, hwid_ban } = req.body;
    
    const result = await securityService.banUser(userId, req.user.id, reason, duration, hwid_ban);
    
    res.json({
      success: true,
      message: 'User banned successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Unban user
router.post('/users/:userId/unban', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    const result = await securityService.unbanUser(userId, req.user.id, reason);
    
    res.json({
      success: true,
      message: 'User unbanned successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Award V-Bucks to user
router.post('/users/:userId/award-vbucks', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { amount, reason } = req.body;
    
    if (!amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Amount and reason are required'
      });
    }
    
    const result = await economyService.awardVBucks(userId, amount, reason);
    
    res.json({
      success: true,
      message: 'V-Bucks awarded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// SECURITY MANAGEMENT

// Get security reports
router.get('/security/reports', async (req, res, next) => {
  try {
    const { status, activity_type, severity } = req.query;
    const filters = { status, activity_type, severity };
    
    const result = await securityService.getSecurityReports(filters);
    
    res.json({
      success: true,
      message: 'Security reports retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player reports
router.get('/security/player-reports', async (req, res, next) => {
  try {
    const { status, reason } = req.query;
    const filters = { status, reason };
    
    const result = await securityService.getPlayerReports(filters);
    
    res.json({
      success: true,
      message: 'Player reports retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get ban history
router.get('/security/bans', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const bans = await db('bans')
      .join('users', 'bans.user_id', 'users.id')
      .leftJoin('users as admins', 'bans.admin_id', 'admins.id')
      .select(
        'bans.*',
        'users.username as banned_username',
        'admins.username as admin_username'
      )
      .orderBy('bans.created_at', 'desc');
    
    res.json({
      success: true,
      message: 'Ban history retrieved successfully',
      data: bans
    });
  } catch (error) {
    next(error);
  }
});

// Get security statistics
router.get('/security/stats', async (req, res, next) => {
  try {
    const result = await securityService.getSecurityStats();
    
    res.json({
      success: true,
      message: 'Security statistics retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// SYSTEM STATISTICS

// Get dashboard statistics
router.get('/dashboard/stats', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    // Get user statistics
    const userStats = await db('users')
      .select(
        db.raw('COUNT(*) as total_users'),
        db.raw('COUNT(CASE WHEN is_active = true THEN 1 END) as active_users'),
        db.raw('COUNT(CASE WHEN is_banned = true THEN 1 END) as banned_users'),
        db.raw('COUNT(CASE WHEN is_premium = true THEN 1 END) as premium_users')
      )
      .first();
    
    // Get match statistics
    const matchStats = await db('matches')
      .select(
        db.raw('COUNT(*) as total_matches'),
        db.raw('COUNT(CASE WHEN status = "in_progress" THEN 1 END) as active_matches'),
        db.raw('COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_matches')
      )
      .first();
    
    // Get economy statistics
    const economyStats = await economyService.getEconomyStats();
    
    // Get content statistics
    const contentStats = await contentService.getContentStats();
    
    res.json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        users: userStats,
        matches: matchStats,
        economy: economyStats,
        content: contentStats
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get system health
router.get('/system/health', async (req, res, next) => {
  try {
    const db = require('../config/database');
    const { client: redis } = require('../config/redis');
    
    // Check database connection
    let dbStatus = 'healthy';
    try {
      await db.raw('SELECT 1');
    } catch (error) {
      dbStatus = 'unhealthy';
    }
    
    // Check Redis connection
    let redisStatus = 'healthy';
    try {
      await redis.ping();
    } catch (error) {
      redisStatus = 'unhealthy';
    }
    
    res.json({
      success: true,
      message: 'System health checked successfully',
      data: {
        database: dbStatus,
        redis: redisStatus,
        server: 'healthy',
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
});

// CONTENT MANAGEMENT

// Get all content with admin details
router.get('/content/items', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const items = await db('items')
      .select('*')
      .orderBy('created_at', 'desc');
    
    res.json({
      success: true,
      message: 'Content items retrieved successfully',
      data: items
    });
  } catch (error) {
    next(error);
  }
});

// Create content item
router.post('/content/items', async (req, res, next) => {
  try {
    const result = await contentService.createItem(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Content item created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Update content item
router.put('/content/items/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const result = await contentService.updateItem(itemId, req.body);
    
    res.json({
      success: true,
      message: 'Content item updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Delete content item
router.delete('/content/items/:itemId', async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const result = await contentService.deleteItem(itemId);
    
    res.json({
      success: true,
      message: 'Content item deleted successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// ECONOMY MANAGEMENT

// Get economy overview
router.get('/economy/overview', async (req, res, next) => {
  try {
    const result = await economyService.getEconomyStats();
    
    res.json({
      success: true,
      message: 'Economy overview retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Force rotate item shop
router.post('/economy/shop/rotate', async (req, res, next) => {
  try {
    const result = await economyService.rotateItemShop();
    
    res.json({
      success: true,
      message: 'Item shop rotated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get all transactions
router.get('/economy/transactions', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, type, status } = req.query;
    const db = require('../config/database');
    
    let query = db('transactions')
      .join('users', 'transactions.user_id', 'users.id')
      .leftJoin('items', 'transactions.item_id', 'items.id')
      .select(
        'transactions.*',
        'users.username',
        'items.name as item_name'
      );
    
    if (type) {
      query = query.where('transactions.type', type);
    }
    
    if (status) {
      query = query.where('transactions.status', status);
    }
    
    const transactions = await query
      .orderBy('transactions.created_at', 'desc')
      .limit(limit)
      .offset((page - 1) * limit);
    
    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      data: transactions
    });
  } catch (error) {
    next(error);
  }
});

// SERVER MANAGEMENT

// Get server logs
router.get('/system/logs', async (req, res, next) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const logFile = path.join(__dirname, '..', 'logs', 'epo-combined.log');
    const logs = fs.readFileSync(logFile, 'utf8').split('\n').slice(-100); // Last 100 lines
    
    res.json({
      success: true,
      message: 'System logs retrieved successfully',
      data: logs
    });
  } catch (error) {
    next(error);
  }
});

// Execute system command (dangerous - use with caution)
router.post('/system/command', async (req, res, next) => {
  try {
    const { command } = req.body;
    
    // Only allow specific safe commands
    const allowedCommands = ['pm2 status', 'pm2 restart epo', 'pm2 logs --lines 50'];
    
    if (!allowedCommands.includes(command)) {
      return res.status(403).json({
        success: false,
        error: 'Command not allowed'
      });
    }
    
    const { exec } = require('child_process');
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }
      
      res.json({
        success: true,
        message: 'Command executed successfully',
        data: { stdout, stderr }
      });
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
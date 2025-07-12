const express = require('express');
const router = express.Router();
const playerService = require('../services/player');
const { validatePlayerUpdate, validatePagination } = require('../middleware/validation');
const { requestLogger } = require('../middleware/logger');

// Apply request logging to all player routes
router.use(requestLogger);

// Get player profile
router.get('/profile', async (req, res, next) => {
  try {
    const result = await playerService.getPlayerProfile(req.user.id);
    
    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Update player profile
router.put('/profile', validatePlayerUpdate, async (req, res, next) => {
  try {
    const result = await playerService.updatePlayerProfile(req.user.id, req.body);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player stats
router.get('/stats', async (req, res, next) => {
  try {
    const result = await playerService.getPlayerStats(req.user.id);
    
    res.json({
      success: true,
      message: 'Stats retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player inventory
router.get('/inventory', async (req, res, next) => {
  try {
    const result = await playerService.getPlayerInventory(req.user.id);
    
    res.json({
      success: true,
      message: 'Inventory retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player rank
router.get('/rank', async (req, res, next) => {
  try {
    const result = await playerService.getPlayerRank(req.user.id);
    
    res.json({
      success: true,
      message: 'Rank retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get season stats
router.get('/season-stats', async (req, res, next) => {
  try {
    const result = await playerService.getSeasonStats(req.user.id);
    
    res.json({
      success: true,
      message: 'Season stats retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get leaderboard
router.get('/leaderboard', validatePagination, async (req, res, next) => {
  try {
    const { type = 'level', limit = 100 } = req.query;
    const result = await playerService.getLeaderboard(type, limit);
    
    res.json({
      success: true,
      message: 'Leaderboard retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Search players
router.get('/search', async (req, res, next) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }
    
    const result = await playerService.searchPlayers(q, limit);
    
    res.json({
      success: true,
      message: 'Search results retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player by ID
router.get('/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const result = await playerService.getPlayerProfile(playerId);
    
    res.json({
      success: true,
      message: 'Player profile retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player stats by ID
router.get('/:playerId/stats', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const result = await playerService.getPlayerStats(playerId);
    
    res.json({
      success: true,
      message: 'Player stats retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get player friends
router.get('/friends', async (req, res, next) => {
  try {
    const result = await playerService.getPlayerFriends(req.user.id);
    
    res.json({
      success: true,
      message: 'Friends list retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Update player match stats (internal endpoint)
router.post('/match-stats', async (req, res, next) => {
  try {
    const result = await playerService.updatePlayerStats(req.user.id, req.body);
    
    res.json({
      success: true,
      message: 'Player stats updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
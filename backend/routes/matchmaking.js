const express = require('express');
const router = express.Router();
const matchmakingService = require('../services/matchmaking');
const { validateJoinQueue } = require('../middleware/validation');
const { requestLogger } = require('../middleware/logger');

// Apply request logging to all matchmaking routes
router.use(requestLogger);

// Get queue status
router.get('/queue/status', async (req, res, next) => {
  try {
    const { region, game_mode } = req.query;
    
    if (!region || !game_mode) {
      return res.status(400).json({
        success: false,
        error: 'Region and game mode are required'
      });
    }
    
    const result = await matchmakingService.getQueueStatus(region, game_mode);
    
    res.json({
      success: true,
      message: 'Queue status retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get match history
router.get('/history', async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const result = await matchmakingService.getMatchHistory(req.user.id, limit);
    
    res.json({
      success: true,
      message: 'Match history retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get active matches
router.get('/active', async (req, res, next) => {
  try {
    const result = await matchmakingService.getActiveMatches();
    
    res.json({
      success: true,
      message: 'Active matches retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get server status
router.get('/servers', async (req, res, next) => {
  try {
    const result = await matchmakingService.getServerStatus();
    
    res.json({
      success: true,
      message: 'Server status retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Update match results (internal endpoint for game servers)
router.post('/match/:matchId/results', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const results = req.body;
    
    // Verify game server authentication
    const gameServerSecret = req.header('X-Game-Server-Secret');
    if (gameServerSecret !== process.env.GAME_SERVER_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Invalid game server credentials'
      });
    }
    
    const result = await matchmakingService.updateMatchResults(matchId, results);
    
    res.json({
      success: true,
      message: 'Match results updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// End match (internal endpoint)
router.post('/match/:matchId/end', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const { reason = 'completed' } = req.body;
    
    // Verify game server authentication
    const gameServerSecret = req.header('X-Game-Server-Secret');
    if (gameServerSecret !== process.env.GAME_SERVER_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Invalid game server credentials'
      });
    }
    
    const result = await matchmakingService.endMatch(matchId, reason);
    
    res.json({
      success: true,
      message: 'Match ended successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get match details
router.get('/match/:matchId', async (req, res, next) => {
  try {
    const { matchId } = req.params;
    const db = require('../config/database');
    
    const match = await db('matches')
      .where('id', matchId)
      .first();
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }
    
    // Get match players
    const players = await db('match_players')
      .join('users', 'match_players.user_id', 'users.id')
      .where('match_players.match_id', matchId)
      .select(
        'users.username',
        'match_players.*'
      );
    
    res.json({
      success: true,
      message: 'Match details retrieved successfully',
      data: {
        ...match,
        players
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get player's current match
router.get('/current-match', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const currentMatch = await db('matches')
      .join('match_players', 'matches.id', 'match_players.match_id')
      .where('match_players.user_id', req.user.id)
      .where('matches.status', 'in_progress')
      .select('matches.*')
      .first();
    
    if (!currentMatch) {
      return res.json({
        success: true,
        message: 'No active match found',
        data: null
      });
    }
    
    res.json({
      success: true,
      message: 'Current match retrieved successfully',
      data: currentMatch
    });
  } catch (error) {
    next(error);
  }
});

// Leave current match
router.post('/leave-match', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const currentMatch = await db('matches')
      .join('match_players', 'matches.id', 'match_players.match_id')
      .where('match_players.user_id', req.user.id)
      .where('matches.status', 'in_progress')
      .select('matches.id as match_id')
      .first();
    
    if (!currentMatch) {
      return res.status(404).json({
        success: false,
        error: 'No active match found'
      });
    }
    
    await matchmakingService.handlePlayerDisconnect(currentMatch.match_id, req.user.id);
    
    res.json({
      success: true,
      message: 'Left match successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get matchmaking statistics
router.get('/stats', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const stats = await db('matches')
      .select(
        db.raw('COUNT(*) as total_matches'),
        db.raw('COUNT(CASE WHEN status = "in_progress" THEN 1 END) as active_matches'),
        db.raw('COUNT(CASE WHEN status = "completed" THEN 1 END) as completed_matches'),
        db.raw('AVG(CASE WHEN duration IS NOT NULL THEN duration END) as avg_match_duration')
      )
      .first();
    
    const gameModeStats = await db('matches')
      .select('game_mode')
      .count('* as count')
      .groupBy('game_mode');
    
    const regionStats = await db('matches')
      .select('region')
      .count('* as count')
      .groupBy('region');
    
    res.json({
      success: true,
      message: 'Matchmaking statistics retrieved successfully',
      data: {
        ...stats,
        by_game_mode: gameModeStats.reduce((acc, item) => {
          acc[item.game_mode] = parseInt(item.count);
          return acc;
        }, {}),
        by_region: regionStats.reduce((acc, item) => {
          acc[item.region] = parseInt(item.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
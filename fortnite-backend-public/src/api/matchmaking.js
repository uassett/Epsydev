const express = require('express');
const router = express.Router();
const redis = require('../utils/redis');
const { asyncHandler } = require('../middleware/error');

// POST /api/matchmaking/join - Join matchmaking queue
router.post('/join', asyncHandler(async (req, res) => {
    const { gameMode, region } = req.body;
    
    await redis.addToMatchmakingQueue(req.player.id, gameMode || 'solo', 1000);
    
    res.json({
        success: true,
        message: 'Added to matchmaking queue',
        data: {
            gameMode: gameMode || 'solo',
            region: region || 'NA-EAST',
            estimatedWait: 30
        }
    });
}));

// POST /api/matchmaking/leave - Leave matchmaking queue  
router.post('/leave', asyncHandler(async (req, res) => {
    const { gameMode } = req.body;
    
    await redis.removeFromMatchmakingQueue(req.player.id, gameMode || 'solo');
    
    res.json({
        success: true,
        message: 'Removed from matchmaking queue'
    });
}));

// GET /api/matchmaking/status - Get matchmaking status
router.get('/status', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: {
            inQueue: false,
            gameMode: null,
            estimatedWait: 0
        }
    });
}));

module.exports = router;
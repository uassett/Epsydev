const express = require('express');
const router = express.Router();
const database = require('../utils/database');
const { asyncHandler } = require('../middleware/error');

// GET /api/player/profile - Get player profile
router.get('/profile', asyncHandler(async (req, res) => {
    const player = await database.getPlayer(req.player.id);
    const wallet = await database.getPlayerWallet(req.player.id);
    const stats = await database.getPlayerStats(req.player.id);

    res.json({
        success: true,
        data: {
            profile: player,
            wallet: wallet || { vbucks: 0, gold_bars: 0 },
            stats: stats || { wins: 0, kills: 0, matches_played: 0 }
        }
    });
}));

// GET /api/player/inventory - Get player inventory
router.get('/inventory', asyncHandler(async (req, res) => {
    const inventory = await database.query(
        'SELECT * FROM player_inventory WHERE player_id = $1',
        [req.player.id]
    );

    res.json({
        success: true,
        data: inventory.rows
    });
}));

// Fortnite client compatible endpoints
router.post('/:accountId/client/:operation', asyncHandler(async (req, res) => {
    // Handle Fortnite client profile operations
    res.json({
        profileRevision: 1,
        profileId: req.params.accountId,
        profileChangesBaseRevision: 1,
        profileChanges: [],
        serverTime: new Date().toISOString(),
        responseVersion: 1
    });
}));

module.exports = router;
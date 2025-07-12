const express = require('express');
const router = express.Router();
const { loadConfig } = require('../utils/config');
const { asyncHandler } = require('../middleware/error');

// GET /api/content/news - Get game news
router.get('/news', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: {
            news: [
                {
                    id: 1,
                    title: "Welcome to the Server!",
                    content: "Enjoy your time playing on our Chapter 2 Season 5 server!",
                    type: "announcement",
                    createdAt: new Date().toISOString()
                }
            ]
        }
    });
}));

// GET /api/content/season - Get current season info
router.get('/season', asyncHandler(async (req, res) => {
    const config = loadConfig();
    
    res.json({
        success: true,
        data: {
            chapter: config.game.chapter,
            season: config.game.season,
            buildVersion: config.game.build_version,
            seasonName: "Zero Point",
            battlePassEnabled: config.features.battle_pass_enabled
        }
    });
}));

// GET /api/content/events - Get active events
router.get('/events', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        data: {
            events: []
        }
    });
}));

module.exports = router;
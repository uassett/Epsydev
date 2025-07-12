const express = require('express');
const router = express.Router();
const database = require('../utils/database');
const { gameLogger } = require('../utils/logger');
const { asyncHandler } = require('../middleware/error');

// GET /api/economy/wallet - Get player wallet
router.get('/wallet', asyncHandler(async (req, res) => {
    const wallet = await database.getPlayerWallet(req.player.id);
    
    res.json({
        success: true,
        data: wallet || { vbucks: 0, gold_bars: 0 }
    });
}));

// POST /api/economy/add-currency - Add currency (admin only)
router.post('/add-currency', asyncHandler(async (req, res) => {
    const { amount, currency, reason } = req.body;
    
    if (!req.player.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }
    
    const wallet = await database.getPlayerWallet(req.player.id);
    const newVbucks = currency === 'vbucks' ? (wallet?.vbucks || 0) + amount : (wallet?.vbucks || 0);
    const newGold = currency === 'gold_bars' ? (wallet?.gold_bars || 0) + amount : (wallet?.gold_bars || 0);
    
    await database.updatePlayerWallet(req.player.id, newVbucks, newGold);
    await database.addTransaction(req.player.id, 'admin_add', amount, currency, reason);
    
    gameLogger.economyTransaction(req.player.id, 'admin_add', amount, currency, reason);
    
    res.json({
        success: true,
        message: 'Currency added successfully'
    });
}));

// GET /api/economy/transactions - Get transaction history
router.get('/transactions', asyncHandler(async (req, res) => {
    const transactions = await database.query(
        'SELECT * FROM transactions WHERE player_id = $1 ORDER BY created_at DESC LIMIT 50',
        [req.player.id]
    );
    
    res.json({
        success: true,
        data: transactions.rows
    });
}));

module.exports = router;
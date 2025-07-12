const express = require('express');
const router = express.Router();
const economyService = require('../services/economy');
const { validateVbucksPurchase, validateItemPurchase } = require('../middleware/validation');
const { requestLogger } = require('../middleware/logger');

// Apply request logging to all economy routes
router.use(requestLogger);

// Get V-Bucks balance
router.get('/vbucks/balance', async (req, res, next) => {
  try {
    const result = await economyService.getVBucksBalance(req.user.id);
    
    res.json({
      success: true,
      message: 'V-Bucks balance retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Purchase V-Bucks
router.post('/vbucks/purchase', validateVbucksPurchase, async (req, res, next) => {
  try {
    const { package_id, payment_method, payment_token } = req.body;
    const result = await economyService.purchaseVBucks(req.user.id, package_id, payment_method, payment_token);
    
    res.json({
      success: true,
      message: 'V-Bucks purchased successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get V-Bucks packages
router.get('/vbucks/packages', async (req, res, next) => {
  try {
    const packages = [
      { id: 'starter', name: 'Starter Pack', vbucks: 1000, price: 9.99 },
      { id: 'standard', name: 'Standard Pack', vbucks: 2800, price: 19.99 },
      { id: 'deluxe', name: 'Deluxe Pack', vbucks: 5000, price: 39.99 },
      { id: 'ultimate', name: 'Ultimate Pack', vbucks: 13500, price: 99.99 }
    ];
    
    res.json({
      success: true,
      message: 'V-Bucks packages retrieved successfully',
      data: packages
    });
  } catch (error) {
    next(error);
  }
});

// Get item shop
router.get('/shop', async (req, res, next) => {
  try {
    const result = await economyService.getItemShop();
    
    res.json({
      success: true,
      message: 'Item shop retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Purchase item from shop
router.post('/shop/purchase', validateItemPurchase, async (req, res, next) => {
  try {
    const { item_id, quantity = 1 } = req.body;
    const result = await economyService.purchaseItem(req.user.id, item_id, quantity);
    
    res.json({
      success: true,
      message: 'Item purchased successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get purchase history
router.get('/history', async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;
    const result = await economyService.getPurchaseHistory(req.user.id, limit);
    
    res.json({
      success: true,
      message: 'Purchase history retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get battle pass info
router.get('/battlepass', async (req, res, next) => {
  try {
    const result = await economyService.getBattlePassInfo(req.user.id);
    
    res.json({
      success: true,
      message: 'Battle pass info retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Purchase battle pass
router.post('/battlepass/purchase', async (req, res, next) => {
  try {
    const { season_id } = req.body;
    
    if (!season_id) {
      return res.status(400).json({
        success: false,
        error: 'Season ID is required'
      });
    }
    
    const result = await economyService.purchaseBattlePass(req.user.id, season_id);
    
    res.json({
      success: true,
      message: 'Battle pass purchased successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Award V-Bucks (admin only)
router.post('/vbucks/award', async (req, res, next) => {
  try {
    const { user_id, amount, reason } = req.body;
    
    if (!user_id || !amount || !reason) {
      return res.status(400).json({
        success: false,
        error: 'User ID, amount, and reason are required'
      });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await economyService.awardVBucks(user_id, amount, reason);
    
    res.json({
      success: true,
      message: 'V-Bucks awarded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get economy statistics (admin only)
router.get('/stats', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
    const result = await economyService.getEconomyStats();
    
    res.json({
      success: true,
      message: 'Economy statistics retrieved successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Rotate item shop (admin only)
router.post('/shop/rotate', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }
    
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

// Get payment methods
router.get('/payment-methods', async (req, res, next) => {
  try {
    const paymentMethods = [
      { id: 'stripe', name: 'Credit/Debit Card', enabled: true },
      { id: 'paypal', name: 'PayPal', enabled: true }
    ];
    
    res.json({
      success: true,
      message: 'Payment methods retrieved successfully',
      data: paymentMethods
    });
  } catch (error) {
    next(error);
  }
});

// Validate payment
router.post('/payment/validate', async (req, res, next) => {
  try {
    const { payment_method, payment_token, amount } = req.body;
    
    if (!payment_method || !payment_token || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Payment method, token, and amount are required'
      });
    }
    
    // This would integrate with actual payment processors
    const isValid = true; // Mock validation
    
    res.json({
      success: true,
      message: 'Payment validated successfully',
      data: { valid: isValid }
    });
  } catch (error) {
    next(error);
  }
});

// Get transaction details
router.get('/transaction/:transactionId', async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const db = require('../config/database');
    
    const transaction = await db('transactions')
      .where('id', transactionId)
      .where('user_id', req.user.id)
      .first();
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Transaction details retrieved successfully',
      data: transaction
    });
  } catch (error) {
    next(error);
  }
});

// Get user's total spending
router.get('/spending', async (req, res, next) => {
  try {
    const db = require('../config/database');
    
    const spending = await db('transactions')
      .where('user_id', req.user.id)
      .where('currency', 'USD')
      .where('status', 'completed')
      .sum('price as total_spent')
      .first();
    
    const vbucksSpent = await db('transactions')
      .where('user_id', req.user.id)
      .where('currency', 'vbucks')
      .where('status', 'completed')
      .sum('amount as vbucks_spent')
      .first();
    
    res.json({
      success: true,
      message: 'Spending summary retrieved successfully',
      data: {
        total_spent_usd: parseFloat(spending.total_spent || 0),
        total_vbucks_spent: parseInt(vbucksSpent.vbucks_spent || 0)
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
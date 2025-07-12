const jwt = require('jsonwebtoken');
const { redisHelper } = require('../config/redis');
const db = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Access denied. No token provided.',
        code: 'EPO_AUTH_NO_TOKEN'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is blacklisted
    const blacklisted = await redisHelper.exists(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json({ 
        error: 'Token has been revoked.',
        code: 'EPO_AUTH_TOKEN_REVOKED'
      });
    }

    // Check if user exists and is active
    const user = await db('users')
      .where('id', decoded.userId)
      .where('is_active', true)
      .first();

    if (!user) {
      return res.status(401).json({ 
        error: 'User not found or inactive.',
        code: 'EPO_AUTH_USER_NOT_FOUND'
      });
    }

    // Check if user is banned
    if (user.is_banned) {
      return res.status(403).json({ 
        error: 'User account is banned.',
        code: 'EPO_AUTH_USER_BANNED',
        ban_reason: user.ban_reason,
        ban_expires: user.ban_expires
      });
    }

    // Update last activity
    await db('users')
      .where('id', user.id)
      .update({ last_activity: new Date() });

    // Store user info in request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      epo_level: user.epo_level,
      is_premium: user.is_premium,
      hwid: user.hwid
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: 'Invalid token.',
        code: 'EPO_AUTH_INVALID_TOKEN'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired.',
        code: 'EPO_AUTH_TOKEN_EXPIRED'
      });
    }

    console.error('Epo Auth Middleware Error:', error);
    res.status(500).json({ 
      error: 'Internal server error.',
      code: 'EPO_AUTH_INTERNAL_ERROR'
    });
  }
};

// Admin role middleware
const adminMiddleware = async (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Admin access required.',
      code: 'EPO_AUTH_ADMIN_REQUIRED'
    });
  }
  next();
};

// Premium middleware
const premiumMiddleware = async (req, res, next) => {
  if (!req.user.is_premium) {
    return res.status(403).json({ 
      error: 'Premium subscription required.',
      code: 'EPO_AUTH_PREMIUM_REQUIRED'
    });
  }
  next();
};

// Rate limiting middleware for authenticated users
const authRateLimit = async (req, res, next) => {
  const key = `rate_limit:${req.user.id}`;
  const limit = req.user.is_premium ? 1000 : 100; // Premium users get higher limits
  const window = 60 * 60; // 1 hour window
  
  const current = await redisHelper.incr(key);
  
  if (current === 1) {
    await redisHelper.setex(key, window, current);
  }
  
  if (current > limit) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded.',
      code: 'EPO_AUTH_RATE_LIMIT'
    });
  }
  
  next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
module.exports.premiumMiddleware = premiumMiddleware;
module.exports.authRateLimit = authRateLimit;
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'epo-backend' },
  transports: [
    new winston.transports.File({ 
      filename: 'logs/epo-error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: 'logs/epo-combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Request logging middleware
const requestLogger = (req, res, next) => {
  // Generate request ID
  const requestId = uuidv4();
  req.requestId = requestId;
  
  // Start timer
  const startTime = Date.now();
  
  // Log request
  logger.info({
    type: 'request',
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
    userId: req.user?.id || null
  });
  
  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info({
      type: 'response',
      requestId,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || null,
      responseSize: JSON.stringify(data).length
    });
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logger.info({
      type: 'response_finish',
      requestId,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
      userId: req.user?.id || null
    });
  });
  
  next();
};

// Error logging middleware
const errorLogger = (error, req, res, next) => {
  logger.error({
    type: 'error',
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    userId: req.user?.id || null,
    timestamp: new Date().toISOString()
  });
  
  next(error);
};

// Security event logger
const securityLogger = {
  loginAttempt: (username, ip, success, reason = null) => {
    logger.info({
      type: 'security_login_attempt',
      username,
      ip,
      success,
      reason,
      timestamp: new Date().toISOString()
    });
  },
  
  suspiciousActivity: (userId, activity, details) => {
    logger.warn({
      type: 'security_suspicious_activity',
      userId,
      activity,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  antiCheatTrigger: (userId, cheatType, details) => {
    logger.warn({
      type: 'security_anticheat_trigger',
      userId,
      cheatType,
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  banAction: (adminId, targetUserId, reason, duration) => {
    logger.info({
      type: 'security_ban_action',
      adminId,
      targetUserId,
      reason,
      duration,
      timestamp: new Date().toISOString()
    });
  }
};

// Game event logger
const gameLogger = {
  matchStart: (matchId, players) => {
    logger.info({
      type: 'game_match_start',
      matchId,
      playerCount: players.length,
      players,
      timestamp: new Date().toISOString()
    });
  },
  
  matchEnd: (matchId, winner, duration, stats) => {
    logger.info({
      type: 'game_match_end',
      matchId,
      winner,
      duration,
      stats,
      timestamp: new Date().toISOString()
    });
  },
  
  playerJoin: (userId, matchId) => {
    logger.info({
      type: 'game_player_join',
      userId,
      matchId,
      timestamp: new Date().toISOString()
    });
  },
  
  playerLeave: (userId, matchId, reason) => {
    logger.info({
      type: 'game_player_leave',
      userId,
      matchId,
      reason,
      timestamp: new Date().toISOString()
    });
  }
};

// Economy event logger
const economyLogger = {
  purchase: (userId, itemId, price, currency) => {
    logger.info({
      type: 'economy_purchase',
      userId,
      itemId,
      price,
      currency,
      timestamp: new Date().toISOString()
    });
  },
  
  vbucksTransaction: (userId, amount, type, details) => {
    logger.info({
      type: 'economy_vbucks_transaction',
      userId,
      amount,
      type, // 'purchase', 'reward', 'spend'
      details,
      timestamp: new Date().toISOString()
    });
  },
  
  premiumSubscription: (userId, action, plan) => {
    logger.info({
      type: 'economy_premium_subscription',
      userId,
      action, // 'subscribe', 'cancel', 'renew'
      plan,
      timestamp: new Date().toISOString()
    });
  }
};

module.exports = {
  logger,
  requestLogger,
  errorLogger,
  securityLogger,
  gameLogger,
  economyLogger
};
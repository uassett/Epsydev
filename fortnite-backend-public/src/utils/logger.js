const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
        
        if (stack) {
            logMessage += `\n${stack}`;
        }
        
        if (Object.keys(meta).length > 0) {
            logMessage += `\n${JSON.stringify(meta, null, 2)}`;
        }
        
        return logMessage;
    })
);

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
        let logMessage = `${timestamp} ${level} ${message}`;
        if (stack) {
            logMessage += `\n${stack}`;
        }
        return logMessage;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: logFormat,
    defaultMeta: { 
        service: 'fortnite-backend',
        version: '1.0.0'
    },
    transports: [
        // Console transport
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
        }),

        // File transport for all logs
        new DailyRotateFile({
            filename: path.join(logsDir, 'application-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '14d',
            level: 'info'
        }),

        // Separate file for errors
        new DailyRotateFile({
            filename: path.join(logsDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            level: 'error'
        }),

        // Game-specific logs
        new DailyRotateFile({
            filename: path.join(logsDir, 'game-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '7d',
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            )
        })
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log') 
        })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'rejections.log') 
        })
    ],

    exitOnError: false
});

// Game-specific logging functions
const gameLogger = {
    playerLogin: (playerId, username, ip) => {
        logger.info('Player login', {
            type: 'player_login',
            playerId,
            username,
            ip,
            timestamp: new Date().toISOString()
        });
    },

    playerLogout: (playerId, username, sessionDuration) => {
        logger.info('Player logout', {
            type: 'player_logout',
            playerId,
            username,
            sessionDuration,
            timestamp: new Date().toISOString()
        });
    },

    itemShopPurchase: (playerId, itemId, price, currency) => {
        logger.info('Item shop purchase', {
            type: 'item_purchase',
            playerId,
            itemId,
            price,
            currency,
            timestamp: new Date().toISOString()
        });
    },

    matchStart: (matchId, playersCount, gameMode) => {
        logger.info('Match started', {
            type: 'match_start',
            matchId,
            playersCount,
            gameMode,
            timestamp: new Date().toISOString()
        });
    },

    matchEnd: (matchId, duration, winner, playersCount) => {
        logger.info('Match ended', {
            type: 'match_end',
            matchId,
            duration,
            winner,
            playersCount,
            timestamp: new Date().toISOString()
        });
    },

    economyTransaction: (playerId, type, amount, currency, reason) => {
        logger.info('Economy transaction', {
            type: 'economy_transaction',
            playerId,
            transactionType: type,
            amount,
            currency,
            reason,
            timestamp: new Date().toISOString()
        });
    },

    security: (type, playerId, details, severity = 'medium') => {
        logger.warn('Security event', {
            type: 'security_event',
            eventType: type,
            playerId,
            details,
            severity,
            timestamp: new Date().toISOString()
        });
    },

    performance: (endpoint, responseTime, statusCode) => {
        logger.info('API performance', {
            type: 'api_performance',
            endpoint,
            responseTime,
            statusCode,
            timestamp: new Date().toISOString()
        });
    }
};

// Middleware for request logging
const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: duration,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent')
        };

        if (res.statusCode >= 400) {
            logger.warn('HTTP request error', logData);
        } else {
            logger.info('HTTP request', logData);
        }

        // Log slow requests
        if (duration > 1000) {
            logger.warn('Slow request detected', { ...logData, slow: true });
        }
    });

    next();
};

module.exports = {
    logger,
    gameLogger,
    requestLogger
};
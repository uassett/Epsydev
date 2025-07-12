const jwt = require('jsonwebtoken');
const { loadConfig } = require('../utils/config');
const database = require('../utils/database');
const redis = require('../utils/redis');
const { logger, gameLogger } = require('../utils/logger');

const config = loadConfig();

// Authentication middleware
const authMiddleware = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                success: false,
                error: 'No authorization header provided'
            });
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'No token provided'
            });
        }

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, config.security.jwt_secret);
        } catch (error) {
            return res.status(401).json({
                success: false,
                error: 'Invalid token'
            });
        }

        // Check if session exists in Redis
        const sessionData = await redis.getSession(decoded.sessionId);
        if (!sessionData) {
            return res.status(401).json({
                success: false,
                error: 'Session expired'
            });
        }

        // Get player data from database
        const player = await database.getPlayer(decoded.playerId);
        if (!player) {
            return res.status(401).json({
                success: false,
                error: 'Player not found'
            });
        }

        // Check if player is banned
        if (player.banned) {
            return res.status(403).json({
                success: false,
                error: 'Player is banned',
                banReason: player.ban_reason
            });
        }

        // Refresh session
        await redis.refreshSession(decoded.sessionId);

        // Add player info to request
        req.player = {
            id: player.id,
            username: player.username,
            displayName: player.display_name,
            email: player.email,
            isAdmin: player.is_admin || false,
            sessionId: decoded.sessionId
        };

        next();
    } catch (error) {
        logger.error('Authentication middleware error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication error'
        });
    }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            req.player = null;
            return next();
        }

        const token = authHeader.startsWith('Bearer ') 
            ? authHeader.slice(7) 
            : authHeader;

        if (!token) {
            req.player = null;
            return next();
        }

        const decoded = jwt.verify(token, config.security.jwt_secret);
        const sessionData = await redis.getSession(decoded.sessionId);
        
        if (sessionData) {
            const player = await database.getPlayer(decoded.playerId);
            if (player && !player.banned) {
                req.player = {
                    id: player.id,
                    username: player.username,
                    displayName: player.display_name,
                    isAdmin: player.is_admin || false,
                    sessionId: decoded.sessionId
                };
                await redis.refreshSession(decoded.sessionId);
            }
        }

        next();
    } catch (error) {
        // Don't fail on optional auth errors
        req.player = null;
        next();
    }
};

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
    if (!req.player) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }

    if (!req.player.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Admin access required'
        });
    }

    next();
};

// Rate limiting middleware
const rateLimitMiddleware = (limit = 100, window = 3600) => {
    return async (req, res, next) => {
        try {
            const identifier = req.ip || 'unknown';
            const allowed = await redis.checkRateLimit(identifier, limit, window);
            
            if (!allowed) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded'
                });
            }
            
            next();
        } catch (error) {
            // Allow on error to avoid blocking legitimate requests
            next();
        }
    };
};

// Player status middleware (sets player online)
const playerStatusMiddleware = async (req, res, next) => {
    if (req.player) {
        await redis.setPlayerOnline(req.player.id, config.server.region);
    }
    next();
};

module.exports = {
    authMiddleware,
    optionalAuthMiddleware,
    adminMiddleware,
    rateLimitMiddleware,
    playerStatusMiddleware
};
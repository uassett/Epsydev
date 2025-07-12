const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const router = express.Router();

const { loadConfig } = require('../utils/config');
const database = require('../utils/database');
const redis = require('../utils/redis');
const { logger, gameLogger } = require('../utils/logger');
const { authMiddleware, rateLimitMiddleware } = require('../middleware/auth');
const { asyncHandler, ValidationError } = require('../middleware/error');

const config = loadConfig();

// Validation schemas
const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    displayName: Joi.string().min(1).max(50).optional()
});

const loginSchema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required()
});

// POST /api/auth/register - Register a new player
router.post('/register', rateLimitMiddleware(5, 3600), asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
        throw new ValidationError('Invalid registration data', error.details);
    }

    const { username, email, password, displayName } = value;

    // Check if username already exists
    const existingUser = await database.getPlayerByUsername(username);
    if (existingUser) {
        return res.status(400).json({
            success: false,
            error: 'Username already exists'
        });
    }

    // Check if email already exists
    const existingEmail = await database.query(
        'SELECT id FROM players WHERE email = $1',
        [email]
    );
    if (existingEmail.rows.length > 0) {
        return res.status(400).json({
            success: false,
            error: 'Email already exists'
        });
    }

    // Hash password
    const saltRounds = config.security.bcrypt_rounds;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create player
    const playerData = {
        username,
        email,
        password_hash: passwordHash,
        display_name: displayName || username
    };

    const newPlayer = await database.createPlayer(playerData);

    // Initialize player wallet
    await database.updatePlayerWallet(
        newPlayer.id, 
        config.itemshop.currency.starter_vbucks || 800,
        config.itemshop.currency.starter_gold_bars || 1000
    );

    // Log registration
    gameLogger.playerLogin(newPlayer.id, username, req.ip);

    res.status(201).json({
        success: true,
        message: 'Player registered successfully',
        data: {
            id: newPlayer.id,
            username: newPlayer.username,
            displayName: newPlayer.display_name,
            email: newPlayer.email
        }
    });
}));

// POST /api/auth/login - Player login
router.post('/login', rateLimitMiddleware(10, 3600), asyncHandler(async (req, res) => {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
        throw new ValidationError('Invalid login data', error.details);
    }

    const { username, password } = value;

    // Get player by username
    const player = await database.getPlayerByUsername(username);
    if (!player) {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }

    // Check if player is banned
    if (player.banned) {
        return res.status(403).json({
            success: false,
            error: 'Account is banned',
            banReason: player.ban_reason
        });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, player.password_hash);
    if (!passwordValid) {
        return res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }

    // Create session
    const sessionId = uuidv4();
    const sessionData = {
        playerId: player.id,
        username: player.username,
        loginTime: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };

    // Store session in Redis
    await redis.createSession(sessionId, sessionData, 86400); // 24 hours

    // Generate JWT token
    const tokenPayload = {
        playerId: player.id,
        sessionId: sessionId
    };

    const token = jwt.sign(tokenPayload, config.security.jwt_secret, {
        expiresIn: config.security.jwt_expires_in
    });

    // Update last login
    await database.updatePlayerLastLogin(player.id);

    // Set player online
    await redis.setPlayerOnline(player.id, config.server.region);

    // Log login
    gameLogger.playerLogin(player.id, username, req.ip);

    res.json({
        success: true,
        message: 'Login successful',
        data: {
            token,
            player: {
                id: player.id,
                username: player.username,
                displayName: player.display_name,
                email: player.email
            },
            expiresIn: config.security.jwt_expires_in
        }
    });
}));

// POST /api/auth/logout - Player logout
router.post('/logout', authMiddleware, asyncHandler(async (req, res) => {
    // Delete session
    await redis.deleteSession(req.player.sessionId);
    
    // Set player offline
    await redis.setPlayerOffline(req.player.id);

    // Log logout
    gameLogger.playerLogout(req.player.id, req.player.username, 0);

    res.json({
        success: true,
        message: 'Logout successful'
    });
}));

// GET /api/auth/me - Get current player info
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
    // Get full player data
    const player = await database.getPlayer(req.player.id);
    const wallet = await database.getPlayerWallet(req.player.id);
    const stats = await database.getPlayerStats(req.player.id);

    res.json({
        success: true,
        data: {
            id: player.id,
            username: player.username,
            displayName: player.display_name,
            email: player.email,
            createdAt: player.created_at,
            lastLogin: player.last_login,
            wallet: wallet || { vbucks: 0, gold_bars: 0 },
            stats: stats || { wins: 0, kills: 0, matches_played: 0, playtime: 0 }
        }
    });
}));

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authMiddleware, asyncHandler(async (req, res) => {
    // Generate new token with same session
    const tokenPayload = {
        playerId: req.player.id,
        sessionId: req.player.sessionId
    };

    const newToken = jwt.sign(tokenPayload, config.security.jwt_secret, {
        expiresIn: config.security.jwt_expires_in
    });

    // Refresh session in Redis
    await redis.refreshSession(req.player.sessionId);

    res.json({
        success: true,
        data: {
            token: newToken,
            expiresIn: config.security.jwt_expires_in
        }
    });
}));

// POST /api/auth/change-password - Change password
router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            error: 'Current password and new password are required'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            error: 'New password must be at least 6 characters'
        });
    }

    // Get current player
    const player = await database.getPlayer(req.player.id);

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, player.password_hash);
    if (!passwordValid) {
        return res.status(401).json({
            success: false,
            error: 'Current password is incorrect'
        });
    }

    // Hash new password
    const saltRounds = config.security.bcrypt_rounds;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await database.query(
        'UPDATE players SET password_hash = $1 WHERE id = $2',
        [newPasswordHash, req.player.id]
    );

    res.json({
        success: true,
        message: 'Password changed successfully'
    });
}));

// GET /api/auth/sessions - Get active sessions
router.get('/sessions', authMiddleware, asyncHandler(async (req, res) => {
    // This would get all active sessions for the player
    // For now, just return current session
    const sessionData = await redis.getSession(req.player.sessionId);
    
    res.json({
        success: true,
        data: {
            currentSession: sessionData,
            activeSessions: [sessionData] // In a real implementation, you'd track multiple sessions
        }
    });
}));

// DELETE /api/auth/sessions/:sessionId - Revoke a session
router.delete('/sessions/:sessionId', authMiddleware, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    
    // Only allow users to revoke their own sessions (or admins to revoke any)
    if (sessionId !== req.player.sessionId && !req.player.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Cannot revoke other users sessions'
        });
    }

    await redis.deleteSession(sessionId);

    res.json({
        success: true,
        message: 'Session revoked successfully'
    });
}));

// Fortnite client compatible endpoints
// POST /fortnite/api/oauth/token - Fortnite client login endpoint
router.post('/oauth/token', rateLimitMiddleware(20, 3600), asyncHandler(async (req, res) => {
    const { username, password, grant_type } = req.body;

    if (grant_type !== 'password') {
        return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only password grant type is supported'
        });
    }

    // Use same login logic as regular API
    const player = await database.getPlayerByUsername(username);
    if (!player || !(await bcrypt.compare(password, player.password_hash))) {
        return res.status(401).json({
            error: 'invalid_grant',
            error_description: 'Invalid username or password'
        });
    }

    if (player.banned) {
        return res.status(403).json({
            error: 'access_denied',
            error_description: 'Account is banned'
        });
    }

    // Create session and token
    const sessionId = uuidv4();
    const sessionData = {
        playerId: player.id,
        username: player.username,
        loginTime: new Date().toISOString(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };

    await redis.createSession(sessionId, sessionData, 86400);

    const token = jwt.sign({ playerId: player.id, sessionId }, config.security.jwt_secret, {
        expiresIn: '24h'
    });

    await database.updatePlayerLastLogin(player.id);
    await redis.setPlayerOnline(player.id, config.server.region);
    gameLogger.playerLogin(player.id, username, req.ip);

    // Return in Fortnite client format
    res.json({
        access_token: token,
        expires_in: 86400,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        token_type: 'bearer',
        refresh_token: token, // Simplified - same as access token
        refresh_expires: 86400,
        refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
        account_id: player.id,
        client_id: 'fortnite',
        internal_client: true,
        client_service: 'fortnite'
    });
}));

module.exports = router;
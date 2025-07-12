const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

// Import services and utilities
const { logger } = require('./utils/logger');
const { loadConfig } = require('./utils/config');
const database = require('./utils/database');
const redis = require('./utils/redis');

// Import route handlers
const authRoutes = require('./api/auth');
const playerRoutes = require('./api/player');
const economyRoutes = require('./api/economy');
const itemShopRoutes = require('./api/itemshop');
const matchmakingRoutes = require('./api/matchmaking');
const contentRoutes = require('./api/content');

// Import middleware
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error');

class FortniteBackend {
    constructor() {
        this.app = express();
        this.config = loadConfig();
        this.server = null;
        this.io = null;
    }

    async initialize() {
        try {
            // Load configuration
            logger.info('Loading server configuration...');
            
            // Initialize database and Redis
            await database.connect(this.config.database);
            await redis.connect(this.config.redis);
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();
            
            // Setup Socket.IO for real-time features
            this.setupSocketIO();
            
            // Start scheduled tasks (item shop rotation, etc.)
            this.setupScheduledTasks();
            
            logger.info('Backend initialization completed successfully');
            
        } catch (error) {
            logger.error('Failed to initialize backend:', error);
            process.exit(1);
        }
    }

    setupMiddleware() {
        // Security middleware
        this.app.use(helmet());
        
        // CORS configuration
        this.app.use(cors({
            origin: this.config.security.cors.origins,
            credentials: true
        }));
        
        // Rate limiting
        if (this.config.security.rate_limit.enabled) {
            const limiter = rateLimit({
                windowMs: this.config.security.rate_limit.window_ms,
                max: this.config.security.rate_limit.max_requests,
                message: 'Too many requests from this IP'
            });
            this.app.use(limiter);
        }
        
        // Compression and parsing
        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Logging
        this.app.use(morgan('combined', { 
            stream: { write: message => logger.info(message.trim()) }
        }));
        
        // Static files (for item shop images, etc.)
        this.app.use('/static', express.static(path.join(__dirname, '../public')));
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: this.config.server.version,
                uptime: process.uptime()
            });
        });

        // API routes
        this.app.use('/api/auth', authRoutes);
        this.app.use('/api/player', authMiddleware, playerRoutes);
        this.app.use('/api/economy', authMiddleware, economyRoutes);
        this.app.use('/api/itemshop', itemShopRoutes);
        this.app.use('/api/matchmaking', authMiddleware, matchmakingRoutes);
        this.app.use('/api/content', contentRoutes);

        // Fortnite client endpoints (compatible with game client)
        this.app.use('/fortnite/api/game/v2/profile', authMiddleware, playerRoutes);
        this.app.use('/fortnite/api/storefront/v2', itemShopRoutes);
        this.app.use('/fortnite/api/matchmaking', authMiddleware, matchmakingRoutes);

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Endpoint not found',
                message: `Cannot ${req.method} ${req.originalUrl}`
            });
        });
    }

    setupErrorHandling() {
        this.app.use(errorHandler);
    }

    setupSocketIO() {
        const { Server } = require('socket.io');
        
        this.io = new Server(this.server, {
            cors: {
                origin: this.config.security.cors.origins,
                methods: ["GET", "POST"]
            }
        });

        // Handle real-time connections for matchmaking, friends, etc.
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);
            
            socket.on('join_lobby', (data) => {
                // Handle lobby joining
                socket.join(`lobby_${data.lobbyId}`);
            });
            
            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }

    setupScheduledTasks() {
        const cron = require('cron');
        const ItemShopService = require('./economy/itemshop');
        
        // Item shop rotation (daily at midnight UTC)
        new cron.CronJob('0 0 * * *', async () => {
            try {
                logger.info('Running daily item shop rotation...');
                await ItemShopService.rotateItemShop();
                logger.info('Item shop rotation completed');
            } catch (error) {
                logger.error('Item shop rotation failed:', error);
            }
        }, null, true, 'UTC');
        
        // Player statistics cleanup (weekly)
        new cron.CronJob('0 2 * * 0', async () => {
            try {
                logger.info('Running weekly statistics cleanup...');
                // Cleanup old statistics, logs, etc.
                logger.info('Statistics cleanup completed');
            } catch (error) {
                logger.error('Statistics cleanup failed:', error);
            }
        }, null, true, 'UTC');
    }

    async start() {
        const port = this.config.server.port || 3000;
        const host = this.config.server.host || '0.0.0.0';
        
        this.server = this.app.listen(port, host, () => {
            logger.info(`🚀 Fortnite Backend Server started on ${host}:${port}`);
            logger.info(`🛒 Item Shop: ${this.config.features.item_shop_enabled ? 'Enabled' : 'Disabled'}`);
            logger.info(`🎮 Game Mode: Chapter ${this.config.game.chapter} Season ${this.config.game.season}`);
            logger.info(`🌍 Region: ${this.config.server.region}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    async shutdown() {
        logger.info('Shutting down server...');
        
        if (this.server) {
            this.server.close();
        }
        
        await database.disconnect();
        await redis.disconnect();
        
        logger.info('Server shutdown completed');
        process.exit(0);
    }
}

// Start the server
const backend = new FortniteBackend();

(async () => {
    await backend.initialize();
    await backend.start();
})().catch((error) => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});

module.exports = backend;
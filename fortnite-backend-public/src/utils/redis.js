const redis = require('redis');
const { logger } = require('./logger');

class RedisManager {
    constructor() {
        this.client = null;
        this.connected = false;
    }

    async connect(config) {
        try {
            this.client = redis.createClient({
                host: config.host,
                port: config.port,
                password: config.password || undefined,
                db: config.db,
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        logger.error('Redis connection refused');
                        return new Error('Redis connection refused');
                    }
                    if (options.times_connected > 10) {
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.client.on('connect', () => {
                logger.info('Redis client connected');
                this.connected = true;
            });

            this.client.on('error', (err) => {
                logger.error('Redis client error:', err);
                this.connected = false;
            });

            this.client.on('ready', () => {
                logger.info('Redis client ready');
            });

            this.client.on('end', () => {
                logger.info('Redis client disconnected');
                this.connected = false;
            });

            await this.client.connect();
            
        } catch (error) {
            logger.error('Redis connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.client && this.connected) {
            await this.client.quit();
            this.connected = false;
            logger.info('Redis disconnected');
        }
    }

    // Generic cache operations
    async get(key) {
        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis GET error:', { key, error: error.message });
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        try {
            await this.client.setEx(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            logger.error('Redis SET error:', { key, error: error.message });
            return false;
        }
    }

    async del(key) {
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Redis DEL error:', { key, error: error.message });
            return false;
        }
    }

    async exists(key) {
        try {
            return await this.client.exists(key);
        } catch (error) {
            logger.error('Redis EXISTS error:', { key, error: error.message });
            return false;
        }
    }

    // Session management
    async createSession(sessionId, playerData, ttl = 86400) {
        const sessionKey = `session:${sessionId}`;
        return await this.set(sessionKey, playerData, ttl);
    }

    async getSession(sessionId) {
        const sessionKey = `session:${sessionId}`;
        return await this.get(sessionKey);
    }

    async deleteSession(sessionId) {
        const sessionKey = `session:${sessionId}`;
        return await this.del(sessionKey);
    }

    async refreshSession(sessionId, ttl = 86400) {
        const sessionKey = `session:${sessionId}`;
        try {
            await this.client.expire(sessionKey, ttl);
            return true;
        } catch (error) {
            logger.error('Redis session refresh error:', { sessionId, error: error.message });
            return false;
        }
    }

    // Item shop caching
    async cacheItemShop(itemShopData, ttl = 86400) {
        return await this.set('itemshop:current', itemShopData, ttl);
    }

    async getCachedItemShop() {
        return await this.get('itemshop:current');
    }

    async invalidateItemShop() {
        return await this.del('itemshop:current');
    }

    // Player online status
    async setPlayerOnline(playerId, serverRegion = 'NA-EAST') {
        const key = `player:online:${playerId}`;
        const data = {
            playerId,
            serverRegion,
            timestamp: Date.now()
        };
        return await this.set(key, data, 300); // 5 minutes TTL
    }

    async setPlayerOffline(playerId) {
        const key = `player:online:${playerId}`;
        return await this.del(key);
    }

    async isPlayerOnline(playerId) {
        const key = `player:online:${playerId}`;
        return await this.exists(key);
    }

    async getOnlinePlayerCount() {
        try {
            const keys = await this.client.keys('player:online:*');
            return keys.length;
        } catch (error) {
            logger.error('Redis online count error:', error);
            return 0;
        }
    }

    // Matchmaking queue
    async addToMatchmakingQueue(playerId, gameMode, skillLevel = 1000) {
        const queueKey = `queue:${gameMode}`;
        const playerData = {
            playerId,
            skillLevel,
            joinedAt: Date.now()
        };
        
        try {
            await this.client.zAdd(queueKey, {
                score: Date.now(),
                value: JSON.stringify(playerData)
            });
            return true;
        } catch (error) {
            logger.error('Redis queue add error:', { playerId, gameMode, error: error.message });
            return false;
        }
    }

    async removeFromMatchmakingQueue(playerId, gameMode) {
        const queueKey = `queue:${gameMode}`;
        try {
            // Find and remove the player from the queue
            const members = await this.client.zRange(queueKey, 0, -1);
            for (const member of members) {
                const playerData = JSON.parse(member);
                if (playerData.playerId === playerId) {
                    await this.client.zRem(queueKey, member);
                    return true;
                }
            }
            return false;
        } catch (error) {
            logger.error('Redis queue remove error:', { playerId, gameMode, error: error.message });
            return false;
        }
    }

    async getMatchmakingQueue(gameMode, limit = 100) {
        const queueKey = `queue:${gameMode}`;
        try {
            const members = await this.client.zRange(queueKey, 0, limit - 1);
            return members.map(member => JSON.parse(member));
        } catch (error) {
            logger.error('Redis queue get error:', { gameMode, error: error.message });
            return [];
        }
    }

    // Rate limiting
    async checkRateLimit(identifier, limit = 100, window = 3600) {
        const key = `ratelimit:${identifier}`;
        try {
            const current = await this.client.incr(key);
            if (current === 1) {
                await this.client.expire(key, window);
            }
            return current <= limit;
        } catch (error) {
            logger.error('Redis rate limit error:', { identifier, error: error.message });
            return true; // Allow on error
        }
    }

    // Leaderboards
    async updateLeaderboard(leaderboardName, playerId, score) {
        const key = `leaderboard:${leaderboardName}`;
        try {
            await this.client.zAdd(key, {
                score: score,
                value: playerId
            });
            return true;
        } catch (error) {
            logger.error('Redis leaderboard update error:', { leaderboardName, playerId, error: error.message });
            return false;
        }
    }

    async getLeaderboard(leaderboardName, start = 0, end = 9) {
        const key = `leaderboard:${leaderboardName}`;
        try {
            const results = await this.client.zRevRangeWithScores(key, start, end);
            return results.map((result, index) => ({
                rank: start + index + 1,
                playerId: result.value,
                score: result.score
            }));
        } catch (error) {
            logger.error('Redis leaderboard get error:', { leaderboardName, error: error.message });
            return [];
        }
    }

    // Server status
    async updateServerStatus(region, status) {
        const key = `server:status:${region}`;
        const data = {
            region,
            status,
            timestamp: Date.now(),
            playerCount: await this.getOnlinePlayerCount()
        };
        return await this.set(key, data, 60); // 1 minute TTL
    }

    async getServerStatus(region) {
        const key = `server:status:${region}`;
        return await this.get(key);
    }

    // Health check
    async healthCheck() {
        try {
            await this.client.ping();
            return { status: 'healthy', connected: this.connected };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

const redisManager = new RedisManager();

module.exports = redisManager;
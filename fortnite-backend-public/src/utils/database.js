const { Pool } = require('pg');
const { logger } = require('./logger');

class Database {
    constructor() {
        this.pool = null;
        this.connected = false;
    }

    async connect(config) {
        try {
            this.pool = new Pool({
                host: config.host,
                port: config.port,
                database: config.name,
                user: config.username,
                password: config.password,
                ssl: config.ssl,
                min: config.pool.min,
                max: config.pool.max,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            });

            // Test the connection
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();

            this.connected = true;
            logger.info('Database connected successfully');
            
            // Setup error handling
            this.pool.on('error', (err) => {
                logger.error('Database pool error:', err);
                this.connected = false;
            });

        } catch (error) {
            logger.error('Database connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.pool) {
            await this.pool.end();
            this.connected = false;
            logger.info('Database disconnected');
        }
    }

    async query(text, params = []) {
        if (!this.connected) {
            throw new Error('Database not connected');
        }

        const start = Date.now();
        try {
            const res = await this.pool.query(text, params);
            const duration = Date.now() - start;
            
            if (duration > 1000) {
                logger.warn('Slow query detected', { 
                    query: text, 
                    duration, 
                    params: params.length 
                });
            }
            
            return res;
        } catch (error) {
            logger.error('Database query error:', { 
                error: error.message, 
                query: text, 
                params 
            });
            throw error;
        }
    }

    async transaction(callback) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    // Player-related queries
    async getPlayer(playerId) {
        const result = await this.query(
            'SELECT * FROM players WHERE id = $1',
            [playerId]
        );
        return result.rows[0];
    }

    async getPlayerByUsername(username) {
        const result = await this.query(
            'SELECT * FROM players WHERE username = $1',
            [username]
        );
        return result.rows[0];
    }

    async createPlayer(playerData) {
        const { username, email, password_hash, display_name } = playerData;
        const result = await this.query(
            `INSERT INTO players (username, email, password_hash, display_name, created_at, last_login)
             VALUES ($1, $2, $3, $4, NOW(), NOW())
             RETURNING *`,
            [username, email, password_hash, display_name]
        );
        return result.rows[0];
    }

    async updatePlayerLastLogin(playerId) {
        await this.query(
            'UPDATE players SET last_login = NOW() WHERE id = $1',
            [playerId]
        );
    }

    // Economy-related queries
    async getPlayerWallet(playerId) {
        const result = await this.query(
            'SELECT vbucks, gold_bars FROM player_wallets WHERE player_id = $1',
            [playerId]
        );
        return result.rows[0];
    }

    async updatePlayerWallet(playerId, vbucks, goldBars) {
        await this.query(
            `INSERT INTO player_wallets (player_id, vbucks, gold_bars, updated_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (player_id)
             DO UPDATE SET vbucks = $2, gold_bars = $3, updated_at = NOW()`,
            [playerId, vbucks, goldBars]
        );
    }

    async addTransaction(playerId, type, amount, currency, reason) {
        await this.query(
            `INSERT INTO transactions (player_id, transaction_type, amount, currency, reason, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [playerId, type, amount, currency, reason]
        );
    }

    // Item Shop queries
    async getCurrentItemShop() {
        const result = await this.query(
            `SELECT * FROM item_shop 
             WHERE is_active = true 
             ORDER BY section, display_order`
        );
        return result.rows;
    }

    async purchaseItem(playerId, itemId, price, currency) {
        return await this.transaction(async (client) => {
            // Check player wallet
            const walletResult = await client.query(
                'SELECT vbucks, gold_bars FROM player_wallets WHERE player_id = $1',
                [playerId]
            );
            
            if (!walletResult.rows[0]) {
                throw new Error('Player wallet not found');
            }

            const wallet = walletResult.rows[0];
            const currentBalance = currency === 'vbucks' ? wallet.vbucks : wallet.gold_bars;

            if (currentBalance < price) {
                throw new Error('Insufficient funds');
            }

            // Deduct currency
            const newBalance = currentBalance - price;
            if (currency === 'vbucks') {
                await client.query(
                    'UPDATE player_wallets SET vbucks = $1, updated_at = NOW() WHERE player_id = $2',
                    [newBalance, playerId]
                );
            } else {
                await client.query(
                    'UPDATE player_wallets SET gold_bars = $1, updated_at = NOW() WHERE player_id = $2',
                    [newBalance, playerId]
                );
            }

            // Add item to inventory
            await client.query(
                `INSERT INTO player_inventory (player_id, item_id, acquired_at)
                 VALUES ($1, $2, NOW())`,
                [playerId, itemId]
            );

            // Record transaction
            await client.query(
                `INSERT INTO transactions (player_id, transaction_type, amount, currency, reason, created_at)
                 VALUES ($1, 'purchase', $2, $3, $4, NOW())`,
                [playerId, -price, currency, `Item purchase: ${itemId}`]
            );

            return { success: true, newBalance };
        });
    }

    // Statistics and analytics
    async getPlayerStats(playerId) {
        const result = await this.query(
            'SELECT * FROM player_stats WHERE player_id = $1',
            [playerId]
        );
        return result.rows[0];
    }

    async updatePlayerStats(playerId, stats) {
        const { wins, kills, matches_played, playtime } = stats;
        await this.query(
            `INSERT INTO player_stats (player_id, wins, kills, matches_played, playtime, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (player_id)
             DO UPDATE SET 
                wins = player_stats.wins + $2,
                kills = player_stats.kills + $3,
                matches_played = player_stats.matches_played + $4,
                playtime = player_stats.playtime + $5,
                updated_at = NOW()`,
            [playerId, wins, kills, matches_played, playtime]
        );
    }

    // Health check
    async healthCheck() {
        try {
            await this.query('SELECT 1');
            return { status: 'healthy', connected: this.connected };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

const database = new Database();

module.exports = database;
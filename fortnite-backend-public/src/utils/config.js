const fs = require('fs');
const path = require('path');

class ConfigLoader {
    constructor() {
        this.configPath = path.join(__dirname, '../../config');
        this.config = null;
    }

    loadConfig() {
        if (this.config) {
            return this.config;
        }

        try {
            // Load main server configuration
            const serverConfigPath = path.join(this.configPath, 'server.json');
            const serverConfig = JSON.parse(fs.readFileSync(serverConfigPath, 'utf8'));

            // Load item shop configuration
            const itemShopConfigPath = path.join(this.configPath, 'itemshop.json');
            const itemShopConfig = JSON.parse(fs.readFileSync(itemShopConfigPath, 'utf8'));

            // Load environment variables
            const envConfig = this.loadEnvironmentConfig();

            // Merge configurations
            this.config = {
                ...serverConfig,
                itemshop: itemShopConfig.itemshop,
                ...envConfig
            };

            // Override with environment variables if they exist
            this.overrideWithEnv();

            return this.config;
        } catch (error) {
            console.error('Failed to load configuration:', error);
            throw new Error('Configuration loading failed');
        }
    }

    loadEnvironmentConfig() {
        return {
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT) || 5432,
                name: process.env.DB_NAME || 'fortnite_backend',
                username: process.env.DB_USER || 'fortnite_user',
                password: process.env.DB_PASSWORD || 'your_password_here',
                ssl: process.env.DB_SSL === 'true'
            },
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || '',
                db: parseInt(process.env.REDIS_DB) || 0
            },
            security: {
                jwt_secret: process.env.JWT_SECRET || 'your_jwt_secret_here_change_this'
            }
        };
    }

    overrideWithEnv() {
        // Override critical settings with environment variables
        if (process.env.PORT) {
            this.config.server.port = parseInt(process.env.PORT);
        }

        if (process.env.NODE_ENV) {
            this.config.server.environment = process.env.NODE_ENV;
        }

        if (process.env.MAX_PLAYERS) {
            this.config.server.max_players = parseInt(process.env.MAX_PLAYERS);
        }

        if (process.env.REGION) {
            this.config.server.region = process.env.REGION;
        }
    }

    reloadConfig() {
        this.config = null;
        return this.loadConfig();
    }

    updateItemShopConfig(newConfig) {
        try {
            const itemShopConfigPath = path.join(this.configPath, 'itemshop.json');
            const currentConfig = JSON.parse(fs.readFileSync(itemShopConfigPath, 'utf8'));
            
            // Merge with new configuration
            const updatedConfig = {
                ...currentConfig,
                itemshop: {
                    ...currentConfig.itemshop,
                    ...newConfig
                }
            };

            // Write back to file
            fs.writeFileSync(itemShopConfigPath, JSON.stringify(updatedConfig, null, 2));
            
            // Reload configuration
            this.reloadConfig();
            
            return true;
        } catch (error) {
            console.error('Failed to update item shop configuration:', error);
            return false;
        }
    }

    validateConfig() {
        if (!this.config) {
            throw new Error('Configuration not loaded');
        }

        const requiredFields = [
            'server.port',
            'database.host',
            'database.name',
            'security.jwt_secret'
        ];

        for (const field of requiredFields) {
            const value = this.getNestedValue(this.config, field);
            if (value === undefined || value === null || value === '') {
                throw new Error(`Required configuration field missing: ${field}`);
            }
        }

        // Validate JWT secret
        if (this.config.security.jwt_secret === 'your_jwt_secret_here_change_this') {
            console.warn('⚠️  WARNING: Using default JWT secret. Please change it for production!');
        }

        // Validate database password
        if (this.config.database.password === 'your_password_here') {
            console.warn('⚠️  WARNING: Using default database password. Please change it for production!');
        }

        return true;
    }

    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }
}

const configLoader = new ConfigLoader();

module.exports = {
    loadConfig: () => configLoader.loadConfig(),
    reloadConfig: () => configLoader.reloadConfig(),
    updateItemShopConfig: (config) => configLoader.updateItemShopConfig(config),
    validateConfig: () => configLoader.validateConfig()
};
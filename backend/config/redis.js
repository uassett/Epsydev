const redis = require('redis');
require('dotenv').config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
  lazyConnect: true
};

const client = redis.createClient(redisConfig);

client.on('connect', () => {
  console.log('✅ Epo Redis connected successfully');
});

client.on('error', (err) => {
  console.error('❌ Epo Redis connection error:', err);
});

client.on('ready', () => {
  console.log('📡 Epo Redis ready to accept commands');
});

client.on('end', () => {
  console.log('🔌 Epo Redis connection ended');
});

// Connect to Redis
client.connect();

// Helper functions
const redisHelper = {
  // Set key with expiration
  setex: async (key, seconds, value) => {
    try {
      await client.setEx(key, seconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Redis setex error:', error);
      return false;
    }
  },

  // Get key
  get: async (key) => {
    try {
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  },

  // Delete key
  del: async (key) => {
    try {
      await client.del(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  },

  // Check if key exists
  exists: async (key) => {
    try {
      const exists = await client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  },

  // Increment key
  incr: async (key) => {
    try {
      return await client.incr(key);
    } catch (error) {
      console.error('Redis incr error:', error);
      return 0;
    }
  },

  // Add to set
  sadd: async (key, member) => {
    try {
      return await client.sAdd(key, member);
    } catch (error) {
      console.error('Redis sadd error:', error);
      return 0;
    }
  },

  // Remove from set
  srem: async (key, member) => {
    try {
      return await client.sRem(key, member);
    } catch (error) {
      console.error('Redis srem error:', error);
      return 0;
    }
  },

  // Get all members of set
  smembers: async (key) => {
    try {
      return await client.sMembers(key);
    } catch (error) {
      console.error('Redis smembers error:', error);
      return [];
    }
  }
};

module.exports = {
  client,
  redisHelper
};
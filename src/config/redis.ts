import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

export const connectRedis = async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis during startup:', error);
  }
};

export const clearRedisCache = async () => {
  try {
    await redisClient.flushAll();
    return true;
  } catch (err) {
    console.error('Failed to flush Redis:', err);
    throw err;
  }
};

export default redisClient;

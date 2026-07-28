import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import redisClient, { connectRedis } from './config/redis';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

(async () => {
  try {
    await connectRedis();
    server.listen(PORT, () => {
      console.log(`[Server] POS Backend is running on port ${PORT} (PID: ${process.pid})`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
 }
})();

process.on('SIGINT', () => {
  console.log('SIGINT received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

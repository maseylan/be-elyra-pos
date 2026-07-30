import dotenv from 'dotenv';
dotenv.config();

import { validateEnv } from './config/env-validator';
validateEnv();

import http from 'http';
import app from './app';
import redisClient, { connectRedis } from './config/redis';
import { publicPool, adminPool } from './db/poolManager';
import { tenantDbManager } from './db/tenant-connection';

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[Server] ${signal} received: shutting down gracefully`);
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });
  await tenantDbManager.closeAll().catch(e => console.warn('[Server] tenant pool close error:', e));
  await adminPool.end().catch(e => console.warn('[Server] admin pool close error:', e));
  await publicPool.end().catch(e => console.warn('[Server] public pool close error:', e));
  await redisClient.quit().catch(e => console.warn('[Server] Redis quit error:', e));
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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


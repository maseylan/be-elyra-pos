import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient, { connectRedis } from './config/redis';

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

// Setup Socket.io
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`New socket connection: ${socket.id} on worker PID ${process.pid}`);
  
  // TODO: Add socket handlers and tenant rooms logic here
  
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Jalankan dependencies (Redis) sebelum HTTP Server bind ke PORT
(async () => {
  try {
    // 1. Connect ke Cache Redis (yang juga dipakai oleh Tenant Resolution)
    await connectRedis();

    // 2. Setup Redis Adapter untuk Socket.io (Wajib untuk Cluster Mode)
    const pubClient = redisClient;
    const subClient = pubClient.duplicate();
    await subClient.connect();
    io.adapter(createAdapter(pubClient, subClient));

    // 3. Jalankan HTTP Server
    server.listen(PORT, () => {
      console.log(`[Server] POS Backend is running on port ${PORT} (PID: ${process.pid})`);
    });
  } catch (error) {
    console.error('Failed to start server dependencies:', error);
    process.exit(1);
  }
})();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('SIGINT received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

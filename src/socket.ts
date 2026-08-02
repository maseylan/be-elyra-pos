import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from './config/redis';

let io: SocketIOServer | null = null;

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allow all origins for local & production web POS
      methods: ['GET', 'POST'],
    },
  });

  // Attempt to attach Redis adapter if Redis is connected
  try {
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    pubClient.on('error', (err) => {
      console.warn('[Socket.IO Redis Pub Warning]:', err?.message || err);
    });
    subClient.on('error', (err) => {
      console.warn('[Socket.IO Redis Sub Warning]:', err?.message || err);
    });

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io?.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.IO] Redis adapter attached successfully');
    }).catch(err => {
      console.warn('[Socket.IO] Redis adapter connection warning (using memory adapter fallback):', err.message);
    });
  } catch (err: any) {
    console.warn('[Socket.IO] Could not attach Redis adapter, using default memory adapter:', err.message);
  }

  io.on('connection', (socket: Socket) => {
    // Cashier terminal joins room for specific outlet
    socket.on('join_outlet', (data: { outletId: string; terminalName?: string }) => {
      if (data?.outletId) {
        const roomName = `outlet:${data.outletId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} joined room ${roomName} (Terminal: ${data.terminalName || 'Main'})`);
      }
    });

    socket.on('leave_outlet', (data: { outletId: string }) => {
      if (data?.outletId) {
        const roomName = `outlet:${data.outletId}`;
        socket.leave(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} left room ${roomName}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO is not initialized!');
  }
  return io;
}

export function emitToOutlet(outletId: string, event: string, data: any) {
  if (io) {
    io.to(`outlet:${outletId}`).emit(event, data);
  }
}

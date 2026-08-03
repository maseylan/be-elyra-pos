import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from './config/redis';
import { verifyAccessToken } from './services/token.service';
import { tenantDbManager } from './db/tenant-connection';
import { drizzle } from 'drizzle-orm/node-postgres';
import { users, userOutlets } from './db/tenant_schema';
import { eq, and } from 'drizzle-orm';

let io: SocketIOServer | null = null;

export function initSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: (process.env.CORS_ALLOWED_DOMAINS || '').split(',').filter(Boolean),
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Unauthorized'));
      const auth = verifyAccessToken(token);
      if (auth.sessionType !== 'tenant-operational' || !auth.tenantId || !auth.userId) return next(new Error('Unauthorized'));
      socket.data.auth = auth;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
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
    socket.on('join_outlet', async (data: { outletId: string; terminalName?: string }) => {
      if (data?.outletId) {
        const auth = socket.data.auth;
        const db = drizzle(await tenantDbManager.getPool(auth.tenantId));
        const [user] = await db.select({ isAllOutlets: users.isAllOutlets }).from(users).where(eq(users.id, auth.userId)).limit(1);
        const [assignment] = user?.isAllOutlets ? [{}] : await db.select({ id: userOutlets.id }).from(userOutlets).where(and(eq(userOutlets.userId, auth.userId), eq(userOutlets.outletId, data.outletId))).limit(1);
        if (!user || (!user.isAllOutlets && !assignment)) return;
        const roomName = `tenant:${auth.tenantId}:outlet:${data.outletId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] Socket ${socket.id} joined room ${roomName} (Terminal: ${data.terminalName || 'Main'})`);
      }
    });

    socket.on('leave_outlet', (data: { outletId: string }) => {
      if (data?.outletId) {
        const roomName = `tenant:${socket.data.auth.tenantId}:outlet:${data.outletId}`;
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

export function emitToOutlet(tenantId: string, outletId: string, event: string, data: any) {
  if (io) {
    io.to(`tenant:${tenantId}:outlet:${outletId}`).emit(event, data);
  }
}

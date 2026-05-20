
import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Server as HttpServer } from 'http';
import { config } from './index';
import { logger } from '../utils/logger';

export let io: SocketServer;

export async function createSocketServer(httpServer: HttpServer): Promise<SocketServer> {
    // ── Two dedicated Redis clients for Pub/Sub ──────────────
    // Socket.io needs a separate publisher and subscriber.
    // We cannot reuse the main ioredis client because
    // subscribing blocks the connection.
    const pubClient = createClient({ url: config.redis.url, database: config.redis.db });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);
    logger.info('Redis pub/sub clients connected for Socket.io adapter');

    io = new SocketServer(httpServer, {
        // CORS: allow mobile app + web dashboard
        cors: {
            origin: config.corsOrigins,
            methods: ['GET', 'POST'],
            credentials: true,
        },
        // Timeouts
        pingTimeout: 20000,   // Server waits 20s for pong
        pingInterval: 25000,   // Server pings every 25s
        // Transport: prefer WebSocket, fall back to polling
        transports: ['websocket', 'polling'],
        // Adapter: Redis for horizontal scaling
        adapter: createAdapter(pubClient, subClient),
    });

    logger.info('Socket.io server created with Redis adapter');
    return io;
}

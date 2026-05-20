
import { Server, Socket } from 'socket.io';
import { presenceService } from '../services/presence.service';
import { ServerEvents } from './rooms';

// Called from server.ts when registering all socket handlers.
// Handles the Socket.io authentication middleware + initial setup.
export function setupPresenceHandlers(io: Server): void {

    // ── AUTH MIDDLEWARE ────────────────────────────────────────
    // Runs on every new socket connection BEFORE any event handlers.
    // Validates JWT from handshake auth token.
    io.use(async (socket: Socket, next) => {
        try {
            const token = socket.handshake.auth?.token ||
                socket.handshake.headers?.authorization?.replace('Bearer ', '');

            if (!token) {
                return next(new Error('UNAUTHORIZED: No token provided'));
            }

            // Verify JWT (same logic as HTTP middleware)
            const jwt = await import('jsonwebtoken');
            const { config } = await import('../config');
            const payload = jwt.default.verify(token, config.jwt.publicKey, {
                algorithms: ['RS256'],
                issuer: config.jwt.issuer,
                audience: config.jwt.audience,
            }) as { userId: string; deviceId: string };

            // Attach userId to socket data (available in all handlers)
            socket.data.userId = payload.userId;
            socket.data.deviceId = payload.deviceId;
            next();
        } catch (err: any) {
            const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN';
            next(new Error(`UNAUTHORIZED: ${code}`));
        }
    });
}

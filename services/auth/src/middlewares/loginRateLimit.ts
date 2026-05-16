import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { config } from '../config';

// Redis sliding window rate limiter.
// Works across multiple pods (unlike express-rate-limit memory store).
// Keys expire automatically — no cleanup job needed.

export async function loginRateLimit(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    // X-Forwarded-For set by AWS ALB. Trust proxy must be enabled in app.ts.
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = `rate:login:ip:${ip}`;

    const now = Date.now();
    const windowMs = config.rateLimit.windowMs;  // 15 min
    const maxAllowed = config.rateLimit.max;        // 5 attempts

    // Remove entries older than the window
    await redis.zremrangebyscore(key, '-inf', now - windowMs);

    // Count entries in current window
    const count = await redis.zcard(key);

    if (count >= maxAllowed) {
        // Find the oldest entry to calculate retry-after
        const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
        const oldestTs = oldest.length > 1 ? parseInt(oldest[1]) : now;
        const retryAfterS = Math.ceil((oldestTs + windowMs - now) / 1000);

        res.set('Retry-After', String(retryAfterS));
        res.status(429).json({
            success: false,
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many login attempts. Try again in ${retryAfterS} seconds.`,
            retryAfter: retryAfterS,
        });
        return;
    }

    // Record this attempt (score = timestamp for sorting)
    await redis.zadd(key, now, `${now}-${Math.random()}`);
    // Keep key alive for the full window
    await redis.expire(key, Math.ceil(windowMs / 1000));

    next();
}



// import { Request, Response, NextFunction } from 'express';
// import { v4 as uuid } from 'uuid';
// import { redis } from '../config/redis';
// import { config } from '../config';

// // Redis sliding window rate limiter
// // Tracks: login attempts per IP in a time window
// // Better than express-rate-limit because it works across multiple pods

// export async function loginRateLimit(req: Request, res: Response, next: NextFunction) {
//     const ip = req.ip || req.socket.remoteAddress || 'unknown';
//     const key = `rate:login:${ip}`;

//     const now = Date.now();
//     const window = config.rateLimit.windowMs; // 15 minutes
//     const maxCalls = config.rateLimit.max;       // 5 attempts

//     // Remove old entries outside the window
//     await redis.zremrangebyscore(key, 0, now - window);

//     // Count current requests in window
//     const count = await redis.zcard(key);

//     if (count >= maxCalls) {
//         const oldestEntry = await redis.zrange(key, 0, 0, 'WITHSCORES');
//         const retryAfter = oldestEntry.length > 1
//             ? Math.ceil((parseInt(oldestEntry[1]) + window - now) / 1000)
//             : Math.ceil(window / 1000);

//         res.set('Retry-After', retryAfter.toString());
//         return res.status(429).json({
//             success: false,
//             code: 'RATE_LIMIT_EXCEEDED',
//             message: `Too many login attempts. Try again in ${retryAfter} seconds.`,
//             retryAfter,
//         });
//     }

//     // Record this request
//     await redis.zadd(key, now, `${now}-${uuid()}`);
//     await redis.expire(key, Math.ceil(window / 1000));

//     return next();
// }

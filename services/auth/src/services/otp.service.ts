import twilio from 'twilio';
import { redis } from '../config/redis';
import { config } from '../config';
import { OtpRecord, IOtpRecord } from '../models/otpRecord.model';
import { logger } from '../utils/logger';

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

// ── CONSTANTS ────────────────────────────────────────────────
const OTP_TTL_SECONDS = 600;   // 10 minutes
const MAX_ATTEMPTS = 5;     // Wrong guesses before lockout
const HOURLY_SEND_LIMIT = 3;     // Max sends per phone per hour

interface OtpData {
    otp: string;   // 6-digit string
    attempts: number;   // Wrong guess counter
}

export const otpService = {

    // ── SEND ──────────────────────────────────────────────────
    async send(
        phone: string,
        purpose: IOtpRecord['purpose'],
        ipAddress: string,
        userAgent: string,
    ): Promise<void> {
        // Rate limit: max 3 sends per phone per hour
        const hourKey = `otp:hourly:${phone}`;
        const hourCount = await redis.incr(hourKey);
        if (hourCount === 1) await redis.expire(hourKey, 3600);
        if (hourCount > HOURLY_SEND_LIMIT) {
            logger.warn({ phone }, 'OTP hourly rate limit exceeded');
            throw new Error('OTP_RATE_LIMIT_EXCEEDED');
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const data: OtpData = { otp, attempts: 0 };

        // Store in Redis with TTL
        await redis.setex(`otp:${phone}`, OTP_TTL_SECONDS, JSON.stringify(data));

        // Send SMS via Twilio
        await twilioClient.messages.create({
            body: [
                `Your Trip Party code is: ${otp}`,
                `Valid for 10 minutes.`,
                `Never share this with anyone.`,
            ].join(' '),
            from: config.twilio.phoneNumber,
            to: phone,
        });

        // Write audit log (async — don't block response)
        OtpRecord.create({ phone, purpose, ipAddress, userAgent }).catch(err =>
            logger.error({ err }, 'Failed to write OTP audit record'));

        logger.info({ phone, purpose }, 'OTP sent');
    },

    // ── VERIFY ────────────────────────────────────────────────
    // Returns true if correct, false if wrong/expired.
    // Deletes OTP from Redis on success (one-time use).
    async verify(phone: string, inputOtp: string): Promise<boolean> {
        const raw = await redis.get(`otp:${phone}`);
        if (!raw) return false;   // Expired or never sent

        const data: OtpData = JSON.parse(raw);

        // Brute-force protection
        if (data.attempts >= MAX_ATTEMPTS) {
            await redis.del(`otp:${phone}`);
            logger.warn({ phone }, 'OTP max attempts exceeded — invalidated');
            return false;
        }

        if (data.otp !== inputOtp) {
            // Increment wrong attempt counter, preserve remaining TTL
            data.attempts += 1;
            const ttl = await redis.ttl(`otp:${phone}`);
            await redis.setex(`otp:${phone}`, Math.max(ttl, 1), JSON.stringify(data));
            logger.warn({ phone, attempts: data.attempts }, 'OTP wrong attempt');
            return false;
        }

        // ✅ Correct — delete immediately so it can't be reused
        await redis.del(`otp:${phone}`);

        // Mark audit record as verified
        OtpRecord.findOneAndUpdate(
            { phone, verified: false },
            { verified: true },
            { sort: { createdAt: -1 } }
        ).catch(() => { });  // Best effort

        return true;
    },
};





// import { randomInt } from 'crypto';
// import { redis } from '../config/redis';
// import { OtpRecord } from '../models/otpRecord.model';
// import { logger } from '../utils/logger';

// const OTP_TTL_SECONDS = 600;  // 10 minutes
// const MAX_ATTEMPTS = 5;    // 5 wrong guesses → lock
// const HOURLY_SEND_LIMIT = 3;    // Max 3 OTPs sent per phone per hour

// interface OtpData {
//     otp: string;
//     attempts: number;
// }

// export const otpService = {

//     // ── SEND OTP (MOCK VERSION) ────────────────────────────────────────────────
//     async send(phone: string, purpose: 'login' | 'register' | 'verify_phone' | 'password_reset', ip: string): Promise<void> {
//         const hourKey = `otp:hourly:${phone}`;
//         const hourCount = await redis.incr(hourKey);
//         if (hourCount === 1) await redis.expire(hourKey, 3600);
//         if (hourCount > HOURLY_SEND_LIMIT) {
//             throw new Error('OTP_RATE_LIMIT_EXCEEDED');
//         }

//         // Generate 6-digit OTP
//         const otp = randomInt(100000, 1000000).toString();
//         const data: OtpData = { otp, attempts: 0 };

//         // Store in Redis
//         await redis.setex(`otp:${phone}`, OTP_TTL_SECONDS, JSON.stringify(data));

//         // Audit log
//         await OtpRecord.create({ phone, purpose, ip });

//         // 🔥 THE MOCK: Print it beautifully to your terminal instead of sending an SMS
//         console.log('\n=============================================');
//         console.log(`📲 MOCK SMS DELIVERED TO: ${phone}`);
//         console.log(`🔢 YOUR TRIP PARTY OTP IS:  ${otp}`);
//         console.log('=============================================\n');

//         logger.info({ phone, purpose }, 'Mock OTP generated');
//     },

//     // ── VERIFY OTP ──────────────────────────────────────────────
//     async verify(phone: string, inputOtp: string): Promise<boolean> {
//         const raw = await redis.get(`otp:${phone}`);
//         if (!raw) return false;

//         const data: OtpData = JSON.parse(raw);

//         if (data.attempts >= MAX_ATTEMPTS) {
//             await redis.del(`otp:${phone}`);
//             logger.warn({ phone }, 'OTP max attempts exceeded');
//             return false;
//         }

//         if (data.otp !== inputOtp) {
//             data.attempts += 1;
//             const ttl = await redis.ttl(`otp:${phone}`);
//             await redis.setex(`otp:${phone}`, Math.max(ttl, 1), JSON.stringify(data));
//             logger.warn({ phone, attempts: data.attempts }, 'OTP wrong attempt');
//             return false;
//         }

//         await redis.del(`otp:${phone}`);
//         await OtpRecord.findOneAndUpdate(
//             { phone, verified: false },
//             { verified: true },
//             { sort: { createdAt: -1 } }
//         );

//         return true;
//     },
// };

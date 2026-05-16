// ── DEPRECATED: Twilio/Redis OTP System ──────────────────────
// This service has been replaced by Firebase Phone Authentication.
// The client now handles phone number verification entirely via the
// Firebase SDK (reCAPTCHA + SMS). Once verified, the client sends a
// Firebase idToken to POST /v1/auth/login/firebase.
//
// This file is kept for historical reference and may be removed
// in a future cleanup pass.
// ─────────────────────────────────────────────────────────────

/*
import twilio from 'twilio';
import { redis } from '../config/redis';
import { config } from '../config';
import { OtpRecord, IOtpRecord } from '../models/otpRecord.model';
import { logger } from '../utils/logger';

const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

const OTP_TTL_SECONDS = 600;
const MAX_ATTEMPTS = 5;
const HOURLY_SEND_LIMIT = 3;

interface OtpData {
    otp: string;
    attempts: number;
}

export const otpService = {

    async send(
        phone: string,
        purpose: IOtpRecord['purpose'],
        ipAddress: string,
        userAgent: string,
    ): Promise<void> {
        const hourKey = `otp:hourly:${phone}`;
        const hourCount = await redis.incr(hourKey);
        if (hourCount === 1) await redis.expire(hourKey, 3600);
        if (hourCount > HOURLY_SEND_LIMIT) {
            logger.warn({ phone }, 'OTP hourly rate limit exceeded');
            throw new Error('OTP_RATE_LIMIT_EXCEEDED');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const data: OtpData = { otp, attempts: 0 };
        await redis.setex(`otp:${phone}`, OTP_TTL_SECONDS, JSON.stringify(data));

        await twilioClient.messages.create({
            body: `Your Trip Party code is: ${otp}. Valid for 10 minutes. Never share this with anyone.`,
            from: config.twilio.phoneNumber,
            to: phone,
        });

        OtpRecord.create({ phone, purpose, ipAddress, userAgent }).catch(err =>
            logger.error({ err }, 'Failed to write OTP audit record'));

        logger.info({ phone, purpose }, 'OTP sent');
    },

    async verify(phone: string, inputOtp: string): Promise<boolean> {
        const raw = await redis.get(`otp:${phone}`);
        if (!raw) return false;

        const data: OtpData = JSON.parse(raw);

        if (data.attempts >= MAX_ATTEMPTS) {
            await redis.del(`otp:${phone}`);
            logger.warn({ phone }, 'OTP max attempts exceeded — invalidated');
            return false;
        }

        if (data.otp !== inputOtp) {
            data.attempts += 1;
            const ttl = await redis.ttl(`otp:${phone}`);
            await redis.setex(`otp:${phone}`, Math.max(ttl, 1), JSON.stringify(data));
            logger.warn({ phone, attempts: data.attempts }, 'OTP wrong attempt');
            return false;
        }

        await redis.del(`otp:${phone}`);

        OtpRecord.findOneAndUpdate(
            { phone, verified: false },
            { verified: true },
            { sort: { createdAt: -1 } }
        ).catch(() => { });

        return true;
    },
};
*/

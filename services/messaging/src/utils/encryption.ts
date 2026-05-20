
// Message content is encrypted in transit via TLS (handled by infrastructure).
// For additional field-level encryption of message content at rest,
// we use AES-256-GCM. This is optional — enable via ENCRYPT_MESSAGES=true env var.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM

export function encryptMessage(text: string, keyHex: string): string {
    const key = Buffer.from(keyHex, 'hex').slice(0, KEY_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Format: iv:tag:ciphertext (all hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptMessage(encrypted: string, keyHex: string): string {
    const [ivHex, tagHex, cipherHex] = encrypted.split(':');
    const key = Buffer.from(keyHex, 'hex').slice(0, KEY_LENGTH);
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const cipher = Buffer.from(cipherHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(cipher).toString('utf8') + decipher.final('utf8');
}

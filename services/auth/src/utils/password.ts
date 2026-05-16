
import bcrypt from 'bcrypt';

// Cost factor 12 = ~400ms on modern hardware.
// High enough to be secure, low enough not to time out requests.
// DO NOT change without migrating all existing hashes.
const SALT_ROUNDS = 12;

// ── HASH ────────────────────────────────────────────────────
// Call this when creating or updating a password.
// Returns the bcrypt hash string to store in DB.
export async function hashPassword(plainText: string): Promise<string> {
    if (!plainText || plainText.length < 8) {
        throw new Error('Password must be at least 8 characters');
    }
    return bcrypt.hash(plainText, SALT_ROUNDS);
}

// ── COMPARE ─────────────────────────────────────────────────
// Call this on login. Constant-time comparison prevents timing attacks.
// Returns true if plainText matches the stored hash.
export async function comparePassword(
    plainText: string,
    hash: string
): Promise<boolean> {
    if (!plainText || !hash) return false;
    return bcrypt.compare(plainText, hash);
}

// ── NEEDS REHASH ─────────────────────────────────────────────
// Returns true if the hash was created with a different cost factor.
// Use this to silently upgrade hashes on successful login.
export function needsRehash(hash: string): boolean {
    const currentRounds = bcrypt.getRounds(hash);
    return currentRounds !== SALT_ROUNDS;
}

// ── VALIDATE STRENGTH ────────────────────────────────────────
// Returns array of validation errors. Empty array = valid.
export function validatePasswordStrength(password: string): string[] {
    const errors: string[] = [];
    if (password.length < 8) errors.push('Min 8 characters');
    if (password.length > 72) errors.push('Max 72 characters (bcrypt limit)');
    if (!/[A-Z]/.test(password)) errors.push('Must contain at least one uppercase letter');
    if (!/[0-9]/.test(password)) errors.push('Must contain at least one number');
    if (/^\s|\s$/.test(password)) errors.push('Cannot start or end with whitespace');
    return errors;
}
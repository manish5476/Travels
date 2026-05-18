import { redis } from '../config/redis';
import { FeedKeys } from '../utils/cursor';
import { CandidateWithFeatures } from './featureExtractor';

// ── SIGNAL WEIGHTS ────────────────────────────────────────
// These values come from offline XGBoost model training.
// Positive = boosts the post. Negative = penalizes.
// Keep in sync with Post Service engagementScore.worker.ts
const WEIGHTS = {
    // Engagement signals
    save: 0.35,  // Strongest intent signal
    share: 0.28,  // User vouches to others
    comment: 0.25,  // Active engagement
    videoCompletion: 0.30,  // Attention signal
    like: 0.15,  // Low-friction
    profileVisit: 0.18,  // Interest signal
    // Penalty signals
    scrollPast: -0.25,  // Content irrelevant
    reported: -1.00,  // Hard penalty
    // Relationship boosts
    closeFriend: 0.40,  // Author is in close friends
    // Context boosts
    sameCity: 0.20,  // Post near user's city
    activeTripContent: 0.50,  // User has active trip + travel post
} as const;

// Recency decay: score × e^(-λ × hours_since_posted)
// λ = 0.1 means score halves roughly every 7 hours
const DECAY_LAMBDA = 0.1;

export interface ScoredCandidate extends CandidateWithFeatures {
    finalScore: number;
}

export const mlScorer = {

    async score(
        candidates: CandidateWithFeatures[],
        userId: string
    ): Promise<ScoredCandidate[]> {

        // Fetch user context once
        const ctx = await this.getUserContext(userId);

        const scored = candidates.map(c => {
            let score = c.engagementScore;

            // ── Apply engagement-based score boost ────────────
            // The engagementScore from Redis already encodes save/share/comment/like.
            // We re-apply relationship + context modifiers here.

            // Relationship: close friend boost
            if (c.isCloseFriend) score += WEIGHTS.closeFriend;

            // Context: same city as user
            if (ctx.currentCity && c.locationLabel?.toLowerCase().includes(ctx.currentCity.toLowerCase())) {
                score += WEIGHTS.sameCity;
            }

            // Context: active trip → boost travel content
            if (ctx.hasActiveTrip && c.isTravelContent) {
                score += WEIGHTS.activeTripContent;
            }

            // Source-based boost: following posts get a baseline boost
            if (c.source === 'following') score += 0.10;

            // ── Recency decay ─────────────────────────────────
            const hoursSince = c.createdAt
                ? (Date.now() - new Date(c.createdAt).getTime()) / 3_600_000
                : 24;
            score *= Math.exp(-DECAY_LAMBDA * hoursSince);

            return { ...c, finalScore: Math.max(0, score) };
        });

        // Sort descending by finalScore
        return scored.sort((a, b) => b.finalScore - a.finalScore);
    },

    async getUserContext(userId: string): Promise<{
        currentCity: string | null;
        hasActiveTrip: boolean;
        interests: string[];
    }> {
        const features = await redis.hgetall(FeedKeys.userFeatures(userId));
        return {
            currentCity: features?.current_city || null,
            hasActiveTrip: features?.has_active_trip === 'true',
            interests: features?.interests ? JSON.parse(features.interests) : [],
        };
    },
};


import { ScoredCandidate } from './mlScorer';

export interface BlendedPost extends ScoredCandidate {
    isInjected?: boolean;
    injectedType?: 'trip_content' | 'sponsored' | 'suggested_user';
}

// Injection ratios — must be tuned carefully
const TRIP_INJECTION_EVERY = 8;   // 1 trip post per 8 organic
const SPONSORED_EVERY = 20;  // 1 sponsored per 20 (not yet implemented — placeholder)

export const blender = {

    blend(candidates: ScoredCandidate[], userId: string): BlendedPost[] {
        if (candidates.length === 0) return [];

        // Separate trip content from regular posts
        const tripPosts = candidates.filter(c => c.isTravelContent);
        const regularPosts = candidates.filter(c => !c.isTravelContent);

        const result: BlendedPost[] = [];
        let regularIdx = 0;
        let tripIdx = 0;
        let position = 0;

        // Interleave trip posts every TRIP_INJECTION_EVERY positions
        while (regularIdx < regularPosts.length) {
            result.push({ ...regularPosts[regularIdx++] });
            position++;

            // Inject a trip post every N positions (if available)
            if (position % TRIP_INJECTION_EVERY === 0 && tripIdx < tripPosts.length) {
                result.push({
                    ...tripPosts[tripIdx++],
                    isInjected: true,
                    injectedType: 'trip_content',
                });
            }
        }

        // Append any remaining trip posts at end
        while (tripIdx < tripPosts.length) {
            result.push({ ...tripPosts[tripIdx++] });
        }

        return result;
    },
};

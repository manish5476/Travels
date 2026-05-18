
import { redis } from '../config/redis';
import { FeedKeys } from '../utils/cursor';
import { BlendedPost } from './blender';

// Time-of-day content preference boosts (IST hours)
function getTimeBoosts(): Record<string, number> {
    const hour = new Date().getUTCHours() + 5.5; // IST offset
    const h = hour % 24;

    if (h >= 6 && h < 10) return { travel: 0.15, news: 0.10 };   // Morning: trip planning
    if (h >= 10 && h < 14) return { food: 0.12, local: 0.10 };    // Midday: food/local
    if (h >= 14 && h < 18) return { adventure: 0.10, reel: 0.15 }; // Afternoon: reels
    if (h >= 18 && h < 22) return { social: 0.12, reel: 0.20 };   // Evening: social + reels
    return { travel: 0.05 };                                        // Night: mild boost
}

export const personalizer = {

    async rerank(posts: BlendedPost[], userId: string): Promise<BlendedPost[]> {
        if (posts.length <= 10) return posts;

        const features = await redis.hgetall(FeedKeys.userFeatures(userId));
        const hasTrip = features?.has_active_trip === 'true';
        const timeBoosts = getTimeBoosts();

        // Only re-rank top 10 — leave rest in order
        const top10 = posts.slice(0, 10);
        const rest = posts.slice(10);

        const reranked = top10.map(post => {
            let boost = 0;

            // Time-of-day boosts
            if (post.type === 'reel' && timeBoosts.reel) boost += timeBoosts.reel;
            if (post.isTravelContent && timeBoosts.travel) boost += timeBoosts.travel;
            if (post.type === 'post' && timeBoosts.social) boost += timeBoosts.social;

            // Active trip → extra boost for any travel content
            if (hasTrip && post.isTravelContent) boost += 0.25;

            return { ...post, finalScore: post.finalScore + boost };
        }).sort((a, b) => b.finalScore - a.finalScore);

        return [...reranked, ...rest];
    },
};


import { candidateGenerator } from './candidateGenerator';
import { featureExtractor } from './featureExtractor';
import { mlScorer } from './mlScorer';
import { blender } from './blender';
import { personalizer } from './personalizer';
import { bloomFilter } from '../utils/bloomFilter';
import { logger } from '../utils/logger';

export interface FeedPost {
    postId: string;
    authorId: string;
    source: 'following' | 'trending' | 'interest';
    engagementScore: number;
    likeCount: number;
    commentCount: number;
    type: string;
    isTravelContent: boolean;
    locationLabel?: string;
    createdAt: string;
    finalScore: number;
}

export interface FeedResult {
    posts: FeedPost[];
    nextCursor: string | null;
    stageMs: Record<string, number>;
}

export const rankingEngine = {

    async buildFeed(
        userId: string,
        cursor?: string,
        limit = 20
    ): Promise<FeedResult> {
        const timings: Record<string, number> = {};
        const t = (label: string, start: number) => {
            timings[label] = Date.now() - start;
        };

        // ── STAGE 1: Candidate Generation ────────────────────
        let s = Date.now();
        const candidates = await candidateGenerator.generate(userId, 500);
        t('candidateGen', s);

        // ── STAGE 2: Feature Extraction ───────────────────────
        s = Date.now();
        const withFeatures = await featureExtractor.extract(candidates, userId);
        t('featureExtract', s);

        // ── STAGE 3: ML Scoring ───────────────────────────────
        s = Date.now();
        const scored = await mlScorer.score(withFeatures, userId);
        t('mlScore', s);

        // ── STAGE 4: Filter Seen Posts (Bloom Filter) ─────────
        s = Date.now();
        const unseenChecks = await Promise.all(
            scored.map(p => bloomFilter.mightHaveSeen(userId, p.postId))
        );
        const unseen = scored.filter((_, i) => !unseenChecks[i]);
        t('bloomFilter', s);

        // ── STAGE 5: Blending ─────────────────────────────────
        s = Date.now();
        const blended = blender.blend(unseen.slice(0, 100), userId);
        t('blend', s);

        // ── STAGE 6: Personalization ──────────────────────────
        s = Date.now();
        const personalized = await personalizer.rerank(blended, userId);
        t('personalize', s);

        // ── PAGINATION ────────────────────────────────────────
        // Decode cursor to find start index
        let startIdx = 0;
        if (cursor) {
            const idx = personalized.findIndex(p => p.postId === cursor);
            startIdx = idx >= 0 ? idx + 1 : 0;
        }

        const page = personalized.slice(startIdx, startIdx + limit);
        const nextCursor = page.length === limit ? page[page.length - 1].postId : null;

        // Mark shown posts in Bloom filter (async — don't block response)
        bloomFilter.markSeenBatch(userId, page.map(p => p.postId))
            .catch(err => logger.warn({ err }, 'Bloom markSeen failed'));

        const totalMs = Object.values(timings).reduce((a, b) => a + b, 0);
        logger.info({
            userId, candidateCount: candidates.length,
            unseenCount: unseen.length, pageSize: page.length,
            totalMs, ...timings
        }, 'Feed built');

        return { posts: page, nextCursor, stageMs: timings };
    },
};

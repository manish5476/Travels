
import { redis } from '../config/redis';
import { FeedKeys } from '../utils/cursor';
import { Candidate } from './candidateGenerator';

export interface CandidateWithFeatures extends Candidate {
    likeCount: number;
    commentCount: number;
    saveCount: number;
    viewCount: number;
    isCloseFriend: boolean;
    authorFollowerCount: number;
}

export const featureExtractor = {

    async extract(
        candidates: Candidate[],
        userId: string
    ): Promise<CandidateWithFeatures[]> {

        // Fetch user's close friends set once
        const closeFriends = await redis.smembers(FeedKeys.closeFriends(userId));
        const closeFriendSet = new Set(closeFriends);

        // Fetch all post metadata in parallel using Redis pipeline
        const pipeline = redis.pipeline();
        candidates.forEach(c => pipeline.hgetall(FeedKeys.postMeta(c.postId)));
        const results = await pipeline.exec();

        return candidates.map((candidate, i) => {
            const [err, meta] = results?.[i] || [null, {}];
            const m = (err ? {} : meta) as Record<string, string>;

            return {
                ...candidate,
                likeCount: parseInt(m.likeCount || '0'),
                commentCount: parseInt(m.commentCount || '0'),
                saveCount: parseInt(m.saveCount || '0'),
                viewCount: parseInt(m.viewCount || '0'),
                isCloseFriend: closeFriendSet.has(candidate.authorId),
                authorFollowerCount: parseInt(m.followerCount || '0'),
            };
        });
    },
};

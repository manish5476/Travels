
// Cursor-based pagination for feed.
// Cursor encodes the score+postId of the last item shown.
// This prevents duplicates and missed posts when feed is re-ranked
// between page loads — unlike offset-based pagination.

export interface FeedCursor {
    score: number;   // The ranking score of the last post shown
    postId: string;   // Used as tiebreaker
}

export function encodeCursor(score: number, postId: string): string {
    const data = JSON.stringify({ score, postId });
    return Buffer.from(data).toString('base64url');
}

export function decodeCursor(cursor: string): FeedCursor | null {
    try {
        const data = Buffer.from(cursor, 'base64url').toString('utf-8');
        return JSON.parse(data) as FeedCursor;
    } catch {
        return null;
    }
}

// Redis key helpers — single source of truth for all feed cache keys
export const FeedKeys = {
    userFeed: (userId: string) => `feed:${userId}`,
    influencerPosts: (userId: string) => `feed:influencer:${userId}`,
    trendingPosts: (date: string) => `trending:posts:${date}`,
    interestPosts: (tag: string) => `interest:${tag}`,
    storyTray: (userId: string) => `story:tray:${userId}`,
    userFeatures: (userId: string) => `user:features:${userId}`,
    closeFriends: (userId: string) => `close_friends:${userId}`,
    followerCount: (userId: string) => `follower_count:${userId}`,
    postMeta: (postId: string) => `post:meta:${postId}`,
};

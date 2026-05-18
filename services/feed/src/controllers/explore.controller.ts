
import { Request, Response, NextFunction } from 'express';
import { trendingService } from '../services/trending.service';
import { feedService } from '../services/feed.service';

export const exploreController = {

    // GET /v1/feed/explore — Explore tab
    getExplore: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const [posts, hashtags, destinations] = await Promise.all([
                trendingService.getExplorePosts(30),
                trendingService.getTrendingHashtags(20),
                trendingService.getTrendingDestinations(10),
            ]);
            res.json({ success: true, data: { posts, hashtags, destinations } });
        } catch (err) { next(err); }
    },

    // GET /v1/feed/trending/hashtags
    getTrendingHashtags: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const hashtags = await trendingService.getTrendingHashtags(20);
            res.json({ success: true, data: hashtags });
        } catch (err) { next(err); }
    },

    // GET /v1/feed/nearby?lat=&lng=&radius=
    getNearbyPosts: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { lat, lng, radius } = req.query as { lat: string; lng: string; radius?: string };
            const posts = await feedService.getNearbyPosts(
                parseFloat(lat), parseFloat(lng), radius ? parseFloat(radius) : 50
            );
            res.json({ success: true, data: posts });
        } catch (err) { next(err); }
    },
};

import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import { avatarService } from '../services/avatar.service';

export const userController = {

    // GET /v1/users/:username
    getProfile: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { username } = req.params;
            const user = await userService.getByUsername(username, req.user?.userId);
            res.json({ success: true, data: user });
        } catch (err) { next(err); }
    },

    // GET /v1/users/search?q=rahul
    search: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { q, limit } = req.query as { q: string; limit?: string };
            const users = await userService.search(q, limit ? parseInt(limit) : 10);
            res.json({ success: true, data: users });
        } catch (err) { next(err); }
    },

    // PATCH /v1/users/me
    updateProfile: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.updateProfile(req.user!.userId, req.body);
            res.json({ success: true, data: user });
        } catch (err) { next(err); }
    },

    // POST /v1/users/me/device-token
    upsertDeviceToken: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { token, platform } = req.body;
            await userService.upsertDeviceToken(req.user!.userId, token, platform);
            res.json({ success: true, message: 'Device token registered' });
        } catch (err) { next(err); }
    },

    // GET /v1/users/me/avatar/upload-urls
    getAvatarUploadUrls: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const urls = await avatarService.getUploadUrls(req.user!.userId);
            res.json({ success: true, data: urls });
        } catch (err) { next(err); }
    },

    // POST /v1/users/me/avatar/confirm
    confirmAvatarUpload: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await avatarService.confirmUpload(req.user!.userId);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },

    // DELETE /v1/users/me/avatar
    removeAvatar: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await avatarService.removeAvatar(req.user!.userId);
            res.json({ success: true, message: 'Avatar removed' });
        } catch (err) { next(err); }
    },

    // ── INTERNAL (called by other services) ─────────────────
    // GET /internal/users/:id/device-tokens
    getDeviceTokens: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const tokens = await userService.getDeviceTokens(req.params.id);
            res.json({ success: true, data: tokens });
        } catch (err) { next(err); }
    },

    // GET /internal/users/:id/profile
    getProfileInternal: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const user = await userService.getById(req.params.id);
            res.json({ success: true, data: user });
        } catch (err) { next(err); }
    },
};

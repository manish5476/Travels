
import { Request, Response, NextFunction } from 'express';
import { tripService } from '../services/trip.service';

export const tripController = {
    create: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const trip = await tripService.create(req.user!.userId, req.body);
            res.status(201).json({ success: true, data: trip });
        } catch (err) { next(err); }
    },
    getById: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const trip = await tripService.getById(req.params.id, req.user?.userId);
            res.json({ success: true, data: trip });
        } catch (err) { next(err); }
    },
    getBySlug: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const trip = await tripService.getBySlug(req.params.slug);
            res.json({ success: true, data: trip });
        } catch (err) { next(err); }
    },
    getMyTrips: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const trips = await tripService.getMyTrips(req.user!.userId, req.query.status as string);
            res.json({ success: true, data: trips });
        } catch (err) { next(err); }
    },
    getPublic: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await tripService.getPublic(
                req.query.cursor as string, req.query.limit ? parseInt(req.query.limit as string) : 20,
                req.query.destination as string);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
    update: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const trip = await tripService.update(req.params.id, req.user!.userId, req.body);
            res.json({ success: true, data: trip });
        } catch (err) { next(err); }
    },
    transition: async (req: Request, res: Response, next: NextFunction) => {
        try {
            await tripService.transition(req.params.id, req.user!.userId, req.body.toState);
            res.json({ success: true, message: `Trip is now ${req.body.toState}` });
        } catch (err) { next(err); }
    },
    getTimeline: async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await tripService.getTimeline(req.params.id, req.query.cursor as string);
            res.json({ success: true, data: result });
        } catch (err) { next(err); }
    },
};

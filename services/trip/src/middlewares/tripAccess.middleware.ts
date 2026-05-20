
import { Request, Response, NextFunction } from 'express';
import { collaboratorService } from '../services/collaborator.service';

type RoleLevel = 'viewer' | 'member' | 'co-admin' | 'admin';

// Role hierarchy: admin > co-admin > member > viewer
const ROLE_LEVEL: Record<string, number> = {
    viewer: 1,
    member: 2,
    'co-admin': 3,
    admin: 4,
};

// Factory: creates middleware that requires at least the given role
export function requireTripRole(minimumRole: RoleLevel) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const tripId = req.params.tripId || req.params.id;
        const userId = req.user?.userId;

        if (!userId || !tripId) {
            res.status(401).json({ success: false, code: 'UNAUTHORIZED' }); return;
        }

        const role = await collaboratorService.getRole(tripId, userId);

        if (!role) {
            res.status(403).json({
                success: false, code: 'NOT_A_COLLABORATOR',
                message: 'You are not a member of this trip'
            });
            return;
        }

        const userLevel = ROLE_LEVEL[role] || 0;
        const reqLevel = ROLE_LEVEL[minimumRole] || 0;

        if (userLevel < reqLevel) {
            res.status(403).json({
                success: false, code: 'INSUFFICIENT_ROLE',
                message: `Requires '${minimumRole}' role or higher. Your role: '${role}'`
            });
            return;
        }

        // Attach role to request for controllers to use without re-querying
        req.tripRole = role;
        next();
    };
}

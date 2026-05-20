
import { Router } from 'express';
import { tripController } from '../controllers/trip.controller';
import { collaboratorController } from '../controllers/collaborator.controller';
import { waypointController } from '../controllers/waypoint.controller';
import { aiPlannerController } from '../controllers/aiPlanner.controller';
import { safetyController } from '../controllers/safety.controller';
import { packingListController } from '../controllers/packingList.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireTripRole } from '../middlewares/tripAccess.middleware';
import { validateBody } from '../validators/trip.validator';

export const tripRoutes = Router();

// ── PUBLIC ────────────────────────────────────────────────
tripRoutes.get('/public', tripController.getPublic);
tripRoutes.get('/slug/:slug', tripController.getBySlug);

// ── AUTHENTICATED ─────────────────────────────────────────
tripRoutes.post('/', authMiddleware, validateBody('createTrip'), tripController.create);
tripRoutes.get('/me', authMiddleware, tripController.getMyTrips);

// ── TRIP-SPECIFIC (RBAC applied per endpoint) ─────────────
tripRoutes.get('/:id', authMiddleware, tripController.getById);
tripRoutes.patch('/:id', authMiddleware, requireTripRole('co-admin'), validateBody('updateTrip'), tripController.update);
tripRoutes.post('/:id/transition', authMiddleware, requireTripRole('admin'), tripController.transition);
tripRoutes.get('/:id/timeline', authMiddleware, requireTripRole('viewer'), tripController.getTimeline);

// ── COLLABORATORS ──────────────────────────────────────────
tripRoutes.post('/:id/invite', authMiddleware, requireTripRole('co-admin'), validateBody('invite'), collaboratorController.invite);
tripRoutes.post('/:id/join', authMiddleware, collaboratorController.requestJoin);
tripRoutes.post('/:id/accept', authMiddleware, collaboratorController.acceptInvite);
tripRoutes.patch('/:id/requests/:userId', authMiddleware, requireTripRole('co-admin'), collaboratorController.handleRequest);
tripRoutes.delete('/:id/collaborators/:userId', authMiddleware, requireTripRole('admin'), collaboratorController.remove);
tripRoutes.patch('/:id/collaborators/:userId/role', authMiddleware, requireTripRole('admin'), collaboratorController.updateRole);

// ── WAYPOINTS ─────────────────────────────────────────────
tripRoutes.post('/:id/waypoints', authMiddleware, requireTripRole('member'), validateBody('addWaypoint'), waypointController.add);
tripRoutes.patch('/:id/waypoints/:idx/checkin', authMiddleware, requireTripRole('member'), waypointController.checkIn);
tripRoutes.patch('/:id/waypoints/reorder', authMiddleware, requireTripRole('co-admin'), waypointController.reorder);

// ── PACKING LIST ───────────────────────────────────────────
tripRoutes.post('/:id/packing/populate', authMiddleware, requireTripRole('admin'), packingListController.prePopulate);
tripRoutes.post('/:id/packing', authMiddleware, requireTripRole('member'), validateBody('addPackingItem'), packingListController.addItem);
tripRoutes.patch('/:id/packing/:itemId/toggle', authMiddleware, requireTripRole('member'), packingListController.togglePacked);
tripRoutes.delete('/:id/packing/:itemId', authMiddleware, requireTripRole('member'), packingListController.removeItem);

// ── AI PLANNER ─────────────────────────────────────────────
tripRoutes.post('/:id/ai-planner/generate', authMiddleware, requireTripRole('member'), aiPlannerController.generate);
tripRoutes.post('/:id/ai-planner/vote', authMiddleware, requireTripRole('member'), validateBody('vote'), aiPlannerController.vote);
tripRoutes.post('/:id/ai-planner/commit', authMiddleware, requireTripRole('admin'), aiPlannerController.commitAsWaypoint);

// ── SAFETY ────────────────────────────────────────────────
tripRoutes.post('/:id/safety/sos', authMiddleware, requireTripRole('member'), safetyController.triggerSos);
tripRoutes.post('/:id/safety/checkin', authMiddleware, requireTripRole('member'), safetyController.safeCheckin);
tripRoutes.post('/:id/safety/trusted-link', authMiddleware, requireTripRole('admin'), safetyController.generateTrustedLink);
tripRoutes.patch('/:id/safety/emergency', authMiddleware, requireTripRole('admin'), safetyController.setEmergencyMode);
tripRoutes.patch('/:id/safety/sos-contacts', authMiddleware, requireTripRole('admin'), validateBody('sosContacts'), safetyController.updateSosContacts);

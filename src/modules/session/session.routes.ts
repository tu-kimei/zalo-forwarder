import { Router } from 'express';
import * as controller from './session.controller';

const router = Router();

// GET  /              — List all sessions
router.get('/', controller.listSessions);

// GET  /:id           — Get a single session
router.get('/:id', controller.getSession);

// DELETE /:id         — Delete a session
router.delete('/:id', controller.deleteSession);

// POST /:id/health-check — Run health check on a session
router.post('/:id/health-check', controller.healthCheck);

export default router;

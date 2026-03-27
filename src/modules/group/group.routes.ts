import { Router } from 'express';
import * as controller from './group.controller';

const router = Router();

// GET  /          — List all groups
// POST /          — Create a group
router.get('/', controller.listGroups);
router.post('/', controller.createGroup);

// PUT    /:id     — Update a group
// DELETE /:id     — Delete a group
router.put('/:id', controller.updateGroup);
router.delete('/:id', controller.deleteGroup);

export default router;

import { Router } from 'express';
import * as controller from './image.controller';

const router = Router();

// GET /api/images/message/:messageId — list images for a message
router.get('/message/:messageId', controller.listMessageImages);

// GET /api/images/:id — serve image file
router.get('/:id', controller.getImage);

export default router;

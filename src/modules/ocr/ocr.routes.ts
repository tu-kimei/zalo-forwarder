import { Router } from 'express';
import * as controller from './ocr.controller';

const router = Router();

// POST /api/ocr/process/:messageId — trigger OCR for a message
router.post('/process/:messageId', controller.triggerOcr);

// GET /api/ocr/results — list OCR results (filter by status, category)
router.get('/results', controller.listResults);

// GET /api/ocr/results/:id — get OCR result detail
router.get('/results/:id', controller.getResult);

// POST /api/ocr/results/:id/confirm — confirm OCR result
router.post('/results/:id/confirm', controller.confirmResult);

// POST /api/ocr/results/:id/reject — reject OCR result
router.post('/results/:id/reject', controller.rejectResult);

export default router;

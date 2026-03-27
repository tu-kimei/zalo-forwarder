import { Router } from 'express';
import * as authController from './auth.controller';

const router = Router();

router.post('/qr/generate', authController.generateQr);
router.post('/qr/wait-scan', authController.waitScan);
router.post('/qr/wait-confirm', authController.waitConfirm);
router.post('/qr/complete', authController.completeLogin);
router.post('/disconnect/:id', authController.disconnectAccount);

export default router;

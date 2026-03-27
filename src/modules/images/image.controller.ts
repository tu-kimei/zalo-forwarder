import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as imageService from './image.service';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

/**
 * GET /api/images/:id — Serve an image file by attachment ID.
 */
export async function getImage(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');

    if (!id) {
      res.status(400).json({ error_code: 400, error_message: 'id is required' });
      return;
    }

    const localPath = await imageService.getImagePath(id);

    if (!localPath) {
      res.status(404).json({ error_code: 404, error_message: 'Image not found or not downloaded' });
      return;
    }

    const attachment = await prisma.imageAttachment.findUnique({
      where: { id },
    });

    res.setHeader('Content-Type', attachment?.mimeType || 'image/jpeg');
    res.sendFile(localPath, { root: process.cwd() });
  } catch (err) {
    logger.error('Failed to serve image', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

/**
 * GET /api/images/message/:messageId — List all images for a message.
 */
export async function listMessageImages(req: Request, res: Response): Promise<void> {
  try {
    const messageId = String(req.params.messageId ?? '');

    if (!messageId) {
      res.status(400).json({ error_code: 400, error_message: 'messageId is required' });
      return;
    }

    const attachments = await prisma.imageAttachment.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ error_code: 0, error_message: 'OK', data: attachments });
  } catch (err) {
    logger.error('Failed to list message images', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

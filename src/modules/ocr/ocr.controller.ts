import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as ocrService from './ocr.service';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

/**
 * POST /api/ocr/process/:messageId — Trigger OCR for a message.
 */
export async function triggerOcr(req: Request, res: Response): Promise<void> {
  try {
    const messageId = String(req.params.messageId ?? '');
    const { category } = req.body as { category?: string };

    if (!messageId) {
      res.status(400).json({ error_code: 400, error_message: 'messageId is required' });
      return;
    }

    if (!category || !['fuel', 'repair'].includes(category)) {
      res.status(400).json({
        error_code: 400,
        error_message: 'category must be "fuel" or "repair"',
      });
      return;
    }

    const results = await ocrService.processMessage(messageId, category);

    res.json({
      error_code: 0,
      error_message: 'OK',
      data: results,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to trigger OCR', { error: errMsg });
    res.status(500).json({ error_code: 500, error_message: errMsg });
  }
}

/**
 * GET /api/ocr/results — List OCR results with optional filters.
 * Query params: status, category, page, limit
 */
export async function listResults(req: Request, res: Response): Promise<void> {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (category) where.category = category;

    const [results, total] = await Promise.all([
      prisma.ocrResult.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          message: {
            select: {
              id: true,
              zaloMsgId: true,
              groupId: true,
              groupName: true,
              senderName: true,
              text: true,
              images: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.ocrResult.count({ where }),
    ]);

    res.json({
      error_code: 0,
      error_message: 'OK',
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Failed to list OCR results', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

/**
 * GET /api/ocr/results/:id — Get a single OCR result.
 */
export async function getResult(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');

    const result = await prisma.ocrResult.findUnique({
      where: { id },
      include: {
        message: true,
        image: true,
      },
    });

    if (!result) {
      res.status(404).json({ error_code: 404, error_message: 'OCR result not found' });
      return;
    }

    res.json({ error_code: 0, error_message: 'OK', data: result });
  } catch (err) {
    logger.error('Failed to get OCR result', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

/**
 * POST /api/ocr/results/:id/confirm — Confirm an OCR result.
 */
export async function confirmResult(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    const { reviewNote } = req.body as { reviewNote?: string };

    const existing = await prisma.ocrResult.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error_code: 404, error_message: 'OCR result not found' });
      return;
    }

    await ocrService.confirmResult(id, reviewNote);

    const updated = await prisma.ocrResult.findUnique({ where: { id } });
    res.json({ error_code: 0, error_message: 'Confirmed', data: updated });
  } catch (err) {
    logger.error('Failed to confirm OCR result', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

/**
 * POST /api/ocr/results/:id/reject — Reject an OCR result.
 */
export async function rejectResult(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id ?? '');
    const { reviewNote } = req.body as { reviewNote?: string };

    const existing = await prisma.ocrResult.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error_code: 404, error_message: 'OCR result not found' });
      return;
    }

    await ocrService.rejectResult(id, reviewNote);

    const updated = await prisma.ocrResult.findUnique({ where: { id } });
    res.json({ error_code: 0, error_message: 'Rejected', data: updated });
  } catch (err) {
    logger.error('Failed to reject OCR result', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

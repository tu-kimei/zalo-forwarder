import { Request, Response } from 'express';
import * as sessionService from './session.service';
import { logger } from '../../lib/logger';

export async function listSessions(_req: Request, res: Response): Promise<void> {
  try {
    const sessions = await sessionService.getAllSessions();
    res.json({ error_code: 0, error_message: 'OK', data: sessions });
  } catch (err) {
    logger.error('Failed to list sessions', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function getSession(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const session = await sessionService.getSession(id);

    if (!session) {
      res.status(404).json({ error_code: 404, error_message: 'Session not found' });
      return;
    }

    res.json({ error_code: 0, error_message: 'OK', data: session });
  } catch (err) {
    logger.error('Failed to get session', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function deleteSession(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const session = await sessionService.getSession(id);

    if (!session) {
      res.status(404).json({ error_code: 404, error_message: 'Session not found' });
      return;
    }

    await sessionService.deleteSession(id);
    res.json({ error_code: 0, error_message: 'Deleted' });
  } catch (err) {
    logger.error('Failed to delete session', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const health = await sessionService.healthCheck(id);
    res.json({ error_code: 0, error_message: 'OK', data: health });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message === 'Account not found') {
      res.status(404).json({ error_code: 404, error_message: message });
      return;
    }
    logger.error('Health check failed', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

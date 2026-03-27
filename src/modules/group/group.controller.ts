import { Request, Response } from 'express';
import * as groupService from './group.service';
import { logger } from '../../lib/logger';

export async function listGroups(_req: Request, res: Response): Promise<void> {
  try {
    const groups = await groupService.getAllGroups();
    res.json({ error_code: 0, error_message: 'OK', data: groups });
  } catch (err) {
    logger.error('Failed to list groups', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function createGroup(req: Request, res: Response): Promise<void> {
  try {
    const { groupId, groupName, category, active } = req.body;

    if (!groupId) {
      res.status(400).json({ error_code: 400, error_message: 'groupId is required' });
      return;
    }

    const group = await groupService.createGroup({ groupId, groupName, category, active });
    res.status(201).json({ error_code: 0, error_message: 'Created', data: group });
  } catch (err: unknown) {
    // Handle unique constraint error
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(409).json({ error_code: 409, error_message: 'Group with this groupId already exists' });
      return;
    }
    logger.error('Failed to create group', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function updateGroup(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await groupService.getGroupById(id);

    if (!existing) {
      res.status(404).json({ error_code: 404, error_message: 'Group not found' });
      return;
    }

    const { groupId, groupName, category, active } = req.body;
    const group = await groupService.updateGroup(id, { groupId, groupName, category, active });
    res.json({ error_code: 0, error_message: 'Updated', data: group });
  } catch (err) {
    logger.error('Failed to update group', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

export async function deleteGroup(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    const existing = await groupService.getGroupById(id);

    if (!existing) {
      res.status(404).json({ error_code: 404, error_message: 'Group not found' });
      return;
    }

    await groupService.deleteGroup(id);
    res.json({ error_code: 0, error_message: 'Deleted' });
  } catch (err) {
    logger.error('Failed to delete group', { error: err });
    res.status(500).json({ error_code: 500, error_message: 'Internal server error' });
  }
}

import { PrismaClient } from '@prisma/client';
import { listenerService } from '../listener/listener.service';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

/**
 * Get all Zalo sessions (accounts) with their listener status.
 */
export async function getAllSessions() {
  const accounts = await prisma.zaloAccount.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      accountId: true,
      displayName: true,
      avatar: true,
      phoneNumber: true,
      status: true,
      lastHealthCheck: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return accounts.map((account) => ({
    ...account,
    isListening: listenerService.isListening(account.id),
  }));
}

/**
 * Get a single session by ID with detailed info.
 */
export async function getSession(id: string) {
  const account = await prisma.zaloAccount.findUnique({
    where: { id },
    select: {
      id: true,
      accountId: true,
      displayName: true,
      avatar: true,
      phoneNumber: true,
      status: true,
      lastHealthCheck: true,
      lastMessageAt: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          messages: true,
          webhookLogs: true,
        },
      },
    },
  });

  if (!account) return null;

  return {
    ...account,
    isListening: listenerService.isListening(account.id),
    messageCount: account._count.messages,
    webhookLogCount: account._count.webhookLogs,
  };
}

/**
 * Delete a session (account) and stop its listener.
 */
export async function deleteSession(id: string) {
  // Stop listener if active
  listenerService.stopListening(id);

  // Delete related records
  await prisma.webhookLog.deleteMany({ where: { accountId: id } });
  await prisma.zaloMessage.deleteMany({ where: { accountId: id } });

  // Delete the account
  return prisma.zaloAccount.delete({ where: { id } });
}

/**
 * Perform a health check on a session.
 * Returns status info about the session connectivity.
 */
export async function healthCheck(id: string) {
  const account = await prisma.zaloAccount.findUnique({
    where: { id },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  const isListening = listenerService.isListening(id);
  const hasCredentials = !!(account.cookies && account.zpwEnk);
  const isActive = account.status === 'ACTIVE';

  // Update last health check timestamp
  await prisma.zaloAccount.update({
    where: { id },
    data: { lastHealthCheck: new Date() },
  });

  // TODO: Perform actual Zalo API health check (e.g., call getServerInfo)
  const health = {
    accountId: id,
    status: account.status,
    isActive,
    isListening,
    hasCredentials,
    lastHealthCheck: new Date().toISOString(),
    lastMessageAt: account.lastMessageAt?.toISOString() ?? null,
  };

  logger.info('Health check completed', health);
  return health;
}

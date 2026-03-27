import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import { WsClient } from './ws-client';
import { parseRawMessage, ZaloParsedMessage } from './message-parser';
import { broadcastWebhook, WebhookPayload } from '../webhook/webhook.service';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

/**
 * Listener service — manages WebSocket connections to Zalo for message listening.
 *
 * Events emitted:
 *  - 'message' (msg: ZaloParsedMessage, accountId: string)
 *  - 'connected' (accountId: string)
 *  - 'disconnected' (accountId: string)
 *  - 'error' (err: Error, accountId: string)
 */
class ListenerService extends EventEmitter {
  private clients: Map<string, WsClient> = new Map();

  /**
   * Start listening for messages on a Zalo account.
   */
  async startListening(accountId: string): Promise<void> {
    // Check if already listening
    if (this.clients.has(accountId)) {
      logger.warn('Already listening on account', { accountId });
      return;
    }

    // Fetch account from DB
    const account = await prisma.zaloAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Account not found: ${accountId}`);
    }

    if (account.status !== 'ACTIVE') {
      throw new Error(`Account is not active: ${account.status}`);
    }

    // Verify login info exists (account must have completed login)
    const loginInfo = account.loginInfo as Record<string, any> | null;
    if (!loginInfo) {
      throw new Error('No login info available for this account. Complete login first.');
    }

    // Build WS URL with params like reference code
    const cookies = (account.cookies as Array<{ name: string; value: string; domain?: string }>) ?? [];
    // Find the valid zpw_sek (not EXPIRED) from chat.zalo.me domain
    const zpwSek = cookies.find(c => c.name === 'zpw_sek' && c.value !== 'EXPIRED' && c.domain?.includes('chat.zalo.me'))
      ?? cookies.find(c => c.name === 'zpw_sek' && c.value !== 'EXPIRED');
    
    // Cookie string should only include zpw_sek
    const cookieStr = zpwSek ? `zpw_sek=${zpwSek.value}` : '';

    const WS_SERVERS = [
      'wss://ws7-msg.chat.zalo.me',
      'wss://ws6-msg.chat.zalo.me',
      'wss://ws5-msg.chat.zalo.me',
      'wss://ws4-msg.chat.zalo.me',
      'wss://ws3-msg.chat.zalo.me',
      'wss://ws2-msg.chat.zalo.me',
      'wss://ws1-msg.chat.zalo.me',
    ];

    // Build URL dynamically per connect attempt (timestamp must be fresh)
    const urlFactory = () => {
      const server = WS_SERVERS[Math.floor(Math.random() * WS_SERVERS.length)];
      return `${server}/?zpw_ver=629&zpw_type=30&t=${Date.now()}`;
    };

    const client = new WsClient({
      urlFactory,
      headers: {
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'User-Agent': account.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://chat.zalo.me',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookieStr,
      },
    });

    client.on('open', () => {
      logger.info('Listener connected', { accountId });
      this.emit('connected', accountId);
    });

    client.on('message', async (data: Buffer | string) => {
      await this.handleMessage(data, account.id, account.zpwEnk ?? null);
    });

    client.on('close', () => {
      this.emit('disconnected', accountId);
    });

    client.on('error', (err: Error) => {
      this.emit('error', err, accountId);
    });

    this.clients.set(accountId, client);
    client.connect();
  }

  /**
   * Stop listening on a specific account.
   */
  stopListening(accountId: string): void {
    const client = this.clients.get(accountId);
    if (client) {
      client.disconnect();
      this.clients.delete(accountId);
      logger.info('Listener stopped', { accountId });
    }
  }

  /**
   * Stop all active listeners.
   */
  stopAll(): void {
    for (const [accountId, client] of this.clients.entries()) {
      client.disconnect();
      logger.info('Listener stopped', { accountId });
    }
    this.clients.clear();
  }

  /**
   * Get all active listener account IDs.
   */
  getActiveListeners(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if a specific account is being listened to.
   */
  isListening(accountId: string): boolean {
    const client = this.clients.get(accountId);
    return client?.isConnected ?? false;
  }

  /**
   * Register a callback for incoming messages.
   */
  onMessage(callback: (msg: ZaloParsedMessage, accountId: string) => void): void {
    this.on('message', callback);
  }

  // ─── Internal ──────────────────────────────────────────────────────────

  private async handleMessage(
    rawData: Buffer | string,
    accountId: string,
    zpwEnk: string | null,
  ): Promise<void> {
    const parsed = parseRawMessage(rawData, zpwEnk);

    if (!parsed) {
      // Not a parseable message (could be ack, presence, etc.)
      return;
    }

    logger.info('Received Zalo message', {
      accountId,
      msgId: parsed.msgId,
      groupId: parsed.groupId,
      senderId: parsed.senderId,
      type: parsed.type,
    });

    // Emit event
    this.emit('message', parsed, accountId);

    try {
      // Store message in DB
      const savedMessage = await prisma.zaloMessage.upsert({
        where: { zaloMsgId: parsed.msgId },
        update: {},
        create: {
          zaloMsgId: parsed.msgId,
          accountId,
          groupId: parsed.groupId,
          groupName: parsed.groupName,
          senderId: parsed.senderId,
          senderName: parsed.senderName,
          type: parsed.type,
          text: parsed.text,
          images: parsed.images,
          rawData: parsed.raw as object,
        },
      });

      // Update account last message time
      await prisma.zaloAccount.update({
        where: { id: accountId },
        data: { lastMessageAt: new Date() },
      });

      // Build webhook payload and broadcast
      const webhookPayload: WebhookPayload = {
        event: 'message',
        source: 'zalo',
        account_id: accountId,
        group: {
          id: parsed.groupId ?? '',
          name: parsed.groupName ?? '',
        },
        sender: {
          id: parsed.senderId,
          name: parsed.senderName ?? '',
        },
        message: {
          id: savedMessage.id,
          type: parsed.type.toLowerCase(),
          text: parsed.text,
          images: parsed.images,
          timestamp: parsed.timestamp,
        },
        raw: parsed.raw,
      };

      await broadcastWebhook(webhookPayload, savedMessage.id, accountId);
    } catch (err) {
      logger.error('Failed to process message', {
        error: err instanceof Error ? err.message : String(err),
        msgId: parsed.msgId,
      });
    }
  }
}

// Singleton
export const listenerService = new ListenerService();

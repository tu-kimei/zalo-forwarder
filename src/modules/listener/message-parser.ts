import { decryptAesCbc } from '../../lib/crypto';
import { logger } from '../../lib/logger';

/**
 * Parsed Zalo message structure.
 */
export interface ZaloParsedMessage {
  msgId: string;
  groupId: string | null;
  groupName: string | null;
  senderId: string;
  senderName: string | null;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'STICKER' | 'UNKNOWN';
  text: string | null;
  images: string[];
  timestamp: number;
  raw: unknown;
}

/**
 * Parse a raw WebSocket message into a ZaloParsedMessage.
 *
 * TODO: This is a skeleton — the actual Zalo WS protocol sends encrypted binary frames.
 * Once the protocol is reverse-engineered, this function should:
 * 1. Determine the frame type (message, ack, presence, etc.)
 * 2. Decrypt the payload using zpw_enk (AES-CBC)
 * 3. Parse the decrypted JSON
 * 4. Extract group/sender/content fields
 */
export function parseRawMessage(
  rawData: Buffer | string,
  zpwEnk?: string | null,
): ZaloParsedMessage | null {
  try {
    let decoded: string;

    if (Buffer.isBuffer(rawData)) {
      // TODO: Binary frame — Zalo uses custom binary encoding
      // For now, try to interpret as UTF-8
      decoded = rawData.toString('utf8');
    } else {
      decoded = rawData;
    }

    // Attempt decryption if zpw_enk is provided and data looks encrypted (Base64)
    if (zpwEnk && isBase64(decoded)) {
      const decrypted = decryptAesCbc(decoded, zpwEnk);
      if (decrypted) {
        decoded = decrypted;
      }
    }

    // Try parsing as JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      logger.debug('Raw WS message is not JSON', { preview: decoded.slice(0, 200) });
      return null;
    }

    // TODO: Map Zalo protocol fields to our structure
    // The fields below are guesses based on typical Zalo WS payloads.
    // Adjust when actual protocol docs / captures are available.

    const msgId = String(parsed.msgId ?? parsed.globalMsgId ?? parsed.cliMsgId ?? `msg-${Date.now()}`);
    const groupId = parsed.idTo ? String(parsed.idTo) : null;
    const groupName = parsed.toName ? String(parsed.toName) : null;
    const senderId = String(parsed.uidFrom ?? parsed.fromUid ?? 'unknown');
    const senderName = parsed.dName ? String(parsed.dName) : null;
    const text = parsed.content ? String(parsed.content) : null;
    const ts = parsed.ts ? Number(parsed.ts) : Date.now();

    // Determine type
    let type: ZaloParsedMessage['type'] = 'UNKNOWN';
    const msgType = parsed.msgType ?? parsed.type;
    if (msgType === 1 || msgType === 'text' || text) {
      type = 'TEXT';
    } else if (msgType === 2 || msgType === 'image') {
      type = 'IMAGE';
    }

    // Extract images
    const images: string[] = [];
    if (parsed.thumbUrl) images.push(String(parsed.thumbUrl));
    if (parsed.hdUrl) images.push(String(parsed.hdUrl));
    if (Array.isArray(parsed.images)) {
      for (const img of parsed.images) {
        if (typeof img === 'string') images.push(img);
      }
    }

    return {
      msgId,
      groupId,
      groupName,
      senderId,
      senderName,
      type,
      text,
      images,
      timestamp: ts,
      raw: parsed,
    };
  } catch (err) {
    logger.error('Failed to parse raw WS message', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

function isBase64(str: string): boolean {
  if (str.length < 4) return false;
  return /^[A-Za-z0-9+/=]+$/.test(str.trim());
}

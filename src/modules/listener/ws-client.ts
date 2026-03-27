import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { logger } from '../../lib/logger';

export interface WsClientOptions {
  urlFactory: () => string;
  headers?: Record<string, string>;
  heartbeatIntervalMs?: number;
  reconnectMaxAttempts?: number;
}

/**
 * WebSocket wrapper with auto-reconnect (exponential backoff) and heartbeat.
 *
 * Events emitted:
 *  - 'message' (data: string | Buffer)
 *  - 'open'
 *  - 'close' (code: number, reason: string)
 *  - 'error' (err: Error)
 *  - 'reconnecting' (attempt: number)
 */
export class WsClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private urlFactory: () => string;
  private headers: Record<string, string>;
  private heartbeatIntervalMs: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectMaxAttempts: number;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(options: WsClientOptions) {
    super();
    this.urlFactory = options.urlFactory;
    this.headers = options.headers ?? {};
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30_000;
    this.reconnectMaxAttempts = options.reconnectMaxAttempts ?? 10;
  }

  /**
   * Connect to the WebSocket server.
   */
  connect(): void {
    this.intentionalClose = false;

    // Generate fresh URL on each connect (timestamp + random server)
    const url = this.urlFactory();

    // TODO: Zalo protocol — pass cookies, imei, zpw_enk etc. in headers
    this.ws = new WebSocket(url, { headers: this.headers });

    this.ws.on('open', () => {
      logger.info('WebSocket connected', { url });
      this.reconnectAttempt = 0;
      this.startHeartbeat();
      this.emit('open');
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      // TODO: Zalo protocol — data may be binary/encrypted
      this.emit('message', data);
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      logger.warn('WebSocket closed', { code, reason: reason.toString() });
      this.stopHeartbeat();
      this.emit('close', code, reason.toString());

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err: Error) => {
      logger.error('WebSocket error', { error: err.message });
      this.emit('error', err);
    });
  }

  /**
   * Gracefully disconnect.
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Send data over the WebSocket.
   */
  send(data: string | Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      logger.warn('Cannot send: WebSocket not open');
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ─── Heartbeat ─────────────────────────────────────────────────────────

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // TODO: Zalo heartbeat — send Zalo-specific ping frame
        this.ws.ping();
      }
    }, this.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Reconnect ─────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempt >= this.reconnectMaxAttempts) {
      logger.error('WebSocket max reconnect attempts reached', {
        attempts: this.reconnectAttempt,
      });
      return;
    }

    this.reconnectAttempt++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt - 1), 60_000);

    logger.info('WebSocket reconnecting...', { attempt: this.reconnectAttempt, delayMs: delay });
    this.emit('reconnecting', this.reconnectAttempt);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

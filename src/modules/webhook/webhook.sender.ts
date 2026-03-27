import crypto from 'crypto';
import { config } from '../../config';
import { logger } from '../../lib/logger';

export interface SendResult {
  success: boolean;
  statusCode?: number;
  response?: string;
  error?: string;
  attempt: number;
}

/**
 * Sign payload with HMAC-SHA256
 */
function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * POST a webhook payload to the given URL with HMAC-SHA256 signing.
 * Retries with exponential backoff: 1s → 2s → 4s (max 3 attempts).
 */
export async function sendWebhookRequest(
  url: string,
  payload: unknown,
  secret?: string | null,
): Promise<SendResult> {
  const body = JSON.stringify(payload);
  const maxAttempts = config.webhook.retryMax;
  const baseDelayMs = config.webhook.retryDelayMs;
  const timeoutMs = config.webhook.timeoutMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'ZaloForwarder/1.0',
      };

      if (secret) {
        headers['X-Webhook-Signature'] = signPayload(body, secret);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseText = await res.text().catch(() => '');

      if (res.ok) {
        logger.debug(`Webhook delivered to ${url}`, { attempt, statusCode: res.status });
        return {
          success: true,
          statusCode: res.status,
          response: responseText.slice(0, 1000),
          attempt,
        };
      }

      // Non-retryable client errors (4xx except 429)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        logger.warn(`Webhook delivery failed (non-retryable) to ${url}`, {
          statusCode: res.status,
          attempt,
        });
        return {
          success: false,
          statusCode: res.status,
          response: responseText.slice(0, 1000),
          error: `HTTP ${res.status}`,
          attempt,
        };
      }

      // Retryable error (5xx or 429)
      logger.warn(`Webhook delivery failed to ${url}, will retry`, {
        statusCode: res.status,
        attempt,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(`Webhook request error to ${url}`, { error: errorMessage, attempt });

      if (attempt === maxAttempts) {
        return {
          success: false,
          error: errorMessage,
          attempt,
        };
      }
    }

    // Exponential backoff before retry
    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    error: 'Max retries exceeded',
    attempt: maxAttempts,
  };
}

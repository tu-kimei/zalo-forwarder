import * as fs from 'fs';
import { config } from '../../config';
import { logger } from '../../lib/logger';
import { sendMessage } from '../telegram/telegram.service';
import { getFuelPrompt, getRepairPrompt } from './ocr.prompts';

/** Extracted record from AI (fuel or repair) */
export interface OcrExtractedRecord {
  [key: string]: unknown;
  confidence?: number;
  notes?: string | null;
}

/** Full AI processing result */
export interface OcrProcessingResult {
  records: OcrExtractedRecord[];
  rawResponse: string;
  model: string;
  promptTokens: number | null;
  responseTokens: number | null;
}

let lastModelDownAlertAt: number | null = null;
const MODEL_DOWN_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Build base64 image content block for the AI API.
 */
function buildImageContent(imagePath: string): {
  type: 'image_url';
  image_url: { url: string };
} {
  const buffer = fs.readFileSync(imagePath);
  const base64 = buffer.toString('base64');

  // Detect MIME type from extension
  const ext = imagePath.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  const mimeType = mimeMap[ext] || 'image/jpeg';

  return {
    type: 'image_url',
    image_url: {
      url: `data:${mimeType};base64,${base64}`,
    },
  };
}

/**
 * Parse AI response text to extract JSON.
 * Handles plain JSON, markdown code blocks, and embedded JSON.
 */
function parseAiJson(raw: string): unknown {
  // Try direct JSON parse
  try {
    return JSON.parse(raw);
  } catch {
    // continue
  }

  // Try extracting from markdown code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // Try finding first [ ... ] block (array)
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch {
      // continue
    }
  }

  // Try finding first { ... } block (object)
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      // Wrap single object in array
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // continue
    }
  }

  return null;
}

async function notifyNoAvailableOcrModel(
  category: string,
  imageCount: number,
  failures: Array<{ model: string; error: string }>,
): Promise<void> {
  const now = Date.now();
  if (lastModelDownAlertAt && now - lastModelDownAlertAt < MODEL_DOWN_ALERT_COOLDOWN_MS) {
    logger.warn('Skip OCR model-down alert due to cooldown', {
      cooldownMs: MODEL_DOWN_ALERT_COOLDOWN_MS,
      sinceLastMs: now - lastModelDownAlertAt,
    });
    return;
  }

  lastModelDownAlertAt = now;

  try {
    const failureLines = failures
      .slice(0, 4)
      .map((f) => `- ${f.model}: ${f.error.slice(0, 120)}`)
      .join('\n');

    const text = [
      '🚨 OCR lỗi: Không còn model khả dụng',
      '━━━━━━━━━━━━━━━',
      `📦 Category: ${category}`,
      `🖼️ Số ảnh: ${imageCount}`,
      `🤖 Models đã thử: ${failures.map((f) => f.model).join(', ')}`,
      '',
      'Chi tiết lỗi:',
      failureLines || '- (không có chi tiết)',
      '',
      '⚠️ Hành động: kiểm tra credentials/provider hoặc đổi OCR_AI_MODELS',
    ].join('\n');

    await sendMessage(config.telegram.ownerChatId, text);
    logger.info('Sent OCR model-down alert to owner');
  } catch (err) {
    logger.error('Failed to send OCR model-down alert', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Call AI Vision API with images and prompt.
 * Returns extracted structured data.
 *
 * Model strategy: try models in config.ocr.aiModels in order, fallback automatically.
 */
export async function processImages(
  imagePaths: string[],
  category: string,
  messageText?: string | null,
): Promise<OcrProcessingResult> {
  // Build image content blocks
  const imageBlocks = imagePaths.map((p) => buildImageContent(p));

  // Select prompt based on category
  const prompt =
    category === 'fuel'
      ? getFuelPrompt(imagePaths.length, messageText)
      : getRepairPrompt(imagePaths.length, messageText);

  // Build content array: images first, then text prompt
  const content: Array<
    | { type: 'image_url'; image_url: { url: string } }
    | { type: 'text'; text: string }
  > = [
    ...imageBlocks,
    { type: 'text', text: prompt },
  ];

  const models = Array.from(new Set((config.ocr.aiModels || []).filter(Boolean)));
  if (models.length === 0) {
    throw new Error('OCR models list is empty. Set OCR_AI_MODELS or config.ocr.aiModels.');
  }

  const failures: Array<{ model: string; error: string }> = [];

  for (const model of models) {
    const requestBody = {
      model,
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
    };

    logger.info('Calling AI Vision API', {
      model,
      imageCount: imagePaths.length,
      category,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(`${config.ocr.aiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.ocr.aiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errMsg = `AI API error ${response.status}: ${errorText}`;
        failures.push({ model, error: errMsg });
        logger.warn('OCR model failed, try next', { model, error: errMsg });
        continue;
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const rawResponse = data.choices?.[0]?.message?.content ?? '';
      const promptTokens = data.usage?.prompt_tokens ?? null;
      const responseTokens = data.usage?.completion_tokens ?? null;

      logger.info('AI Vision response received', {
        model,
        promptTokens,
        responseTokens,
        responseLength: rawResponse.length,
      });

      // Parse the JSON response
      const parsed = parseAiJson(rawResponse);

      let records: OcrExtractedRecord[];
      if (Array.isArray(parsed)) {
        records = parsed as OcrExtractedRecord[];
      } else if (parsed && typeof parsed === 'object') {
        records = [parsed as OcrExtractedRecord];
      } else {
        logger.warn('Failed to parse AI response as JSON', {
          model,
          rawPreview: rawResponse.slice(0, 500),
        });
        records = [];
      }

      return {
        records,
        rawResponse,
        model,
        promptTokens,
        responseTokens,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      failures.push({ model, error: errMsg });
      logger.warn('OCR model request error, try next', { model, error: errMsg });
    } finally {
      clearTimeout(timeout);
    }
  }

  // All models failed
  logger.error('All OCR models failed', {
    category,
    imageCount: imagePaths.length,
    attempted: failures.map((f) => f.model),
  });

  await notifyNoAvailableOcrModel(category, imagePaths.length, failures);

  throw new Error(
    `OCR failed: no available models. Tried ${failures.length} models: ${failures.map((f) => f.model).join(', ')}`,
  );
}

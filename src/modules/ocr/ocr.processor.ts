import * as fs from 'fs';
import { config } from '../../config';
import { logger } from '../../lib/logger';
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

/**
 * Call AI Vision API with images and prompt.
 * Returns extracted structured data.
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

  const requestBody = {
    model: config.ocr.aiModel,
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  };

  logger.info('Calling AI Vision API', {
    model: config.ocr.aiModel,
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
      throw new Error(`AI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const rawResponse = data.choices?.[0]?.message?.content ?? '';
    const promptTokens = data.usage?.prompt_tokens ?? null;
    const responseTokens = data.usage?.completion_tokens ?? null;

    logger.info('AI Vision response received', {
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
        rawPreview: rawResponse.slice(0, 500),
      });
      records = [];
    }

    return {
      records,
      rawResponse,
      model: config.ocr.aiModel,
      promptTokens,
      responseTokens,
    };
  } finally {
    clearTimeout(timeout);
  }
}

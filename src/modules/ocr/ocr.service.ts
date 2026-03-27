import { PrismaClient } from '@prisma/client';
import { downloadAllImages } from '../images/image.service';
import { processImages, OcrProcessingResult } from './ocr.processor';
import { validateFuelData, validateRepairData, ValidationResult } from './ocr.validator';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

/**
 * Full OCR pipeline for a message:
 * 1. Get message + images from DB
 * 2. Download images if not downloaded
 * 3. Call AI Vision OCR
 * 4. Validate extracted data
 * 5. Save OcrResult(s) to DB
 * 6. Return results
 */
export async function processMessage(
  messageId: string,
  category: string,
): Promise<Array<{ ocrResultId: string; data: Record<string, unknown>; validation: ValidationResult }>> {
  // 1. Get message
  const message = await prisma.zaloMessage.findUnique({
    where: { id: messageId },
    include: { imageAttachments: true },
  });

  if (!message) {
    throw new Error(`Message not found: ${messageId}`);
  }

  // 2. Download images if not yet downloaded
  let imageUrls = message.images;
  if (imageUrls.length === 0 && message.imageAttachments.length > 0) {
    imageUrls = message.imageAttachments.map((a) => a.originalUrl);
  }

  if (imageUrls.length > 0) {
    await downloadAllImages(messageId, imageUrls);
  }

  // Reload attachments after download
  const attachments = await prisma.imageAttachment.findMany({
    where: { messageId, downloaded: true, localPath: { not: null } },
    orderBy: { createdAt: 'asc' },
  });

  const imagePaths = attachments
    .map((a) => a.localPath)
    .filter((p): p is string => p !== null);

  if (imagePaths.length === 0 && !message.text) {
    throw new Error(`No images downloaded and no text for message: ${messageId}`);
  }

  // 3. Call AI Vision OCR (only if we have images)
  let aiResult: OcrProcessingResult;
  if (imagePaths.length > 0) {
    aiResult = await processImages(imagePaths, category, message.text);
  } else {
    // Text-only message — no AI vision call, return empty
    aiResult = {
      records: [],
      rawResponse: '',
      model: '',
      promptTokens: null,
      responseTokens: null,
    };
  }

  if (aiResult.records.length === 0) {
    logger.warn('No records extracted from OCR', { messageId, category });
  }

  // 4 & 5. Validate each record and save OcrResult
  const results: Array<{
    ocrResultId: string;
    data: Record<string, unknown>;
    validation: ValidationResult;
  }> = [];

  for (const record of aiResult.records) {
    const recordData = record as Record<string, unknown>;

    // 4. Validate
    const validation =
      category === 'fuel'
        ? await validateFuelData(recordData)
        : await validateRepairData(recordData);

    // 5. Save OcrResult
    const ocrResult = await prisma.ocrResult.create({
      data: {
        messageId,
        imageId: attachments[0]?.id ?? null,
        category,
        groupId: message.groupId,
        extractedData: recordData as object,
        confidence: validation.confidence,
        aiModel: aiResult.model || null,
        aiPromptTokens: aiResult.promptTokens,
        aiResponseTokens: aiResult.responseTokens,
        rawAiResponse: aiResult.rawResponse,
        status: 'pending',
      },
    });

    results.push({
      ocrResultId: ocrResult.id,
      data: recordData,
      validation,
    });

    logger.info('OCR result saved', {
      ocrResultId: ocrResult.id,
      messageId,
      category,
      confidence: validation.confidence,
      warnings: validation.warnings,
    });
  }

  return results;
}

/**
 * Confirm an OCR result (set status to confirmed).
 */
export async function confirmResult(
  resultId: string,
  reviewNote?: string,
): Promise<void> {
  await prisma.ocrResult.update({
    where: { id: resultId },
    data: {
      status: 'confirmed',
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });

  logger.info('OCR result confirmed', { resultId });
}

/**
 * Reject an OCR result (set status to rejected).
 */
export async function rejectResult(
  resultId: string,
  reviewNote?: string,
): Promise<void> {
  await prisma.ocrResult.update({
    where: { id: resultId },
    data: {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });

  logger.info('OCR result rejected', { resultId });
}

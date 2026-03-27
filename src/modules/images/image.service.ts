import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../../config';
import { logger } from '../../lib/logger';

const prisma = new PrismaClient();

/**
 * Ensure storage directory exists.
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Build the local storage path for an image.
 * Pattern: ./storage/images/YYYY-MM/{messageId}/img-{index}.jpg
 */
function buildImagePath(messageId: string, index: number): string {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return path.join(config.storage.basePath, yearMonth, messageId, `img-${index}.jpg`);
}

/**
 * Download a single image from URL and save to local storage.
 */
export async function downloadImage(
  url: string,
  messageId: string,
  index: number,
): Promise<{ localPath: string; fileSize: number; mimeType: string }> {
  const localPath = buildImagePath(messageId, index);
  const dir = path.dirname(localPath);
  ensureDir(dir);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} downloading image from ${url}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const fileSize = buffer.length;

    // Skip excessively large files (> 20MB)
    if (fileSize > 20 * 1024 * 1024) {
      throw new Error(`Image too large: ${fileSize} bytes`);
    }

    fs.writeFileSync(localPath, buffer);

    logger.info('Image downloaded', { messageId, index, localPath, fileSize });

    return { localPath, fileSize, mimeType };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Download all images for a message and create ImageAttachment records.
 */
export async function downloadAllImages(
  messageId: string,
  urls: string[],
): Promise<string[]> {
  const attachmentIds: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;

    // Check if attachment already exists for this URL
    const existing = await prisma.imageAttachment.findFirst({
      where: { messageId, originalUrl: url },
    });

    if (existing && existing.downloaded) {
      attachmentIds.push(existing.id);
      continue;
    }

    try {
      const { localPath, fileSize, mimeType } = await downloadImage(url, messageId, i);

      const attachment = existing
        ? await prisma.imageAttachment.update({
            where: { id: existing.id },
            data: {
              localPath,
              fileSize,
              mimeType,
              fileName: path.basename(localPath),
              downloaded: true,
              downloadError: null,
            },
          })
        : await prisma.imageAttachment.create({
            data: {
              messageId,
              originalUrl: url,
              localPath,
              fileName: path.basename(localPath),
              mimeType,
              fileSize,
              downloaded: true,
            },
          });

      attachmentIds.push(attachment.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Failed to download image', { messageId, index: i, url, error: errorMsg });

      if (!existing) {
        const attachment = await prisma.imageAttachment.create({
          data: {
            messageId,
            originalUrl: url,
            downloaded: false,
            downloadError: errorMsg,
          },
        });
        attachmentIds.push(attachment.id);
      } else {
        await prisma.imageAttachment.update({
          where: { id: existing.id },
          data: { downloadError: errorMsg },
        });
        attachmentIds.push(existing.id);
      }
    }
  }

  return attachmentIds;
}

/**
 * Get local file path for an image attachment.
 */
export async function getImagePath(attachmentId: string): Promise<string | null> {
  const attachment = await prisma.imageAttachment.findUnique({
    where: { id: attachmentId },
  });

  if (!attachment?.localPath) return null;

  // Verify file still exists on disk
  if (!fs.existsSync(attachment.localPath)) {
    logger.warn('Image file missing from disk', { attachmentId, localPath: attachment.localPath });
    return null;
  }

  return attachment.localPath;
}

/**
 * Delete images older than N days from disk and mark records.
 */
export async function cleanupOldImages(days: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const oldAttachments = await prisma.imageAttachment.findMany({
    where: {
      createdAt: { lt: cutoff },
      downloaded: true,
      localPath: { not: null },
    },
  });

  let deleted = 0;
  for (const att of oldAttachments) {
    if (att.localPath && fs.existsSync(att.localPath)) {
      try {
        fs.unlinkSync(att.localPath);
        deleted++;
      } catch (err) {
        logger.error('Failed to delete image file', { attachmentId: att.id, error: err });
      }
    }

    await prisma.imageAttachment.update({
      where: { id: att.id },
      data: { localPath: null, downloaded: false },
    });
  }

  logger.info('Image cleanup completed', { days, deleted, total: oldAttachments.length });
  return deleted;
}

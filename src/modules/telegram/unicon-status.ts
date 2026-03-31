import { PrismaClient } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';

const uniconPrisma = new PrismaClient({
  datasources: { db: { url: config.uniconDb.url } },
});

interface UniconLogStatus {
  ocrResultId: string;
  status: string;
}

export async function checkUniconStatus(
  ocrResultId: string,
  category: 'fuel' | 'repair'
): Promise<string | null> {
  const table = category === 'fuel' ? 'fuel_logs' : 'repair_logs';

  try {
    const rows = await uniconPrisma.$queryRawUnsafe<UniconLogStatus[]>(
      `SELECT "ocrResultId", status FROM ${table} WHERE "ocrResultId" = $1 LIMIT 1`,
      ocrResultId
    );

    if (!rows || rows.length === 0) return null;
    return rows[0].status ?? null;
  } catch (err) {
    logger.error(`Failed to check status in ${table}`, {
      ocrResultId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

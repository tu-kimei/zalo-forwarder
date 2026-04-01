import pg from 'pg';
import type { OcrResult } from '@prisma/client';
import { config } from '../../config';
import { logger } from '../../lib/logger';

const { Pool } = pg;

let pool: pg.Pool | null = null;

/**
 * Get or create the connection pool for unicon_schedule DB.
 */
export function getUniconPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: config.uniconDb.url,
      max: 5,
      idleTimeoutMillis: 30_000,
    });

    pool.on('error', (err) => {
      logger.error('Unicon DB pool error', { error: err.message });
    });
  }
  return pool;
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const normalized = value.replace(/[\s,]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function pickDate(value: unknown): string | null {
  const s = pickString(value);
  if (!s) return null;

  // Accept YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function pickStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
}

function normalizePlateForMatch(plate: string): string {
  return plate.replace(/[\s.-]/g, '').toUpperCase();
}

function buildZaloMsgId(base: string | null | undefined, ocrResultId: string): string | null {
  if (!base || !base.trim()) return null;
  // Avoid unique collision when one message yields multiple OCR records.
  return `${base.trim()}:${ocrResultId.slice(0, 8)}`;
}

export async function upsertPendingUniconLogFromOcr(params: {
  ocr: OcrResult;
  zaloMsgId?: string | null;
  groupName?: string | null;
  images?: string[];
}): Promise<{ category: 'fuel' | 'repair'; logId: string }> {
  const category = params.ocr.category === 'repair' ? 'repair' : 'fuel';
  if (category === 'fuel') {
    const logId = await upsertFuelLogFromOcr(params);
    return { category, logId };
  }
  const logId = await upsertRepairLogFromOcr(params);
  return { category, logId };
}

async function upsertFuelLogFromOcr(params: {
  ocr: OcrResult;
  zaloMsgId?: string | null;
  groupName?: string | null;
  images?: string[];
}): Promise<string> {
  const p = getUniconPool();
  const data = (params.ocr.extractedData ?? {}) as Record<string, unknown>;

  const licensePlate = pickString(data.licensePlate) ?? 'UNKNOWN';
  const driverName = pickString(data.driverName);
  const fuelDate = pickDate(data.fuelDate) ?? new Date().toISOString().slice(0, 10);

  const liters = pickNumber(data.liters, 0);
  const unitPrice = pickNumber(data.unitPrice, 0);
  const totalAmount = pickNumber(data.totalAmount, 0);

  const notes = pickString(data.notes);
  const storeName = pickString(data.storeName);

  const imageUrls = pickStringArray(data.images).length > 0
    ? pickStringArray(data.images)
    : (params.images ?? []);

  const normalizedPlate = normalizePlateForMatch(licensePlate);
  const vehicleId = normalizedPlate !== 'UNKNOWN' ? await matchVehicle(normalizedPlate) : null;
  const driverId = driverName ? await matchDriver(driverName) : null;

  const result = await p.query(
    `INSERT INTO fuel_logs (
      "zaloMsgId", "zaloGroupName", "fuelDate", "licensePlate",
      "vehicleId", "driverName", "driverId",
      "liters", "unitPrice", "totalAmount",
      "imageUrls", "hasInvoice", "confidence",
      "rawText", "aiNotes", "status", "ocrResultId",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10,
      $11, $12, $13,
      $14, $15, 'pending', $16,
      NOW(), NOW()
    )
    ON CONFLICT ("ocrResultId") DO UPDATE SET
      "zaloMsgId" = EXCLUDED."zaloMsgId",
      "zaloGroupName" = EXCLUDED."zaloGroupName",
      "fuelDate" = EXCLUDED."fuelDate",
      "licensePlate" = EXCLUDED."licensePlate",
      "vehicleId" = EXCLUDED."vehicleId",
      "driverName" = EXCLUDED."driverName",
      "driverId" = EXCLUDED."driverId",
      "liters" = EXCLUDED."liters",
      "unitPrice" = EXCLUDED."unitPrice",
      "totalAmount" = EXCLUDED."totalAmount",
      "imageUrls" = EXCLUDED."imageUrls",
      "hasInvoice" = EXCLUDED."hasInvoice",
      "confidence" = EXCLUDED."confidence",
      "rawText" = EXCLUDED."rawText",
      "aiNotes" = EXCLUDED."aiNotes",
      "status" = EXCLUDED."status",
      "updatedAt" = NOW()
    RETURNING id`,
    [
      buildZaloMsgId(params.zaloMsgId, params.ocr.id),
      params.groupName ?? null,
      fuelDate,
      licensePlate,
      vehicleId,
      driverName,
      driverId,
      liters,
      unitPrice,
      totalAmount,
      imageUrls,
      imageUrls.length > 0,
      params.ocr.confidence,
      params.ocr.rawAiResponse ?? null,
      [storeName, notes].filter(Boolean).join(' | ') || null,
      params.ocr.id,
    ],
  );

  const id = String(result.rows[0]?.id ?? '');
  logger.info('Fuel log upserted to unicon_schedule (pending)', {
    ocrResultId: params.ocr.id,
    logId: id,
    licensePlate,
  });

  return id;
}

async function upsertRepairLogFromOcr(params: {
  ocr: OcrResult;
  zaloMsgId?: string | null;
  groupName?: string | null;
  images?: string[];
}): Promise<string> {
  const p = getUniconPool();
  const data = (params.ocr.extractedData ?? {}) as Record<string, unknown>;

  const licensePlate = pickString(data.licensePlate) ?? 'UNKNOWN';
  const driverName = pickString(data.driverName);
  const repairDate = pickDate(data.repairDate ?? data.date) ?? new Date().toISOString().slice(0, 10);

  const garageName = pickString(data.garageName);
  const garageAddress = pickString(data.garageAddress ?? data.address);
  const km = pickNumber(data.km ?? data.odometer, 0);
  const totalAmount = pickNumber(data.totalAmount, 0);

  const notes = pickString(data.notes);
  const items = Array.isArray(data.items) ? data.items : [];

  const imageUrls = pickStringArray(data.images).length > 0
    ? pickStringArray(data.images)
    : (params.images ?? []);

  const normalizedPlate = normalizePlateForMatch(licensePlate);
  const vehicleId = normalizedPlate !== 'UNKNOWN' ? await matchVehicle(normalizedPlate) : null;
  const driverId = driverName ? await matchDriver(driverName) : null;

  const result = await p.query(
    `INSERT INTO repair_logs (
      "zaloMsgId", "zaloGroupName", "repairDate", "licensePlate",
      "vehicleId", "driverName", "driverId",
      "garageName", "garageAddress", "items", "totalAmount", "km",
      "imageUrls", "confidence", "rawText", "aiNotes",
      "status", "ocrResultId", "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10::jsonb, $11, $12,
      $13, $14, $15, $16,
      'pending', $17, NOW(), NOW()
    )
    ON CONFLICT ("ocrResultId") DO UPDATE SET
      "zaloMsgId" = EXCLUDED."zaloMsgId",
      "zaloGroupName" = EXCLUDED."zaloGroupName",
      "repairDate" = EXCLUDED."repairDate",
      "licensePlate" = EXCLUDED."licensePlate",
      "vehicleId" = EXCLUDED."vehicleId",
      "driverName" = EXCLUDED."driverName",
      "driverId" = EXCLUDED."driverId",
      "garageName" = EXCLUDED."garageName",
      "garageAddress" = EXCLUDED."garageAddress",
      "items" = EXCLUDED."items",
      "totalAmount" = EXCLUDED."totalAmount",
      "km" = EXCLUDED."km",
      "imageUrls" = EXCLUDED."imageUrls",
      "confidence" = EXCLUDED."confidence",
      "rawText" = EXCLUDED."rawText",
      "aiNotes" = EXCLUDED."aiNotes",
      "status" = EXCLUDED."status",
      "updatedAt" = NOW()
    RETURNING id`,
    [
      buildZaloMsgId(params.zaloMsgId, params.ocr.id),
      params.groupName ?? null,
      repairDate,
      licensePlate,
      vehicleId,
      driverName,
      driverId,
      garageName,
      garageAddress,
      JSON.stringify(items),
      totalAmount,
      km,
      imageUrls,
      params.ocr.confidence,
      params.ocr.rawAiResponse ?? null,
      notes,
      params.ocr.id,
    ],
  );

  const id = String(result.rows[0]?.id ?? '');
  logger.info('Repair log upserted to unicon_schedule (pending)', {
    ocrResultId: params.ocr.id,
    logId: id,
    licensePlate,
  });

  return id;
}

/**
 * Match a license plate to a vehicle ID in unicon_schedule.
 */
export async function matchVehicle(licensePlate: string): Promise<string | null> {
  const p = getUniconPool();
  const normalized = licensePlate.replace(/[\s-]/g, '').toUpperCase();

  try {
    const result = await p.query(
      `SELECT id FROM vehicles
       WHERE REPLACE(REPLACE("licensePlate", ' ', ''), '-', '') = $1
       LIMIT 1`,
      [normalized],
    );
    return result.rows[0]?.id ? String(result.rows[0].id) : null;
  } catch (err) {
    logger.debug('matchVehicle query failed', { error: err });
    return null;
  }
}

/**
 * Match a driver name to a driver ID in unicon_schedule (fuzzy).
 */
export async function matchDriver(driverName: string): Promise<string | null> {
  const p = getUniconPool();

  try {
    // Try exact substring match first
    const result = await p.query(
      `SELECT id, "fullName" FROM drivers
       WHERE LOWER("fullName") LIKE $1
       LIMIT 1`,
      [`%${driverName.toLowerCase()}%`],
    );

    if (result.rows[0]?.id) {
      return String(result.rows[0].id);
    }

    // Try matching by last name (Vietnamese convention: last word is first name)
    const lastName = driverName.trim().split(/\s+/).pop();
    if (lastName && lastName.length >= 2) {
      const result2 = await p.query(
        `SELECT id, "fullName" FROM drivers
         WHERE LOWER("fullName") LIKE $1
         LIMIT 1`,
        [`%${lastName.toLowerCase()}%`],
      );
      return result2.rows[0]?.id ? String(result2.rows[0].id) : null;
    }

    return null;
  } catch (err) {
    logger.debug('matchDriver query failed', { error: err });
    return null;
  }
}

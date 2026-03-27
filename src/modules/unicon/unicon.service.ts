import pg from 'pg';
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

/**
 * Write a fuel log to unicon_schedule.fuel_logs.
 * Returns the inserted row ID.
 */
export async function writeFuelLog(data: {
  licensePlate: string;
  driverName?: string | null;
  fuelDate: string;
  liters?: number | null;
  unitPrice?: number | null;
  totalAmount?: number | null;
  storeName?: string | null;
  zaloMsgId?: string | null;
  groupName?: string | null;
  confidence?: number;
  notes?: string | null;
}): Promise<string> {
  const p = getUniconPool();

  const vehicleId = await matchVehicle(data.licensePlate);
  const driverId = data.driverName ? await matchDriver(data.driverName) : null;

  const result = await p.query(
    `INSERT INTO fuel_logs (
      "vehicleId", "driverId", "licensePlate", "driverName",
      "fuelDate", "liters", "unitPrice", "totalAmount",
      "storeName", "zaloMsgId", "groupName",
      "confidence", "notes", "status",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8,
      $9, $10, $11,
      $12, $13, 'confirmed',
      NOW(), NOW()
    ) RETURNING id`,
    [
      vehicleId,
      driverId,
      data.licensePlate,
      data.driverName ?? null,
      data.fuelDate,
      data.liters ?? null,
      data.unitPrice ?? null,
      data.totalAmount ?? null,
      data.storeName ?? null,
      data.zaloMsgId ?? null,
      data.groupName ?? null,
      data.confidence ?? 0,
      data.notes ?? null,
    ],
  );

  const id = String(result.rows[0]?.id ?? '');
  logger.info('Fuel log written to unicon_schedule', { id, licensePlate: data.licensePlate });
  return id;
}

/**
 * Write a repair log to unicon_schedule.repair_logs.
 * Returns the inserted row ID.
 */
export async function writeRepairLog(data: {
  licensePlate: string;
  driverName?: string | null;
  repairDate: string;
  garageName?: string | null;
  garageAddress?: string | null;
  items?: Array<{ name: string; quantity?: number | null; unitPrice?: number | null; amount: number }>;
  totalAmount?: number | null;
  km?: number | null;
  zaloMsgId?: string | null;
  groupName?: string | null;
  confidence?: number;
  notes?: string | null;
}): Promise<string> {
  const p = getUniconPool();

  const vehicleId = await matchVehicle(data.licensePlate);
  const driverId = data.driverName ? await matchDriver(data.driverName) : null;

  const result = await p.query(
    `INSERT INTO repair_logs (
      "vehicleId", "driverId", "licensePlate", "driverName",
      "repairDate", "garageName", "garageAddress",
      "items", "totalAmount", "km",
      "zaloMsgId", "groupName",
      "confidence", "notes", "status",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7,
      $8, $9, $10,
      $11, $12,
      $13, $14, 'confirmed',
      NOW(), NOW()
    ) RETURNING id`,
    [
      vehicleId,
      driverId,
      data.licensePlate,
      data.driverName ?? null,
      data.repairDate,
      data.garageName ?? null,
      data.garageAddress ?? null,
      JSON.stringify(data.items ?? []),
      data.totalAmount ?? null,
      data.km ?? null,
      data.zaloMsgId ?? null,
      data.groupName ?? null,
      data.confidence ?? 0,
      data.notes ?? null,
    ],
  );

  const id = String(result.rows[0]?.id ?? '');
  logger.info('Repair log written to unicon_schedule', { id, licensePlate: data.licensePlate });
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

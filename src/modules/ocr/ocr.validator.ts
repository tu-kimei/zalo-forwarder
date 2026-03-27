import { logger } from '../../lib/logger';
import { getUniconPool } from '../unicon/unicon.service';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
}

/**
 * Vietnamese license plate pattern.
 * Examples: 51D-12345, 61C-234.56, 51D-123.45
 */
const VN_PLATE_REGEX = /^\d{2}[A-Z]\d?[-.]?\d{3,5}\.?\d{0,2}$/;

/**
 * Normalize a license plate: remove spaces, force uppercase.
 */
function normalizePlate(plate: string): string {
  return plate.replace(/\s+/g, '').toUpperCase();
}

/**
 * Validate fuel invoice data.
 */
export async function validateFuelData(
  data: Record<string, unknown>,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidence = (typeof data.confidence === 'number' ? data.confidence : 0.8);

  // Required fields
  const required = ['licensePlate', 'fuelDate', 'liters', 'totalAmount'];
  for (const field of required) {
    if (data[field] === null || data[field] === undefined || data[field] === '') {
      confidence -= 0.2;
      warnings.push(`Thiếu: ${field}`);
    }
  }

  // License plate format
  if (typeof data.licensePlate === 'string' && data.licensePlate) {
    const normalized = normalizePlate(data.licensePlate);
    if (!VN_PLATE_REGEX.test(normalized)) {
      confidence -= 0.1;
      warnings.push(`Biển số không đúng format: ${data.licensePlate}`);
    } else {
      // Try matching against DB
      try {
        await matchPlateAgainstDb(normalized, warnings);
      } catch (err) {
        logger.debug('Could not match plate against DB', { error: err });
      }
    }
  }

  // Liters sanity check
  if (typeof data.liters === 'number') {
    if (data.liters <= 0 || data.liters > 1000) {
      confidence -= 0.15;
      warnings.push(`Số lít bất thường: ${data.liters}`);
    }
  }

  // Unit price sanity check (diesel VN ~15000-30000 VND/L)
  if (typeof data.unitPrice === 'number') {
    if (data.unitPrice < 10000 || data.unitPrice > 50000) {
      confidence -= 0.1;
      warnings.push(`Đơn giá bất thường: ${data.unitPrice}`);
    }
  }

  // Cross-validate: totalAmount ≈ liters × unitPrice
  if (
    typeof data.liters === 'number' &&
    typeof data.unitPrice === 'number' &&
    typeof data.totalAmount === 'number' &&
    data.liters > 0 &&
    data.unitPrice > 0
  ) {
    const expected = data.liters * data.unitPrice;
    const diff = Math.abs(expected - data.totalAmount) / expected;
    if (diff > 0.05) {
      confidence -= 0.1;
      warnings.push(
        `totalAmount chênh lệch: expected ${Math.round(expected)}, got ${data.totalAmount}`,
      );
    }
  }

  // Date sanity: should be within 7 days
  if (typeof data.fuelDate === 'string' && data.fuelDate) {
    const date = new Date(data.fuelDate);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7 || diffDays < -1) {
      confidence -= 0.1;
      warnings.push(`Ngày đổ dầu khác biệt: ${data.fuelDate}`);
    }
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    isValid: errors.length === 0,
    confidence,
    errors,
    warnings,
  };
}

/**
 * Validate repair invoice data.
 */
export async function validateRepairData(
  data: Record<string, unknown>,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let confidence = (typeof data.confidence === 'number' ? data.confidence : 0.8);

  // Required fields
  const required = ['licensePlate', 'repairDate', 'totalAmount'];
  for (const field of required) {
    if (data[field] === null || data[field] === undefined || data[field] === '') {
      confidence -= 0.2;
      warnings.push(`Thiếu: ${field}`);
    }
  }

  // License plate format
  if (typeof data.licensePlate === 'string' && data.licensePlate) {
    const normalized = normalizePlate(data.licensePlate);
    if (!VN_PLATE_REGEX.test(normalized)) {
      confidence -= 0.1;
      warnings.push(`Biển số không đúng format: ${data.licensePlate}`);
    } else {
      try {
        await matchPlateAgainstDb(normalized, warnings);
      } catch (err) {
        logger.debug('Could not match plate against DB', { error: err });
      }
    }
  }

  // Total amount sanity
  if (typeof data.totalAmount === 'number') {
    if (data.totalAmount <= 0) {
      confidence -= 0.15;
      warnings.push(`Tổng tiền bất thường: ${data.totalAmount}`);
    }
  }

  // Date sanity
  if (typeof data.repairDate === 'string' && data.repairDate) {
    const date = new Date(data.repairDate);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 7 || diffDays < -1) {
      confidence -= 0.1;
      warnings.push(`Ngày sửa chữa khác biệt: ${data.repairDate}`);
    }
  }

  confidence = Math.max(0, Math.min(1, confidence));

  return {
    isValid: errors.length === 0,
    confidence,
    errors,
    warnings,
  };
}

/**
 * Match license plate against vehicles table in unicon_schedule DB.
 * Adds a warning if plate not found.
 */
async function matchPlateAgainstDb(
  normalizedPlate: string,
  warnings: string[],
): Promise<void> {
  const pool = getUniconPool();
  const result = await pool.query(
    `SELECT id, "licensePlate" FROM vehicles
     WHERE REPLACE(REPLACE("licensePlate", ' ', ''), '-', '') = $1
     LIMIT 1`,
    [normalizedPlate.replace(/-/g, '')],
  );

  if (result.rowCount === 0) {
    warnings.push(`Biển số chưa có trong hệ thống: ${normalizedPlate}`);
  }
}

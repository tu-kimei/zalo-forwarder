/**
 * Fuzzy matching utilities for Vietnamese names and license plates.
 */

/**
 * Normalize a Vietnamese license plate for comparison.
 * Removes spaces, dashes, dots. Forces uppercase.
 */
export function normalizePlate(plate: string): string {
  return plate
    .replace(/[\s\-\.]+/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Check if two license plates match after normalization.
 */
export function platesMatch(a: string, b: string): boolean {
  return normalizePlate(a) === normalizePlate(b);
}

/**
 * Normalize Vietnamese text for comparison.
 * Lowercases and trims whitespace.
 */
function normalizeVietnamese(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Check if a Vietnamese driver name matches (partial match).
 * Vietnamese names: Họ + Tên đệm + Tên (e.g., "Nguyễn Văn Anh")
 * Common matching: full name, or just tên (last word)
 */
export function namesMatch(nameA: string, nameB: string): boolean {
  const a = normalizeVietnamese(nameA);
  const b = normalizeVietnamese(nameB);

  // Exact match
  if (a === b) return true;

  // One contains the other
  if (a.includes(b) || b.includes(a)) return true;

  // Last word (first name in Vietnamese) match
  const lastA = a.split(' ').pop() || '';
  const lastB = b.split(' ').pop() || '';
  if (lastA.length >= 2 && lastA === lastB) return true;

  return false;
}

/**
 * Calculate simple similarity score between two strings (0-1).
 * Based on longest common subsequence ratio.
 */
export function similarity(a: string, b: string): number {
  const s1 = normalizeVietnamese(a);
  const s2 = normalizeVietnamese(b);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const len1 = s1.length;
  const len2 = s2.length;

  // LCS via DP
  const dp: number[][] = Array.from({ length: len1 + 1 }, () =>
    Array.from({ length: len2 + 1 }, () => 0),
  );

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcsLen = dp[len1][len2];
  return (2 * lcsLen) / (len1 + len2);
}

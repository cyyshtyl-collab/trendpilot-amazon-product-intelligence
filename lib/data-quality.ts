export type DataQualityReport = {
  total: number;
  fresh: number;
  stale: number;
  missingPrice: number;
  missingRating: number;
  missingBsr: number;
  completeness: number;
};

type QualityRow = Record<string, string | number | null>;

/** Treats marketplace currency text as present only when it contains a positive amount. */
function hasPositiveAmount(value: unknown): boolean {
  const parsed = Number.parseFloat(String(value ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0;
}

/** Summarizes freshness and essential Listing-field coverage for ASIN-backed products. */
export function summarizeDataQuality(
  rows: QualityRow[],
  now: Date = new Date(),
): DataQualityReport {
  const staleBefore = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const freshAfter = now.getTime() - 48 * 60 * 60 * 1000;
  let fresh = 0;
  let stale = 0;
  let missingPrice = 0;
  let missingRating = 0;
  let missingBsr = 0;
  for (const row of rows) {
    const updatedAt = Date.parse(String(row.updated_at ?? ''));
    if (Number.isFinite(updatedAt) && updatedAt >= freshAfter) fresh += 1;
    if (!Number.isFinite(updatedAt) || updatedAt < staleBefore) stale += 1;
    if (!hasPositiveAmount(row.price)) missingPrice += 1;
    if (Number(row.rating ?? 0) <= 0) missingRating += 1;
    if (Number(row.bsr ?? 0) <= 0) missingBsr += 1;
  }
  const total = rows.length;
  const populated = total * 3 - missingPrice - missingRating - missingBsr;
  return {
    total,
    fresh,
    stale,
    missingPrice,
    missingRating,
    missingBsr,
    completeness: total ? Math.round((populated / (total * 3)) * 100) : 0,
  };
}

/** Formats a compact audit message suitable for the collection-run timeline. */
export function qualitySummary(report: DataQualityReport): string {
  return `完整度 ${report.completeness}% · 48小时内 ${report.fresh} · 过期 ${report.stale} · 缺价格 ${report.missingPrice} · 缺评分 ${report.missingRating} · 缺BSR ${report.missingBsr}`;
}

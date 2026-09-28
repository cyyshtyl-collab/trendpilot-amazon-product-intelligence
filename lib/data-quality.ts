export type DataQualityReport = {
  total: number;
  fullyComplete: number;
  decisionReady: number;
  finalScoreReady: number;
  nearReady: number;
  fresh: number;
  stale: number;
  missingPrice: number;
  missingRating: number;
  missingBsr: number;
  missingReviews: number;
  missingTrend: number;
  missingMargin: number;
  completeness: number;
};

type QualityRow = Record<string, string | number | null>;

/** Returns true when an audit event explicitly verified the named metric. */
function verified(row: QualityRow, field: string): boolean {
  const value = row.verification_fields;
  return typeof value === 'string' && value.split(/[、,|]/).includes(field);
}

/** Treats marketplace currency text as present only when it contains a positive amount. */
function hasPositiveAmount(value: unknown): boolean {
  if (typeof value !== 'string' && typeof value !== 'number') return false;
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.]/g, ''));
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
  let missingReviews = 0;
  let fullyComplete = 0;
  let decisionReady = 0;
  let finalScoreReady = 0;
  let nearReady = 0;
  let missingTrend = 0;
  let missingMargin = 0;
  for (const row of rows) {
    const updatedAt = Date.parse(String(row.updated_at ?? ''));
    if (Number.isFinite(updatedAt) && updatedAt >= freshAfter) fresh += 1;
    if (!Number.isFinite(updatedAt) || updatedAt < staleBefore) stale += 1;
    const fields = [
      hasPositiveAmount(row.price),
      Number(row.bsr ?? 0) > 0,
      Number(row.rating ?? 0) > 0,
      Number(row.reviews ?? 0) > 0,
    ];
    const populated = fields.filter(Boolean).length;
    if (!fields[0]) missingPrice += 1;
    if (!fields[1]) missingBsr += 1;
    if (!fields[2]) missingRating += 1;
    if (!fields[3]) missingReviews += 1;
    const trend = Number(row.trend ?? 0);
    const margin = Number(row.margin ?? 0);
    const hasTrend = Number.isFinite(trend) && (trend !== 0 || verified(row, '趋势'));
    const hasMargin = Number.isFinite(margin) && (margin !== 0 || verified(row, '毛利'));
    if (!hasTrend) missingTrend += 1;
    if (!hasMargin) missingMargin += 1;
    if (populated === 4) fullyComplete += 1;
    if (populated >= 3) decisionReady += 1;
    else if (populated === 2) nearReady += 1;
    if (populated === 4 && hasTrend && hasMargin) finalScoreReady += 1;
  }
  const total = rows.length;
  const populated =
    total * 4 - missingPrice - missingRating - missingBsr - missingReviews;
  return {
    total,
    fullyComplete,
    decisionReady,
    finalScoreReady,
    nearReady,
    fresh,
    stale,
    missingPrice,
    missingRating,
    missingBsr,
    missingReviews,
    missingTrend,
    missingMargin,
    completeness: total ? Math.round((populated / (total * 4)) * 100) : 0,
  };
}

/** Formats a compact audit message suitable for the collection-run timeline. */
export function qualitySummary(report: DataQualityReport): string {
  return `最终评分就绪 ${report.finalScoreReady}/${report.total} · Listing完整 ${report.fullyComplete}/${report.total} · 基础可决策 ${report.decisionReady}/${report.total} · 待补2项 ${report.nearReady} · 完整度 ${report.completeness}% · 48小时内 ${report.fresh} · 过期 ${report.stale} · 缺价格 ${report.missingPrice} · 缺评分 ${report.missingRating} · 缺BSR ${report.missingBsr} · 缺评论数 ${report.missingReviews} · 缺趋势 ${report.missingTrend} · 缺毛利 ${report.missingMargin}`;
}

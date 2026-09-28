export type DecisionCandidateInput = {
  id: number;
  name: string;
  asin?: string | null;
  category: string;
  market: string;
  score: number;
  verdict: string;
  trend: number;
  margin: number;
  trendVerified?: boolean;
  marginVerified?: boolean;
  price?: string | null;
  bsr?: number | null;
  rating?: number | null;
  reviews?: number | null;
  searchVolume?: number | null;
  sellingPoint?: string | null;
};

export type RankedDecisionCandidate<T extends DecisionCandidateInput> = T & {
  completeness: number;
  decisionScore: number;
  bsrPercentile: number;
};

/** Returns true when marketplace currency text contains a positive amount. */
function hasPrice(price?: string | null): boolean {
  if (typeof price !== 'string' && typeof price !== 'number') return false;
  const amount = Number(String(price).replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0;
}

/** Counts the four Listing facts required before a product enters a report. */
export function decisionCompleteness(candidate: DecisionCandidateInput): number {
  return [
    hasPrice(candidate.price),
    Number(candidate.bsr) > 0,
    Number(candidate.rating) > 0,
    Number(candidate.reviews) > 0,
  ].filter(Boolean).length;
}

/** Distinguishes an absent zero placeholder from a source-verified zero value. */
function hasObservedMetric(value: number, verified = false): boolean {
  return Number.isFinite(Number(value)) && (Number(value) !== 0 || verified);
}

/** Requires a complete marketplace Listing before preliminary market review. */
export function isMarketAssessmentReady(candidate: DecisionCandidateInput): boolean {
  return decisionCompleteness(candidate) === 4;
}

/** Identifies market-ready products whose commercial economics still need a quote. */
export function isAwaitingQuote(candidate: DecisionCandidateInput): boolean {
  return (
    isMarketAssessmentReady(candidate) &&
    !hasObservedMetric(candidate.margin, candidate.marginVerified)
  );
}

/** Requires complete Listing evidence plus observed trend and margin metrics. */
export function isFinalDecisionReady(candidate: DecisionCandidateInput): boolean {
  return (
    decisionCompleteness(candidate) === 4 &&
    hasObservedMetric(candidate.trend, candidate.trendVerified) &&
    hasObservedMetric(candidate.margin, candidate.marginVerified)
  );
}

/** Builds a 100-point score using a category-relative BSR percentile. */
export function decisionRank(
  candidate: DecisionCandidateInput,
  bsrPercentile = 0.5,
): number {
  const ai = Math.min(25, Math.max(0, Number(candidate.score) || 0)) / 25;
  const rating = Math.min(5, Math.max(0, Number(candidate.rating) || 0)) / 5;
  const reviewDepth = Math.min(
    1,
    Math.log10(Math.max(0, Number(candidate.reviews) || 0) + 1) / 5,
  );
  const bsrStrength = Math.min(1, Math.max(0, bsrPercentile));
  const trendStrength = Math.min(
    1,
    Math.max(0, (Number(candidate.trend) + 20) / 50),
  );
  const marginStrength = Math.min(1, Math.max(0, Number(candidate.margin) / 50));
  return (
    Math.round(
      (ai * 45 +
        rating * 10 +
        reviewDepth * 10 +
        bsrStrength * 15 +
        trendStrength * 10 +
        marginStrength * 10) *
        10,
    ) / 10
  );
}

/** Assigns a 0–1 BSR percentile within each marketplace and category. */
function categoryBsrPercentiles<T extends DecisionCandidateInput>(
  candidates: T[],
): Map<number, number> {
  const groups = new Map<string, T[]>();
  for (const candidate of candidates) {
    const key = `${candidate.market.trim()}|${candidate.category.trim()}`;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  const percentiles = new Map<number, number>();
  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (left, right) => Number(left.bsr) - Number(right.bsr) || left.id - right.id,
    );
    for (const [index, candidate] of sorted.entries()) {
      percentiles.set(
        candidate.id,
        sorted.length === 1 ? 0.5 : 1 - index / (sorted.length - 1),
      );
    }
  }
  return percentiles;
}

/** Keeps source-backed products and ranks each ASIN once for management review. */
export function rankDecisionCandidates<T extends DecisionCandidateInput>(
  candidates: T[],
): RankedDecisionCandidate<T>[] {
  const unique = new Map<string, T>();
  for (const candidate of candidates) {
    const asin = candidate.asin?.trim().toUpperCase();
    if (!asin || !/^[A-Z0-9]{10}$/.test(asin) || !isFinalDecisionReady(candidate))
      continue;
    const normalized = { ...candidate, asin };
    const key = `${candidate.market}|${asin}`;
    const current = unique.get(key);
    if (!current || candidate.score > current.score || candidate.id > current.id)
      unique.set(key, normalized);
  }

  const eligible = [...unique.values()];
  const percentiles = categoryBsrPercentiles(eligible);
  return eligible
    .map((candidate) => {
      const bsrPercentile = percentiles.get(candidate.id) ?? 0.5;
      return {
        ...candidate,
        completeness: decisionCompleteness(candidate),
        bsrPercentile,
        decisionScore: decisionRank(candidate, bsrPercentile),
      };
    })
    .sort(
      (left, right) =>
        right.decisionScore - left.decisionScore ||
        right.score - left.score ||
        right.id - left.id,
    );
}

/** Averages every observed finite metric, including flat and negative values. */
export function averageKnown(values: number[]): number {
  const known = values.filter(Number.isFinite);
  return known.length
    ? known.reduce((sum, value) => sum + value, 0) / known.length
    : 0;
}

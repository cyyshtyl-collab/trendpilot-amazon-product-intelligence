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
};

/** Returns true when a price contains a positive numeric amount. */
function hasPrice(price?: string | null): boolean {
  const amount = Number(String(price ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(amount) && amount > 0;
}

/** Counts the four market fields required before a product enters a decision report. */
export function decisionCompleteness(candidate: DecisionCandidateInput): number {
  return [
    hasPrice(candidate.price),
    Number(candidate.bsr) > 0,
    Number(candidate.rating) > 0,
    Number(candidate.reviews) > 0,
  ].filter(Boolean).length;
}

/** Requires complete Listing evidence plus non-placeholder trend and margin data. */
export function isFinalDecisionReady(candidate: DecisionCandidateInput): boolean {
  return (
    decisionCompleteness(candidate) === 4 &&
    Number(candidate.trend) !== 0 &&
    Number(candidate.margin) > 0
  );
}

/** Builds a 100-point decision rank from AI score, data coverage and market evidence. */
export function decisionRank(candidate: DecisionCandidateInput): number {
  const ai = Math.min(25, Math.max(0, Number(candidate.score) || 0)) / 25;
  const rating = Math.min(5, Math.max(0, Number(candidate.rating) || 0)) / 5;
  const reviewDepth = Math.min(
    1,
    Math.log10(Math.max(0, Number(candidate.reviews) || 0) + 1) / 5,
  );
  const bsr = Math.max(1, Number(candidate.bsr) || 1_000_000);
  const bsrStrength = Math.max(0, 1 - Math.log10(bsr) / 6);
  const trendStrength = Math.min(
    1,
    Math.max(0, (Number(candidate.trend) + 20) / 50),
  );
  const marginStrength = Math.min(1, Math.max(0, Number(candidate.margin) / 50));
  return Math.round(
    (ai * 45 + rating * 10 + reviewDepth * 10 + bsrStrength * 15 + trendStrength * 10 + marginStrength * 10) * 10,
  ) / 10;
}

/** Keeps only source-backed products and ranks each ASIN once for management review. */
export function rankDecisionCandidates<T extends DecisionCandidateInput>(
  candidates: T[],
): RankedDecisionCandidate<T>[] {
  const unique = new Map<string, RankedDecisionCandidate<T>>();
  for (const candidate of candidates) {
    const asin = candidate.asin?.trim().toUpperCase();
    const completeness = decisionCompleteness(candidate);
    if (
      !asin ||
      !/^[A-Z0-9]{10}$/.test(asin) ||
      !isFinalDecisionReady(candidate)
    )
      continue;
    const ranked = {
      ...candidate,
      asin,
      completeness,
      decisionScore: decisionRank(candidate),
    };
    const key = `${candidate.market}|${asin}`;
    const current = unique.get(key);
    if (!current || ranked.decisionScore > current.decisionScore) {
      unique.set(key, ranked);
    }
  }
  return [...unique.values()].sort(
    (left, right) =>
      right.decisionScore - left.decisionScore ||
      right.score - left.score ||
      right.id - left.id,
  );
}

/** Averages only populated positive metrics so missing data cannot masquerade as zero. */
export function averageKnown(values: number[]): number {
  const known = values.filter((value) => Number.isFinite(value) && value > 0);
  return known.length
    ? known.reduce((sum, value) => sum + value, 0) / known.length
    : 0;
}

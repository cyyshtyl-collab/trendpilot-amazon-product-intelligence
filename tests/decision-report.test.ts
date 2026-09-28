import assert from 'node:assert/strict';
import test from 'node:test';
import {
  averageKnown,
  isAwaitingQuote,
  isFinalDecisionReady,
  isMarketAssessmentReady,
  rankDecisionCandidates,
  type DecisionCandidateInput,
} from '../lib/decision-report.ts';

function candidate(
  overrides: Partial<DecisionCandidateInput> = {},
): DecisionCandidateInput {
  return {
    id: 1,
    name: 'Test product',
    asin: 'B012345678',
    category: '旅行配件',
    market: '美国站',
    score: 20,
    verdict: '通过',
    trend: 10,
    margin: 30,
    price: '$29.99',
    bsr: 1000,
    rating: 4.5,
    reviews: 500,
    ...overrides,
  };
}

void test('verified zero trend and margin are observed rather than missing', () => {
  assert.equal(
    isFinalDecisionReady(
      candidate({ trend: 0, margin: 0, trendVerified: true, marginVerified: true }),
    ),
    true,
  );
  assert.equal(isFinalDecisionReady(candidate({ trend: 0, margin: 0 })), false);
});

void test('negative verified economics enter scoring and can be rejected explicitly', () => {
  assert.equal(isFinalDecisionReady(candidate({ margin: -5 })), true);
});

void test('market review remains available while supplier quote is pending', () => {
  const pending = candidate({ trend: 0, margin: 0 });
  assert.equal(isMarketAssessmentReady(pending), true);
  assert.equal(isAwaitingQuote(pending), true);
  assert.equal(isFinalDecisionReady(pending), false);
});

void test('BSR is ranked within marketplace and category', () => {
  const rows = rankDecisionCandidates([
    candidate({ id: 1, asin: 'B012345678', bsr: 100 }),
    candidate({ id: 2, asin: 'B012345679', bsr: 1000 }),
    candidate({ id: 3, asin: 'B012345670', category: '宠物用品', bsr: 50_000 }),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  assert.equal(byId.get(1)?.bsrPercentile, 1);
  assert.equal(byId.get(2)?.bsrPercentile, 0);
  assert.equal(byId.get(3)?.bsrPercentile, 0.5);
  assert.ok((byId.get(1)?.decisionScore ?? 0) > (byId.get(2)?.decisionScore ?? 0));
});

void test('averages retain flat and cooling signals', () => {
  assert.equal(averageKnown([-10, 0, 20]), 10 / 3);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeDataQuality } from '../lib/data-quality.ts';

const completeListing = {
  price: '$20',
  bsr: 100,
  rating: 4.5,
  reviews: 50,
  updated_at: '2026-09-28T00:00:00.000Z',
};

void test('audited zero values qualify while unaudited placeholders remain missing', () => {
  const report = summarizeDataQuality(
    [
      {
        ...completeListing,
        trend: 0,
        margin: 0,
        verification_fields: '趋势、毛利',
      },
      { ...completeListing, trend: 0, margin: 0, verification_fields: '' },
    ],
    new Date('2026-09-28T12:00:00.000Z'),
  );
  assert.equal(report.finalScoreReady, 1);
  assert.equal(report.marketAssessmentReady, 2);
  assert.equal(report.awaitingQuote, 1);
  assert.equal(report.missingTrend, 1);
  assert.equal(report.missingMargin, 1);
});

void test('negative observed margin is complete rather than missing', () => {
  const report = summarizeDataQuality(
    [{ ...completeListing, trend: -5, margin: -10 }],
    new Date('2026-09-28T12:00:00.000Z'),
  );
  assert.equal(report.finalScoreReady, 1);
  assert.equal(report.marketAssessmentReady, 1);
  assert.equal(report.awaitingQuote, 0);
  assert.equal(report.missingMargin, 0);
});

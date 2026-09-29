import assert from 'node:assert/strict';
import test from 'node:test';

import { verificationEntries } from '../lib/verification.ts';

void test('creates separate evidence rows for each submitted metric', () => {
  assert.deepEqual(
    verificationEntries(
      { bsr: 3, trend: 12.5, margin: 28 },
      {
        BSR: 'Amazon 商品页',
        趋势: 'Google Trends 90 天',
        毛利: '供应商报价单 Q-102',
      },
    ),
    [
      { field: 'BSR', source: 'Amazon 商品页' },
      { field: '趋势', source: 'Google Trends 90 天' },
      { field: '毛利', source: '供应商报价单 Q-102' },
    ],
  );
});

void test('ignores untouched fields and supports legacy clients', () => {
  assert.deepEqual(verificationEntries({ trend: 0 }, {}, '人工核验'), [
    { field: '趋势', source: '人工核验' },
  ]);
});

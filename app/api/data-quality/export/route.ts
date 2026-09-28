import { authorized } from '@/lib/auth';
import { env } from '@/lib/runtime';

type ExportCandidate = Record<string, string | number | null>;

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Escapes one CSV cell to keep spreadsheet imports structurally safe. */
function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Builds the canonical Amazon product URL for a supported marketplace label. */
function amazonUrl(asin: string, market: string): string {
  const domains: Record<string, string> = {
    美国站: 'amazon.com',
    英国站: 'amazon.co.uk',
    德国站: 'amazon.de',
    法国站: 'amazon.fr',
    意大利站: 'amazon.it',
    西班牙站: 'amazon.es',
    加拿大站: 'amazon.ca',
    日本站: 'amazon.co.jp',
    澳大利亚站: 'amazon.com.au',
  };
  return `https://www.${domains[market] ?? 'amazon.com'}/dp/${encodeURIComponent(asin)}`;
}

/** Downloads every ASIN product missing BSR, trend or margin as a re-importable task. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });

  const result = await db()
    .prepare(
      `SELECT asin,name,category,market,price,bsr,rating,reviews,trend,margin
       FROM candidates
       WHERE asin IS NOT NULL AND asin <> ''
         AND ((bsr IS NULL OR bsr <= 0) OR trend=0 OR margin<=0)
       ORDER BY score DESC, updated_at DESC`,
    )
    .all<ExportCandidate>();
  const header = [
    'ASIN',
    '产品名称',
    '类目',
    '站点',
    '价格',
    '评分',
    '评论数',
    'BSR',
    '趋势增幅',
    '毛利率',
    'Amazon链接',
    'BSR数据来源',
    '趋势数据来源',
    '毛利测算依据',
    '采集日期',
  ];
  const rows = result.results.map((row) => [
    row.asin,
    row.name,
    row.category,
    row.market,
    row.price,
    row.rating,
    row.reviews,
    Number(row.bsr ?? 0) > 0 ? row.bsr : '',
    Number(row.trend ?? 0) !== 0 ? row.trend : '',
    Number(row.margin ?? 0) > 0 ? row.margin : '',
    amazonUrl(String(row.asin), String(row.market)),
    '',
    '',
    '',
    '',
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map(csvCell).join(','))
    .join('\r\n');
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`\uFEFF${csv}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="TrendPilot-Decision-Data-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

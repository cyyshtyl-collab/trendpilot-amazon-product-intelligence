import { cookies } from 'next/headers';
import { env } from 'cloudflare:workers';

type TrendItem = {
  keyword: string;
  traffic: string;
  publishedAt: string;
  source: string;
};

const ALLOWED_GEOS = new Set(['US', 'GB', 'DE', 'JP', 'CA', 'AU']);

async function authorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get('trendpilot_session')?.value === 'trendpilot-admin-v1';
}

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function field(block: string, pattern: RegExp): string {
  return decodeXml(block.match(pattern)?.[1] ?? '');
}

function parseFeed(xml: string): TrendItem[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => {
    const block = match[1];
    return {
      keyword: field(block, /<title>([\s\S]*?)<\/title>/),
      traffic: field(
        block,
        /<(?:ht:)?approx_traffic>([\s\S]*?)<\/(?:ht:)?approx_traffic>/,
      ),
      publishedAt: field(block, /<pubDate>([\s\S]*?)<\/pubDate>/),
      source: 'Google Trends',
    };
  });
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function trafficValue(value: string): number {
  const numeric = Number(value.replace(/[^\d.]/g, '')) || 0;
  if (/M/i.test(value)) return Math.round(numeric * 1_000_000);
  if (/K/i.test(value)) return Math.round(numeric * 1_000);
  return Math.round(numeric);
}

/** Downloads the current public Google Trends feed as normalized CSV. */
export async function GET(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });

  const url = new URL(request.url);
  const requestedGeo = (url.searchParams.get('geo') ?? 'US').toUpperCase();
  const geo = ALLOWED_GEOS.has(requestedGeo) ? requestedGeo : 'US';
  const feed = await fetch(
    `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`,
    { headers: { 'User-Agent': 'TrendPilot/1.0' } },
  );
  if (!feed.ok)
    return Response.json(
      { error: 'Google Trends 暂时不可用，请稍后重试' },
      { status: 502 },
    );

  const items = parseFeed(await feed.text()).filter((item) => item.keyword);
  const rows = [
    ['关键词', '搜索热度', '发布时间', '站点', '数据来源'],
    ...items.map((item) => [
      item.keyword,
      item.traffic,
      item.publishedAt,
      geo,
      item.source,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="TrendPilot-Google-Trends-${geo}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

/** Runs and records one Google Trends collection job. */
export async function POST(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });

  const startedAt = new Date().toISOString();
  const body = (await request.json().catch(() => ({}))) as { geo?: string };
  const requestedGeo = (body.geo ?? 'US').toUpperCase();
  const geo = ALLOWED_GEOS.has(requestedGeo) ? requestedGeo : 'US';
  try {
    const feed = await fetch(
      `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`,
      { headers: { 'User-Agent': 'TrendPilot/1.0' } },
    );
    if (!feed.ok) throw new Error(`上游响应 ${feed.status}`);
    const items = parseFeed(await feed.text()).filter((item) => item.keyword);
    const finishedAt = new Date().toISOString();
    const capturedDate = finishedAt.slice(0, 10);
    const statements = [
      db()
        .prepare(
          'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
        )
        .bind('Google Trends', geo, 'success', items.length, '', startedAt, finishedAt),
      ...items.slice(0, 100).map((item) =>
        db()
          .prepare(
            'INSERT INTO trend_signals (keyword,source,market,traffic_text,traffic_value,published_at,captured_date,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(keyword,source,market,captured_date) DO UPDATE SET traffic_text=excluded.traffic_text,traffic_value=excluded.traffic_value,published_at=excluded.published_at,created_at=excluded.created_at',
          )
          .bind(
            item.keyword,
            item.source,
            geo,
            item.traffic,
            trafficValue(item.traffic),
            item.publishedAt,
            capturedDate,
            finishedAt,
          ),
      ),
    ];
    await db().batch(statements);
    return Response.json({ items, geo, finishedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : '未知错误';
    const finishedAt = new Date().toISOString();
    await db()
      .prepare(
        'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
      )
      .bind('Google Trends', geo, 'failed', 0, message, startedAt, finishedAt)
      .run();
    return Response.json({ error: 'Google Trends 暂时不可用，请稍后重试' }, { status: 502 });
  }
}

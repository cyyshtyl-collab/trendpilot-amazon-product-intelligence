import { env } from '@/lib/runtime';
import { authorized } from '@/lib/auth';
import {
  fetchGoogleTrends,
  normalizeTrendGeo,
  persistGoogleTrends,
} from '@/lib/google-trends';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Downloads the current public Google Trends feed as normalized CSV. */
export async function GET(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });

  const url = new URL(request.url);
  const geo = normalizeTrendGeo(url.searchParams.get('geo') ?? 'US');
  let items;
  try {
    items = await fetchGoogleTrends(geo);
  } catch {
    return Response.json(
      { error: 'Google Trends 暂时不可用，请稍后重试' },
      { status: 502 },
    );
  }
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
  const geo = normalizeTrendGeo(body.geo);
  try {
    const items = await fetchGoogleTrends(geo);
    const finishedAt = await persistGoogleTrends(db(), geo, items, startedAt);
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

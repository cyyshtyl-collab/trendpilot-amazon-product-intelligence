import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

async function authorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get('trendpilot_session')?.value === 'trendpilot-admin-v1';
}

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Lists the strongest recently collected market signals. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const result = await db()
    .prepare(
      'SELECT id,keyword,source,market,traffic_text,traffic_value,published_at,captured_date FROM trend_signals ORDER BY captured_date DESC, traffic_value DESC, id DESC LIMIT 20',
    )
    .all<Record<string, unknown>>();
  return Response.json({
    signals: result.results.map((row) => ({
      id: row.id,
      keyword: row.keyword,
      source: row.source,
      market: row.market,
      trafficText: row.traffic_text,
      trafficValue: row.traffic_value,
      publishedAt: row.published_at,
      capturedDate: row.captured_date,
    })),
  });
}

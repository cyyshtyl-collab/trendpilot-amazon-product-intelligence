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
      'SELECT id,keyword,source,market,traffic_text,traffic_value,published_at,captured_date,candidate_id,promoted_at FROM trend_signals ORDER BY captured_date DESC, traffic_value DESC, id DESC LIMIT 20',
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
      candidateId: row.candidate_id,
      promotedAt: row.promoted_at,
    })),
  });
}

/** Promotes one reviewed market signal into the formal candidate pool. */
export async function POST(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as { id?: number };
  if (!Number.isInteger(body.id) || Number(body.id) < 1)
    return Response.json({ error: '无效市场信号' }, { status: 400 });

  const signal = await db()
    .prepare(
      'SELECT id,keyword,source,market,traffic_text,traffic_value,candidate_id FROM trend_signals WHERE id=?',
    )
    .bind(body.id)
    .first<Record<string, unknown>>();
  if (!signal) return Response.json({ error: '市场信号不存在' }, { status: 404 });
  if (signal.candidate_id)
    return Response.json({ candidateId: signal.candidate_id, existing: true });

  const now = new Date().toISOString();
  const marketName = signal.market === 'US' ? '美国站' : String(signal.market);
  const insert = await db()
    .prepare(
      'INSERT INTO candidates (name,asin,category,market,score,verdict,trend,revenue,reviews,margin,price,bsr,rating,search_volume,review_growth,review_text,scores_json,signals_json,pains_json,selling_point,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      String(signal.keyword),
      null,
      '待归类',
      marketName,
      15,
      '观察',
      0,
      '$0',
      0,
      0,
      '$0',
      0,
      0,
      Number(signal.traffic_value) || 0,
      0,
      '',
      JSON.stringify([3, 3, 3, 3, 3]),
      JSON.stringify([
        `${String(signal.source)} 市场信号`,
        `公开热度：${String(signal.traffic_text || '待确认')}`,
      ]),
      JSON.stringify(['等待补充 Amazon 评论与竞品证据']),
      '等待 AI 生成卖点文案',
      now,
    )
    .run();
  const candidateId = Number(insert.meta.last_row_id);
  await db()
    .prepare('UPDATE trend_signals SET candidate_id=?,promoted_at=? WHERE id=?')
    .bind(candidateId, now, body.id)
    .run();
  return Response.json({ candidateId, existing: false }, { status: 201 });
}

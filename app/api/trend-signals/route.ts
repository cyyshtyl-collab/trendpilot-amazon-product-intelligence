import { env } from 'cloudflare:workers';
import { authorized } from '@/lib/auth';
import { productIntent } from '@/lib/product-intent';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Lists the strongest recently collected market signals. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const result = await db()
    .prepare(
      'SELECT id,keyword,source,market,traffic_text,traffic_value,published_at,captured_date,candidate_id,promoted_at,ai_verdict,ai_score,ai_reason,screened_at FROM trend_signals ORDER BY captured_date DESC, traffic_value DESC, id DESC LIMIT 20',
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
      aiVerdict: row.ai_verdict,
      aiScore: row.ai_score,
      aiReason: row.ai_reason,
      screenedAt: row.screened_at,
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
      'SELECT id,keyword,source,market,traffic_text,traffic_value,candidate_id,ai_verdict,ai_score FROM trend_signals WHERE id=?',
    )
    .bind(body.id)
    .first<Record<string, unknown>>();
  if (!signal) return Response.json({ error: '市场信号不存在' }, { status: 404 });
  if (signal.candidate_id)
    return Response.json({ candidateId: signal.candidate_id, existing: true });
  const intent = productIntent(String(signal.keyword));
  if (!intent.allowed)
    return Response.json(
      { error: `不能转入候选：${intent.reason}` },
      { status: 422 },
    );
  if (signal.ai_verdict !== '推荐' || Number(signal.ai_score) < 60)
    return Response.json(
      { error: '请先完成 AI 商品意图筛选，仅“推荐”且达到 60 分的信号可转入' },
      { status: 422 },
    );

  const now = new Date().toISOString();
  const marketName = signal.market === 'US' ? '美国站' : String(signal.market);
  const insert = await db()
    .prepare(
      'INSERT INTO candidates (name,asin,category,market,score,verdict,trend,revenue,reviews,margin,price,bsr,rating,search_volume,review_growth,review_text,scores_json,signals_json,pains_json,selling_point,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .bind(
      String(signal.keyword),
      null,
      '市场机会',
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

import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

type CandidatePayload = {
  id?: number;
  name?: string;
  category?: string;
  market?: string;
  score?: number;
  verdict?: string;
  trend?: number;
  revenue?: string;
  reviews?: number;
  margin?: number;
  scores?: number[];
  signals?: string[];
  pains?: string[];
  sellingPoint?: string;
};

async function authorized(): Promise<boolean> {
  const jar = await cookies();
  return jar.get('trendpilot_session')?.value === 'trendpilot-admin-v1';
}
function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}
function invalid(body: CandidatePayload): string | null {
  if (!body.name?.trim()) return '产品名称不能为空';
  if (!Array.isArray(body.scores) || body.scores.length !== 5)
    return '五维评分不完整';
  return null;
}

/** Lists all persisted candidates for the authenticated administrator. */
export async function GET() {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const result = await db()
    .prepare('SELECT * FROM candidates ORDER BY score DESC, id DESC')
    .all<Record<string, unknown>>();
  const candidates = result.results.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    market: row.market,
    score: row.score,
    verdict: row.verdict,
    trend: row.trend,
    revenue: row.revenue,
    reviews: row.reviews,
    margin: row.margin,
    scores: JSON.parse(String(row.scores_json)),
    signals: JSON.parse(String(row.signals_json)),
    pains: JSON.parse(String(row.pains_json)),
    sellingPoint: row.selling_point,
  }));
  return Response.json({ candidates });
}

/** Creates a validated candidate record. */
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as CandidatePayload;
  const issue = invalid(body);
  if (issue) return Response.json({ error: issue }, { status: 400 });
  const result = await db()
    .prepare(
      'INSERT INTO candidates (name,category,market,score,verdict,trend,revenue,reviews,margin,scores_json,signals_json,pains_json,selling_point,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id',
    )
    .bind(
      body.name!.trim(),
      body.category ?? '未分类',
      body.market ?? '美国站',
      body.score ?? 0,
      body.verdict ?? '淘汰',
      body.trend ?? 0,
      body.revenue ?? '$0',
      body.reviews ?? 0,
      body.margin ?? 0,
      JSON.stringify(body.scores),
      JSON.stringify(body.signals ?? []),
      JSON.stringify(body.pains ?? []),
      body.sellingPoint ?? '',
      new Date().toISOString(),
    )
    .first<{ id: number }>();
  return Response.json({ id: result?.id }, { status: 201 });
}

/** Updates a validated candidate record. */
export async function PUT(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as CandidatePayload;
  const issue = invalid(body);
  if (issue || !body.id)
    return Response.json({ error: issue ?? '缺少产品编号' }, { status: 400 });
  await db()
    .prepare(
      'UPDATE candidates SET name=?,category=?,market=?,score=?,verdict=?,trend=?,revenue=?,reviews=?,margin=?,scores_json=?,signals_json=?,pains_json=?,selling_point=?,updated_at=? WHERE id=?',
    )
    .bind(
      body.name!.trim(),
      body.category ?? '未分类',
      body.market ?? '美国站',
      body.score ?? 0,
      body.verdict ?? '淘汰',
      body.trend ?? 0,
      body.revenue ?? '$0',
      body.reviews ?? 0,
      body.margin ?? 0,
      JSON.stringify(body.scores),
      JSON.stringify(body.signals ?? []),
      JSON.stringify(body.pains ?? []),
      body.sellingPoint ?? '',
      new Date().toISOString(),
      body.id,
    )
    .run();
  return Response.json({ updated: true });
}

/** Deletes one candidate record. */
export async function DELETE(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id < 1)
    return Response.json({ error: '无效产品编号' }, { status: 400 });
  await db().prepare('DELETE FROM candidates WHERE id=?').bind(id).run();
  return Response.json({ deleted: true });
}

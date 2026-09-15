import { env } from '@/lib/runtime';
import { authorized } from '@/lib/auth';

type CandidatePayload = {
  id?: number;
  name?: string;
  asin?: string;
  category?: string;
  dataOrigin?: string;
  market?: string;
  score?: number;
  verdict?: string;
  trend?: number;
  revenue?: string;
  reviews?: number;
  margin?: number;
  price?: string;
  bsr?: number;
  rating?: number;
  searchVolume?: number;
  reviewGrowth?: number;
  reviewText?: string;
  scores?: number[];
  signals?: string[];
  pains?: string[];
  sellingPoint?: string;
};

type CandidateView = CandidatePayload & { id: number };

function completeness(candidate: CandidateView): number {
  return [
    Boolean(candidate.asin),
    candidate.price !== '$0',
    Number(candidate.bsr) > 0,
    Number(candidate.rating) > 0,
    Number(candidate.reviews) > 0,
    Number(candidate.searchVolume) > 0,
    Boolean(candidate.reviewText?.trim()),
  ].filter(Boolean).length;
}

function deduplicateCandidates(candidates: CandidateView[]): CandidateView[] {
  const unique = new Map<string, CandidateView>();
  for (const candidate of candidates) {
    const normalizedName = candidate.name?.trim().toLocaleLowerCase('zh-CN') ?? '';
    const key = candidate.asin
      ? `${candidate.market}|asin:${candidate.asin}`
      : `${candidate.market}|name:${normalizedName}`;
    const current = unique.get(key);
    if (
      !current ||
      completeness(candidate) > completeness(current) ||
      (completeness(candidate) === completeness(current) &&
        Number(candidate.score) > Number(current.score))
    ) {
      unique.set(key, candidate);
    }
  }
  return [...unique.values()].sort(
    (left, right) => Number(right.score) - Number(left.score) || right.id - left.id,
  );
}

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}
function invalid(body: CandidatePayload): string | null {
  if (!body.name?.trim()) return '产品名称不能为空';
  if (body.asin?.trim() && !/^[A-Z0-9]{10}$/i.test(body.asin.trim()))
    return 'ASIN 必须是 10 位字母或数字';
  if (!Array.isArray(body.scores) || body.scores.length !== 5)
    return '五维评分不完整';
  return null;
}

function insertStatement(body: CandidatePayload): D1PreparedStatement {
  const asin = body.asin?.trim().toUpperCase() || null;
  const columns =
    'name,asin,category,market,score,verdict,trend,revenue,reviews,margin,price,bsr,rating,search_volume,review_growth,review_text,scores_json,signals_json,pains_json,selling_point,updated_at';
  const values = [
    body.name!.trim(),
    asin,
    body.category ?? '未分类',
    body.market ?? '美国站',
    body.score ?? 0,
    body.verdict ?? '淘汰',
    body.trend ?? 0,
    body.revenue ?? '$0',
    body.reviews ?? 0,
    body.margin ?? 0,
    body.price ?? '$0',
    body.bsr ?? 0,
    body.rating ?? 0,
    body.searchVolume ?? 0,
    body.reviewGrowth ?? 0,
    body.reviewText?.slice(0, 20000) ?? '',
    JSON.stringify(body.scores),
    JSON.stringify(body.signals ?? []),
    JSON.stringify(body.pains ?? []),
    body.sellingPoint ?? '',
    new Date().toISOString(),
  ];
  if (asin) {
    return db()
      .prepare(
        `INSERT INTO candidates (${columns}) VALUES (${values.map(() => '?').join(',')}) ON CONFLICT(asin,market) DO UPDATE SET name=excluded.name,category=excluded.category,score=excluded.score,verdict=excluded.verdict,trend=excluded.trend,revenue=excluded.revenue,reviews=excluded.reviews,margin=excluded.margin,price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,search_volume=excluded.search_volume,review_growth=excluded.review_growth,review_text=excluded.review_text,scores_json=excluded.scores_json,signals_json=excluded.signals_json,pains_json=excluded.pains_json,selling_point=excluded.selling_point,updated_at=excluded.updated_at`,
      )
      .bind(...values);
  }
  return db()
    .prepare(
      `INSERT INTO candidates (${columns}) VALUES (${values.map(() => '?').join(',')})`,
    )
    .bind(...values);
}

function snapshotByAsin(body: CandidatePayload): D1PreparedStatement | null {
  const asin = body.asin?.trim().toUpperCase();
  if (!asin) return null;
  const capturedDate = new Date().toISOString().slice(0, 10);
  return db()
    .prepare(
      `INSERT INTO candidate_snapshots (candidate_id,captured_date,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin,captured_at) SELECT id,?,?,?,?,?,?,?,?,?,?,? FROM candidates WHERE asin=? AND market=? ON CONFLICT(candidate_id,captured_date) DO UPDATE SET price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,reviews=excluded.reviews,review_growth=excluded.review_growth,search_volume=excluded.search_volume,trend=excluded.trend,revenue=excluded.revenue,margin=excluded.margin,captured_at=excluded.captured_at`,
    )
    .bind(
      capturedDate,
      body.price ?? '$0',
      body.bsr ?? 0,
      body.rating ?? 0,
      body.reviews ?? 0,
      body.reviewGrowth ?? 0,
      body.searchVolume ?? 0,
      body.trend ?? 0,
      body.revenue ?? '$0',
      body.margin ?? 0,
      new Date().toISOString(),
      asin,
      body.market ?? '美国站',
    );
}

function snapshotById(id: number, body: CandidatePayload): D1PreparedStatement {
  return db()
    .prepare(
      `INSERT INTO candidate_snapshots (candidate_id,captured_date,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin,captured_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(candidate_id,captured_date) DO UPDATE SET price=excluded.price,bsr=excluded.bsr,rating=excluded.rating,reviews=excluded.reviews,review_growth=excluded.review_growth,search_volume=excluded.search_volume,trend=excluded.trend,revenue=excluded.revenue,margin=excluded.margin,captured_at=excluded.captured_at`,
    )
    .bind(
      id,
      new Date().toISOString().slice(0, 10),
      body.price ?? '$0',
      body.bsr ?? 0,
      body.rating ?? 0,
      body.reviews ?? 0,
      body.reviewGrowth ?? 0,
      body.searchVolume ?? 0,
      body.trend ?? 0,
      body.revenue ?? '$0',
      body.margin ?? 0,
      new Date().toISOString(),
    );
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
    asin: row.asin,
    category: row.category,
    dataOrigin: row.data_origin,
    market: row.market,
    score: row.score,
    verdict: row.verdict,
    trend: row.trend,
    revenue: row.revenue,
    reviews: row.reviews,
    margin: row.margin,
    price: row.price,
    bsr: row.bsr,
    rating: row.rating,
    searchVolume: row.search_volume,
    reviewGrowth: row.review_growth,
    reviewText: row.review_text,
    scores: JSON.parse(String(row.scores_json)),
    signals: JSON.parse(String(row.signals_json)),
    pains: JSON.parse(String(row.pains_json)),
    sellingPoint: row.selling_point,
  })) as CandidateView[];
  const visibleCandidates = candidates.filter(
    (candidate) => candidate.asin || candidate.category !== '待归类',
  );
  const uniqueCandidates = deduplicateCandidates(visibleCandidates);
  return Response.json({
    candidates: uniqueCandidates,
    duplicateCount: visibleCandidates.length - uniqueCandidates.length,
    pendingSignalCount: candidates.length - visibleCandidates.length,
  });
}

/** Creates one candidate or imports a validated batch of up to 200 candidates. */
export async function POST(request: Request) {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as CandidatePayload | CandidatePayload[];
  if (Array.isArray(body)) {
    if (body.length < 1 || body.length > 200)
      return Response.json(
        { error: '每次需导入 1–200 条产品数据' },
        { status: 400 },
      );
    const issueIndex = body.findIndex((item) => invalid(item));
    if (issueIndex >= 0)
      return Response.json(
        { error: `第 ${issueIndex + 1} 条数据：${invalid(body[issueIndex])}` },
        { status: 400 },
      );
    await db().batch(body.map(insertStatement));
    const snapshots = body
      .map(snapshotByAsin)
      .filter((item): item is D1PreparedStatement => item !== null);
    if (snapshots.length) await db().batch(snapshots);
    return Response.json({ imported: body.length }, { status: 201 });
  }
  const issue = invalid(body);
  if (issue) return Response.json({ error: issue }, { status: 400 });
  const result = await insertStatement(body).run();
  const snapshot = snapshotByAsin(body);
  if (snapshot) await snapshot.run();
  else if (result.meta.last_row_id)
    await snapshotById(Number(result.meta.last_row_id), body).run();
  return Response.json({ id: result.meta.last_row_id }, { status: 201 });
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
      'UPDATE candidates SET name=?,asin=?,category=?,market=?,score=?,verdict=?,trend=?,revenue=?,reviews=?,margin=?,price=?,bsr=?,rating=?,search_volume=?,review_growth=?,review_text=?,scores_json=?,signals_json=?,pains_json=?,selling_point=?,updated_at=? WHERE id=?',
    )
    .bind(
      body.name!.trim(),
      body.asin?.trim().toUpperCase() || null,
      body.category ?? '未分类',
      body.market ?? '美国站',
      body.score ?? 0,
      body.verdict ?? '淘汰',
      body.trend ?? 0,
      body.revenue ?? '$0',
      body.reviews ?? 0,
      body.margin ?? 0,
      body.price ?? '$0',
      body.bsr ?? 0,
      body.rating ?? 0,
      body.searchVolume ?? 0,
      body.reviewGrowth ?? 0,
      body.reviewText?.slice(0, 20000) ?? '',
      JSON.stringify(body.scores),
      JSON.stringify(body.signals ?? []),
      JSON.stringify(body.pains ?? []),
      body.sellingPoint ?? '',
      new Date().toISOString(),
      body.id,
    )
    .run();
  await snapshotById(body.id, body).run();
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

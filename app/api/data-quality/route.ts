import { authorized } from '@/lib/auth';
import { summarizeDataQuality } from '@/lib/data-quality';
import { env } from '@/lib/runtime';

type QualityCandidate = Record<string, string | number | null>;
type QualityUpdate = {
  id?: number;
  bsr?: number;
  trend?: number;
  margin?: number;
};
type VerificationPayload = {
  updates?: QualityUpdate[];
  source?: string;
  verifiedDate?: string;
  owner?: string;
};

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Checks whether any recorded audit event verified a decision metric. */
function fieldVerified(row: QualityCandidate, field: string): boolean {
  const value = row.verification_fields;
  return typeof value === 'string' && value.split(/[、,|]/).includes(field);
}

/** Returns one normalized list of missing decision fields. */
function missingFields(row: QualityCandidate): string[] {
  const price = Number.parseFloat(String(row.price ?? '').replace(/[^0-9.]/g, ''));
  return [
    !(Number.isFinite(price) && price > 0) ? '价格' : '',
    Number(row.bsr ?? 0) <= 0 ? 'BSR' : '',
    Number(row.rating ?? 0) <= 0 ? '评分' : '',
    Number(row.reviews ?? 0) <= 0 ? '评论数' : '',
    Number(row.trend ?? 0) === 0 && !fieldVerified(row, '趋势') ? '趋势' : '',
    Number(row.margin ?? 0) === 0 && !fieldVerified(row, '毛利') ? '毛利' : '',
  ].filter(Boolean);
}

/** Lists the current quality report and the highest-value records to complete next. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });

  const result = await db()
    .prepare(
      `SELECT c.id,c.name,c.asin,c.category,c.market,c.score,c.price,c.bsr,c.rating,c.reviews,c.trend,c.margin,c.updated_at,
              v.verification_fields,v.source AS verification_source,v.verified_date,v.owner AS verification_owner,
              t.assignee AS task_assignee,t.status AS task_status,t.due_date AS task_due_date
       FROM candidates c
       LEFT JOIN LATERAL (
         SELECT
           string_agg(verified_fields,'、') AS verification_fields,
           (array_agg(source ORDER BY created_at DESC))[1] AS source,
           (array_agg(verified_date ORDER BY created_at DESC))[1] AS verified_date,
           (array_agg(owner ORDER BY created_at DESC))[1] AS owner
         FROM data_verifications WHERE candidate_id=c.id
       ) v ON TRUE
       LEFT JOIN completion_tasks t ON t.candidate_id=c.id
       WHERE asin IS NOT NULL AND asin <> ''
       ORDER BY c.score DESC, c.updated_at DESC`,
    )
    .all<QualityCandidate>();
  const report = summarizeDataQuality(result.results);
  const queue = result.results
    .map((row) => ({
      id: Number(row.id),
      name: String(row.name ?? ''),
      asin: String(row.asin ?? ''),
      category: String(row.category ?? '未分类'),
      market: String(row.market ?? ''),
      score: Number(row.score ?? 0),
      bsr: Number(row.bsr ?? 0),
      trend: Number(row.trend ?? 0),
      margin: Number(row.margin ?? 0),
      verificationSource: String(row.verification_source ?? ''),
      verifiedDate: String(row.verified_date ?? ''),
      verificationOwner: String(row.verification_owner ?? ''),
      taskAssignee: String(row.task_assignee ?? ''),
      taskStatus: String(row.task_status ?? ''),
      taskDueDate: String(row.task_due_date ?? ''),
      missing: missingFields(row),
      updatedAt: String(row.updated_at ?? ''),
    }))
    .filter((row) => row.missing.length > 0)
    .sort(
      (left, right) =>
        left.missing.length - right.missing.length ||
        right.score - left.score ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 20);

  return Response.json({ report, queue });
}

/** Applies bounded BSR, trend and margin updates and records today's snapshot. */
export async function PATCH(request: Request): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const body = (await request.json()) as VerificationPayload;
  const updates = body.updates;
  if (!Array.isArray(updates) || updates.length < 1 || updates.length > 20)
    return Response.json({ error: '每次可保存 1–20 条补全记录' }, { status: 400 });
  const source = body.source?.trim().slice(0, 120) ?? '';
  const owner = body.owner?.trim().slice(0, 60) ?? '';
  const verifiedDate = body.verifiedDate?.trim() ?? '';
  if (!source) return Response.json({ error: '请填写数据来源' }, { status: 400 });
  if (!owner) return Response.json({ error: '请填写核对负责人' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedDate))
    return Response.json({ error: '请选择有效核对日期' }, { status: 400 });

  for (const update of updates) {
    if (!Number.isInteger(update.id) || Number(update.id) < 1)
      return Response.json({ error: '存在无效产品编号' }, { status: 400 });
    if (
      update.bsr !== undefined &&
      (!Number.isInteger(update.bsr) || update.bsr < 1)
    )
      return Response.json({ error: 'BSR 必须是大于 0 的整数' }, { status: 400 });
    if (
      update.trend !== undefined &&
      (!Number.isFinite(update.trend) || update.trend < -100 || update.trend > 10000)
    )
      return Response.json({ error: '趋势增幅必须在 -100%–10000% 之间' }, { status: 400 });
    if (
      update.margin !== undefined &&
      (!Number.isFinite(update.margin) || update.margin < -1000 || update.margin > 100)
    )
      return Response.json({ error: '毛利率必须在 -1000%–100% 之间' }, { status: 400 });
    if (update.bsr === undefined && update.trend === undefined && update.margin === undefined)
      return Response.json({ error: '没有可保存的补全字段' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const capturedDate = now.slice(0, 10);
  const statements = updates.flatMap((update) => {
    const fields = [
      update.bsr !== undefined ? 'BSR' : '',
      update.trend !== undefined ? '趋势' : '',
      update.margin !== undefined ? '毛利' : '',
    ].filter(Boolean).join('、');
    return [
    db()
      .prepare(
        `UPDATE candidates
         SET bsr=COALESCE(?,bsr),trend=COALESCE(?,trend),margin=COALESCE(?,margin),updated_at=?
         WHERE id=?`,
      )
      .bind(update.bsr ?? null, update.trend ?? null, update.margin ?? null, now, update.id),
    db()
      .prepare(
        `INSERT INTO candidate_snapshots
         (candidate_id,captured_date,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin,captured_at)
         SELECT id,?,price,bsr,rating,reviews,review_growth,search_volume,trend,revenue,margin,?
         FROM candidates WHERE id=?
         ON CONFLICT(candidate_id,captured_date) DO UPDATE SET
         bsr=excluded.bsr,trend=excluded.trend,margin=excluded.margin,captured_at=excluded.captured_at`,
      )
      .bind(capturedDate, now, update.id),
    db()
      .prepare(
        `INSERT INTO data_verifications
         (candidate_id,verified_fields,source,verified_date,owner,created_at)
         VALUES (?,?,?,?,?,?)`,
      )
      .bind(update.id!, fields, source, verifiedDate, owner, now),
    ];
  });
  await db().batch(statements);
  return Response.json({ updated: updates.length });
}

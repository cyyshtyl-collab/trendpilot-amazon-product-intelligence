import { env } from '@/lib/runtime';
import { qualitySummary, summarizeDataQuality } from '@/lib/data-quality';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function authorized(request: Request): boolean {
  const secret = (env as unknown as { AUTOMATION_SECRET?: string })
    .AUTOMATION_SECRET;
  return Boolean(
    secret &&
      secret.length >= 32 &&
      request.headers.get('authorization') === `Bearer ${secret}`,
  );
}

/** Audits ASIN-backed Listing freshness and records an actionable collection run. */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request))
    return Response.json({ error: '未授权' }, { status: 401 });
  const startedAt = new Date().toISOString();
  const result = await db()
    .prepare(
      `SELECT asin,price,bsr,rating,updated_at
       FROM candidates WHERE asin IS NOT NULL AND asin <> ''`,
    )
    .all<Record<string, string | number | null>>();
  const report = summarizeDataQuality(result.results);
  const summary = qualitySummary(report);
  const status =
    report.stale > 0 ||
    report.missingPrice > 0 ||
    report.missingRating > 0 ||
    report.missingBsr > 0
      ? 'warning'
      : 'success';
  const finishedAt = new Date().toISOString();
  await db()
    .prepare(
      `INSERT INTO source_runs
       (source,market,status,item_count,error_message,started_at,finished_at)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .bind(
      '数据质量巡检',
      '全部站点',
      status,
      report.total,
      summary,
      startedAt,
      finishedAt,
    )
    .run();
  return Response.json({ ok: true, status, report, summary, finishedAt });
}

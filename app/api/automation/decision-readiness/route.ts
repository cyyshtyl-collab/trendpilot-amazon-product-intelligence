import { env } from '@/lib/runtime';

type ReadinessCount = {
  total: number | string;
  decision_ready: number | string;
  near_ready: number | string;
};

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

/** Returns ASIN-backed decision readiness using the same four-field UI rule. */
async function readinessCount(): Promise<{
  total: number;
  decisionReady: number;
  nearReady: number;
}> {
  const row = await db()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE
           (CASE WHEN price ~ '[0-9]' AND NULLIF(regexp_replace(price,'[^0-9.]','','g'),'')::numeric > 0 THEN 1 ELSE 0 END
            + CASE WHEN bsr > 0 THEN 1 ELSE 0 END
            + CASE WHEN rating > 0 THEN 1 ELSE 0 END
            + CASE WHEN reviews > 0 THEN 1 ELSE 0 END) >= 3
         ) AS decision_ready,
         COUNT(*) FILTER (WHERE
           (CASE WHEN price ~ '[0-9]' AND NULLIF(regexp_replace(price,'[^0-9.]','','g'),'')::numeric > 0 THEN 1 ELSE 0 END
            + CASE WHEN bsr > 0 THEN 1 ELSE 0 END
            + CASE WHEN rating > 0 THEN 1 ELSE 0 END
            + CASE WHEN reviews > 0 THEN 1 ELSE 0 END) = 2
         ) AS near_ready
       FROM candidates
       WHERE asin ~ '^[A-Z0-9]{10}$'`,
    )
    .first<ReadinessCount>();
  return {
    total: Number(row?.total ?? 0),
    decisionReady: Number(row?.decision_ready ?? 0),
    nearReady: Number(row?.near_ready ?? 0),
  };
}

/** Restores missing listing fields from the newest populated historical snapshot. */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request))
    return Response.json({ error: '未授权' }, { status: 401 });

  const startedAt = new Date().toISOString();
  const before = await readinessCount();
  const result = await db()
    .prepare(
      `WITH best AS (
         SELECT
           candidate_id,
           (array_agg(price ORDER BY captured_at DESC) FILTER (WHERE price NOT IN ('','$0')))[1] AS price,
           (array_agg(bsr ORDER BY captured_at DESC) FILTER (WHERE bsr > 0))[1] AS bsr,
           (array_agg(rating ORDER BY captured_at DESC) FILTER (WHERE rating > 0))[1] AS rating,
           (array_agg(reviews ORDER BY captured_at DESC) FILTER (WHERE reviews > 0))[1] AS reviews,
           (array_agg(search_volume ORDER BY captured_at DESC) FILTER (WHERE search_volume > 0))[1] AS search_volume,
           (array_agg(trend ORDER BY captured_at DESC) FILTER (WHERE trend <> 0))[1] AS trend,
           (array_agg(revenue ORDER BY captured_at DESC) FILTER (WHERE revenue NOT IN ('','$0')))[1] AS revenue,
           (array_agg(margin ORDER BY captured_at DESC) FILTER (WHERE margin > 0))[1] AS margin
         FROM candidate_snapshots
         GROUP BY candidate_id
       )
       UPDATE candidates AS candidate SET
         price=CASE WHEN candidate.price IN ('','$0') THEN COALESCE(best.price,candidate.price) ELSE candidate.price END,
         bsr=CASE WHEN candidate.bsr <= 0 THEN GREATEST(best.bsr,0) ELSE candidate.bsr END,
         rating=CASE WHEN candidate.rating <= 0 THEN GREATEST(best.rating,0) ELSE candidate.rating END,
         reviews=CASE WHEN candidate.reviews <= 0 THEN GREATEST(best.reviews,0) ELSE candidate.reviews END,
         search_volume=CASE WHEN candidate.search_volume <= 0 THEN GREATEST(best.search_volume,0) ELSE candidate.search_volume END,
         trend=CASE WHEN candidate.trend = 0 THEN COALESCE(best.trend,0) ELSE candidate.trend END,
         revenue=CASE WHEN candidate.revenue IN ('','$0') THEN COALESCE(best.revenue,candidate.revenue) ELSE candidate.revenue END,
         margin=CASE WHEN candidate.margin <= 0 THEN GREATEST(best.margin,0) ELSE candidate.margin END,
         updated_at=CASE
           WHEN (candidate.price IN ('','$0') AND best.price IS NOT NULL)
             OR (candidate.bsr <= 0 AND best.bsr > 0)
             OR (candidate.rating <= 0 AND best.rating > 0)
             OR (candidate.reviews <= 0 AND best.reviews > 0)
           THEN ? ELSE candidate.updated_at END
       FROM best
       WHERE candidate.id=best.candidate_id`,
    )
    .bind(startedAt)
    .run();
  const after = await readinessCount();
  const restored = Math.max(0, after.decisionReady - before.decisionReady);
  const summary = `历史快照补全 ${Number(result.meta.changes ?? 0)} 条 · 新增可决策 ${restored} 条 · 当前 ${after.decisionReady}/${after.total}`;
  const finishedAt = new Date().toISOString();
  await db()
    .prepare(
      `INSERT INTO source_runs
       (source,market,status,item_count,error_message,started_at,finished_at)
       VALUES (?,?,?,?,?,?,?)`,
    )
    .bind(
      '可决策数据补全',
      '全部站点',
      'success',
      restored,
      summary,
      startedAt,
      finishedAt,
    )
    .run();
  return Response.json({
    ok: true,
    before,
    after,
    restored,
    summary,
    finishedAt,
  });
}

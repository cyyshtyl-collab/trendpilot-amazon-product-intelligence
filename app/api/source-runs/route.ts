import { env } from 'cloudflare:workers';
import { authorized } from '@/lib/auth';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Lists the latest collection runs for the authenticated administrator. */
export async function GET(): Promise<Response> {
  if (!(await authorized()))
    return Response.json({ error: '未登录' }, { status: 401 });
  const result = await db()
    .prepare(
      'SELECT id,source,market,status,item_count,error_message,started_at,finished_at FROM source_runs ORDER BY id DESC LIMIT 12',
    )
    .all<Record<string, unknown>>();
  return Response.json({
    runs: result.results.map((row) => ({
      id: row.id,
      source: row.source,
      market: row.market,
      status: row.status,
      itemCount: row.item_count,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  });
}

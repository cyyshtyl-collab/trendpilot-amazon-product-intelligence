import { env } from 'cloudflare:workers';
import {
  fetchGoogleTrends,
  normalizeTrendGeo,
  persistGoogleTrends,
} from '@/lib/google-trends';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

/** Runs the public, idempotent daily trend collection used by the scheduler. */
export async function GET(request: Request): Promise<Response> {
  const geo = normalizeTrendGeo(new URL(request.url).searchParams.get('geo') ?? 'US');
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db()
    .prepare(
      "SELECT id,finished_at FROM source_runs WHERE source='Google Trends' AND market=? AND status='success' AND substr(finished_at,1,10)=? ORDER BY id DESC LIMIT 1",
    )
    .bind(geo, today)
    .first<{ id: number; finished_at: string }>();
  if (existing) {
    return Response.json(
      { ok: true, skipped: true, reason: 'today_already_collected', finishedAt: existing.finished_at },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const startedAt = new Date().toISOString();
  try {
    const items = await fetchGoogleTrends(geo);
    const finishedAt = await persistGoogleTrends(db(), geo, items, startedAt);
    return Response.json(
      { ok: true, skipped: false, geo, itemCount: items.length, finishedAt },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : '未知错误';
    const finishedAt = new Date().toISOString();
    await db()
      .prepare(
        'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
      )
      .bind('Google Trends', geo, 'failed', 0, message, startedAt, finishedAt)
      .run();
    return Response.json({ ok: false, error: '采集失败' }, { status: 502 });
  }
}

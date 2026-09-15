import { env } from '@/lib/runtime';
import {
  downloadCandidateFeed,
  parseCandidateFeed,
  persistCandidateFeed,
} from '@/lib/candidate-feed';

function db(): D1Database {
  return (env as unknown as { DB: D1Database }).DB;
}

function authorized(request: Request): boolean {
  const secret = (env as unknown as { AUTOMATION_SECRET?: string }).AUTOMATION_SECRET;
  return Boolean(secret && secret.length >= 32 && request.headers.get('authorization') === `Bearer ${secret}`);
}

/** Downloads and imports the configured listing CSV feed for scheduled collection. */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) return Response.json({ error: '未授权' }, { status: 401 });
  const feedUrl = (env as unknown as { CANDIDATE_FEED_URL?: string }).CANDIDATE_FEED_URL;
  if (!feedUrl) return Response.json({ error: '尚未配置 CANDIDATE_FEED_URL' }, { status: 409 });
  const source = (env as unknown as { CANDIDATE_FEED_NAME?: string }).CANDIDATE_FEED_NAME ?? 'CSV Feed';
  const startedAt = new Date().toISOString();
  try {
    const rows = parseCandidateFeed(await downloadCandidateFeed(feedUrl));
    await persistCandidateFeed(db(), rows, source);
    const finishedAt = new Date().toISOString();
    await db().prepare(
      'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
    ).bind(source, '多站点', 'success', rows.length, '', startedAt, finishedAt).run();
    return Response.json({ ok: true, imported: rows.length, finishedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : '未知错误';
    const finishedAt = new Date().toISOString();
    await db().prepare(
      'INSERT INTO source_runs (source,market,status,item_count,error_message,started_at,finished_at) VALUES (?,?,?,?,?,?,?)',
    ).bind(source, '多站点', 'failed', 0, message, startedAt, finishedAt).run();
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
